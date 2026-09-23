'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { isNativeApp } from '@/lib/native-app';
import { supabase } from '@/lib/supabase';
import { rememberPushToken } from '@/lib/push-token';

/**
 * Signs this phone up for notifications (supabase/042).
 *
 * Only inside the Android app, and only once somebody is signed in — a
 * notification is for a person, and Android 13+ asks permission with a system
 * dialog, which should never be the first thing a visitor sees. If they say
 * no, we do not ask again.
 *
 * Google charges nothing for these, and unlike SMS they need no DLT
 * registration.
 */
const ASKED = 'sk-push-asked';

export function PushRegistration() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user || !isNativeApp()) return;
    let cancelled = false;
    const listeners: { remove: () => Promise<void> }[] = [];

    (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        const status = await PushNotifications.checkPermissions();
        let allowed = status.receive === 'granted';
        if (!allowed && status.receive === 'prompt') {
          // Asked once. A refusal is remembered so we never nag.
          if (localStorage.getItem(ASKED)) return;
          localStorage.setItem(ASKED, '1');
          const asked = await PushNotifications.requestPermissions();
          allowed = asked.receive === 'granted';
        }
        if (!allowed || cancelled) return;

        listeners.push(
          await PushNotifications.addListener('registration', async (token) => {
            rememberPushToken(token.value);
            const { error } = await supabase.rpc('register_device_token', {
              p_token: token.value,
              p_platform: 'android',
              p_app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
            });
            if (error) console.error('Could not register this phone for alerts:', error.message);
          })
        );

        listeners.push(
          await PushNotifications.addListener('registrationError', (err) => {
            // Usually a missing google-services.json in the build.
            console.error('Push registration failed:', err);
          })
        );

        // Tapping the notification opens the page it is about.
        listeners.push(
          await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            const path = action.notification.data?.path;
            if (typeof path === 'string' && path.startsWith('/')) router.push(path);
          })
        );

        await PushNotifications.register();
      } catch (error) {
        console.error('Push notifications unavailable:', error);
      }
    })();

    return () => {
      cancelled = true;
      listeners.forEach((listener) => void listener.remove().catch(() => {}));
    };
  }, [user, router]);

  return null;
}
