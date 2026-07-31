'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const STORAGE_KEY = 'safaking.wishlist.v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Wishlist that works signed-out (localStorage) and, once signed in, mirrors
 * into the wishlists table so it follows the user across devices.
 * Static-catalogue ids aren't uuids, so those stay local-only.
 */
export function useWishlist() {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setWishlist(JSON.parse(raw) as string[]);
    } catch {
      // Unavailable storage — start empty.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
    } catch {
      // Nothing to do; the wishlist just won't survive a reload.
    }
  }, [wishlist, hydrated]);

  // On sign-in, fold whatever the account already has into the local list.
  useEffect(() => {
    if (!user) return;
    let active = true;

    supabase
      .from('wishlists')
      .select('product_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (!active || error || !data) return;
        setWishlist((prev) => Array.from(new Set([...prev, ...data.map((r) => r.product_id)])));
      });

    return () => {
      active = false;
    };
  }, [user]);

  const toggle = useCallback(
    (id: string) => {
      let nowSaved = false;
      setWishlist((prev) => {
        nowSaved = !prev.includes(id);
        return nowSaved ? [...prev, id] : prev.filter((x) => x !== id);
      });

      if (!user || !UUID.test(id)) return;

      // Best-effort mirror; the local list stays authoritative for the UI.
      if (nowSaved) {
        supabase.from('wishlists').upsert({ user_id: user.id, product_id: id }).then(({ error }) => {
          if (error) console.warn('Wishlist save failed:', error.message);
        });
      } else {
        supabase
          .from('wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', id)
          .then(({ error }) => {
            if (error) console.warn('Wishlist removal failed:', error.message);
          });
      }
    },
    [user]
  );

  return { wishlist, toggle };
}
