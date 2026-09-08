'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker, Polyline } from 'leaflet';

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  kind: 'artist' | 'venue';
  sub?: string;
}

/**
 * A live map, on OpenStreetMap tiles via Leaflet.
 *
 * Deliberately not Google Maps: the JavaScript Maps API is billed per load,
 * and this screen is left open all day during a wedding season. OSM tiles are
 * free and good enough to answer the only question being asked — how far is
 * the artist from the venue.
 *
 * Leaflet touches `window` at import time, so it is imported inside the
 * effect rather than at module scope, and this component must be mounted
 * through `next/dynamic` with `ssr: false`.
 */
export function LiveMap({ points, height = 320 }: { points: MapPoint[]; height?: number }) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const drawn = useRef<(Marker | Polyline)[]>([]);
  const observer = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !holder.current) return;

      if (!map.current) {
        map.current = L.map(holder.current, { scrollWheelZoom: false }).setView([26.9124, 75.7873], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(map.current);

        // Leaflet measures its container once, at creation. Inside a panel
        // that is still laying out (or was hidden behind a tab) it measures
        // near-zero and renders a thin strip of tiles with the markers off
        // to one side, so re-measure as soon as the box has real dimensions
        // and on every resize after that.
        requestAnimationFrame(() => map.current?.invalidateSize());
        setTimeout(() => map.current?.invalidateSize(), 250);

        if (typeof ResizeObserver !== 'undefined') {
          observer.current = new ResizeObserver(() => map.current?.invalidateSize());
          observer.current.observe(holder.current);
        }
      }

      drawn.current.forEach((layer) => layer.remove());
      drawn.current = [];

      if (points.length === 0) return;

      const pin = (kind: MapPoint['kind']) =>
        L.divIcon({
          className: '',
          html: `<div style="
            width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
            background:${kind === 'artist' ? '#059669' : '#8B1E2F'};
            border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);
            display:flex;align-items:center;justify-content:center;">
            <span style="transform:rotate(45deg);color:#fff;font-size:12px;font-weight:700">
              ${kind === 'artist' ? '🎨' : '📍'}
            </span></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 26],
        });

      points.forEach((p) => {
        const marker = L.marker([p.lat, p.lng], { icon: pin(p.kind) })
          .addTo(map.current!)
          .bindPopup(`<b>${p.label}</b>${p.sub ? `<br/>${p.sub}` : ''}`);
        drawn.current.push(marker);
      });

      // Artist to venue, so the gap between them is the first thing you see.
      const artist = points.find((p) => p.kind === 'artist');
      const venue = points.find((p) => p.kind === 'venue');
      if (artist && venue) {
        drawn.current.push(
          L.polyline([[artist.lat, artist.lng], [venue.lat, venue.lng]], {
            color: '#8B1E2F', weight: 2, dashArray: '6 6', opacity: 0.7,
          }).addTo(map.current!)
        );
      }

      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.current.invalidateSize();
      map.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    })();

    return () => { cancelled = true; };
  }, [points]);

  useEffect(() => () => {
    observer.current?.disconnect();
    observer.current = null;
    map.current?.remove();
    map.current = null;
  }, []);

  return (
    <div
      ref={holder}
      style={{ height }}
      className="w-full rounded-2xl overflow-hidden border border-amber-200/70 bg-royal-50 z-0"
    />
  );
}
