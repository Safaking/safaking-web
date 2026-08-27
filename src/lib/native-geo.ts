'use client';

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface SimpleCoords {
  latitude: number;
  longitude: number;
}

/**
 * One-shot device location. Inside the Capacitor Android shell, a raw
 * `navigator.geolocation` call is delegated through the WebView's
 * onGeolocationPermissionsShowPrompt, which only resolves cleanly once the
 * app already holds the native ACCESS_FINE_LOCATION permission — so native
 * builds go through the Capacitor plugin instead, which handles that permission
 * request itself. Plain browsers keep using the standard Geolocation API.
 *
 * Resolves null rather than throwing — callers treat "no location" (denied,
 * timed out, unsupported) as an acceptable outcome, not an error.
 */
export async function getDeviceCoords(timeoutMs = 8000): Promise<SimpleCoords | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: timeoutMs,
      });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      return null;
    }
  }

  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 }
    );
  });
}
