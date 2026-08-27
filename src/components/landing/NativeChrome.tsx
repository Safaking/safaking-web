'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Themes the native Android status bar to match the site, so the app doesn't
 * open into a jarring default-grey system bar above a maroon header. No-op
 * on the web — only runs inside the Capacitor shell.
 */
export function NativeChrome() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setBackgroundColor({ color: '#4A0E1A' });
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {
        // Status bar theming is cosmetic — never block app startup on it.
      }
    })();
  }, []);

  return null;
}
