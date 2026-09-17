'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * The SafaKing Android app is a Capacitor shell around the live site, so the
 * same pages serve both. App-only UI switches on these. The root layout's
 * inline script puts the `sk-app` class on <html> before first paint, so the
 * site's own headers never flash inside the app.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    Capacitor.isNativePlatform() ||
    (typeof navigator !== 'undefined' && navigator.userAgent.includes('SafaKingApp')) ||
    !!(window as any).Capacitor?.isNative ||
    !!(window as any).androidBridge
  );
}

/** False during server render and the first client render, then the truth. */
export function useNativeApp(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => {
    const value = isNativeApp();
    setNative(value);
    if (value) document.documentElement.classList.add('sk-app');
  }, []);
  return native;
}

// ---- The Android back button -----------------------------------------------
// An open bag, sheet or dialog closes on the back button before the page goes
// back, newest first — the way every Android app behaves.

type BackHandler = () => void;
const backHandlers: BackHandler[] = [];

export function useBackHandler(active: boolean, onBack: BackHandler) {
  useEffect(() => {
    if (!active) return;
    backHandlers.push(onBack);
    return () => {
      const index = backHandlers.lastIndexOf(onBack);
      if (index !== -1) backHandlers.splice(index, 1);
    };
  }, [active, onBack]);
}

/** Closes the newest open overlay. False when nothing was open. */
export function runBackHandler(): boolean {
  const handler = backHandlers[backHandlers.length - 1];
  if (!handler) return false;
  handler();
  return true;
}

export function hasOpenOverlay(): boolean {
  return backHandlers.length > 0;
}
