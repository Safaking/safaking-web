'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Safa Raja — SafaKing's 3D groom — and the butterfly he can't take his eyes
 * off.
 *
 * The character is the owner's rendered image cut out of its background and
 * split at the chin into two layers (public/hero/safa-raja-head.webp and
 * -body.webp) that overlap across the neck, so the head can turn without a
 * gap opening. His eyes are redrawn in SVG inside the head layer, clipped to
 * the whites of his eyes, so the irises move too. Coordinates below are in
 * the image's own pixels (252 × 714), measured from the image.
 *
 * The butterfly glides after the mouse — easing in, never overshooting — and
 * stays upright, banking a little into turns. His eyes follow the butterfly and he leans slightly
 * toward it. With no mouse (a phone) it flies around his safa on its own; a
 * tap sends it to that spot. One requestAnimationFrame loop writes
 * transforms straight to the elements, so the mouse never re-renders React.
 */

const IMAGE = { head: '/hero/safa-raja-head.webp', body: '/hero/safa-raja-body.webp', width: 252, height: 714 };

/** Where the head turns: the middle of his neck, just under the chin. */
const PIVOT = { x: 131, y: 284 };

/** How far the head goes toward the butterfly. */
const HEAD = { tilt: 7, shiftX: 4, shiftY: 3 };

const EYES = [
  { white: { cx: 97.4, cy: 199.8, rx: 13.2, ry: 11.2 }, iris: { cx: 101, cy: 200, r: 9.4 } },
  { white: { cx: 153.4, cy: 200, rx: 13.4, ry: 11.2 }, iris: { cx: 149.4, cy: 200, r: 9.4 } },
] as const;

/** How far an iris may travel inside its eye, in image pixels. */
const GAZE = { x: 4.2, y: 2.6 };

export function SafaRaja({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLDivElement>(null);
  const headLayer = useRef<HTMLDivElement>(null);
  const butterfly = useRef<HTMLDivElement>(null);
  const leftEye = useRef<SVGEllipseElement>(null);
  const rightEye = useRef<SVGEllipseElement>(null);
  const leftIris = useRef<SVGGElement>(null);
  const rightIris = useRef<SVGGElement>(null);
  const [onScreen, setOnScreen] = useState(true);

  // Only animate while the character is actually visible.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.02 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!onScreen) return;

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 3, steering: false };
    const pos = { x: target.x, y: target.y, vx: 0, vy: 0, angle: 0 };
    const look = { tilt: 0, x: 0, y: 0 };
    const startedAt = performance.now();
    let last = startedAt;
    let frame = 0;

    const steer = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      target.steering = true;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') steer(e);
    };
    const onLeave = () => {
      target.steering = false;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', steer, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

    const tick = (now: number) => {
      const box = wrap.current?.getBoundingClientRect();
      const left = leftEye.current?.getBoundingClientRect();
      const right = rightEye.current?.getBoundingClientRect();

      if (box) {
        let tx = target.x;
        let ty = target.y;
        if (!target.steering) {
          // Free flight: a lazy figure-of-eight above and around his safa,
          // wide enough that it never parks in front of his face.
          const t = (now - startedAt) / 1000;
          const cx = box.left + box.width / 2;
          const cy = box.top + box.height * 0.04;
          tx = cx + Math.sin(t * 0.6) * Math.max(box.width * 1.6, 150) + Math.sin(t * 2.1) * 12;
          ty = cy + Math.abs(Math.sin(t * 1.2)) * box.height * 0.14 + Math.cos(t * 2.6) * 8;
        }

        // Glides to the target and slows as it arrives — no spring, so it
        // never overshoots and swings back like a bouncing ball. Scaled by
        // the frame time so it moves the same on 60 Hz and 120 Hz screens.
        const dt = Math.min(64, now - last);
        last = now;
        const ease = 1 - Math.pow(1 - (reduce ? 0.35 : 0.085), dt / 16.67);
        const nx = pos.x + (tx - pos.x) * ease;
        const ny = pos.y + (ty - pos.y) * ease;
        pos.vx = nx - pos.x;
        pos.vy = ny - pos.y;
        pos.x = nx;
        pos.y = ny;

        // A small flutter on top, so it drifts like a butterfly, not a cursor.
        const t = (now - startedAt) / 1000;
        const flyX = pos.x + (reduce ? 0 : Math.sin(t * 6.1) * 1.6);
        const flyY = pos.y + (reduce ? 0 : Math.sin(t * 4.3) * 2.4);

        // Stays upright and only banks a little into sideways movement.
        const bank = Math.max(-18, Math.min(18, pos.vx * 1.6));
        pos.angle += (bank - pos.angle) * 0.12;
        if (butterfly.current) {
          butterfly.current.style.transform = `translate3d(${flyX - 32}px, ${flyY - 32}px, 0) rotate(${pos.angle}deg)`;
        }

        const aim = (eye: DOMRect | undefined, iris: SVGGElement | null) => {
          if (!eye || !iris) return;
          const dx = flyX - (eye.left + eye.width / 2);
          const dy = flyY - (eye.top + eye.height / 2);
          const distance = Math.hypot(dx, dy) || 1;
          const reach = Math.min(1, distance / 160);
          iris.setAttribute(
            'transform',
            `translate(${((dx / distance) * GAZE.x * reach).toFixed(2)} ${((dy / distance) * GAZE.y * reach).toFixed(2)})`
          );
        };
        aim(left, leftIris.current);
        aim(right, rightIris.current);

        // The head turns toward the butterfly: tilts, and shifts a little
        // toward it, easing so it follows rather than snaps. The pivot is the
        // neck, so the chin stays over the collar.
        const scale = box.height / IMAGE.height;
        const pivotX = box.left + PIVOT.x * scale;
        const pivotY = box.top + PIVOT.y * scale;
        const hx = flyX - pivotX;
        const hy = flyY - pivotY;
        const clamp = (v: number) => Math.max(-1, Math.min(1, v));
        const follow = reduce ? 1 : 1 - Math.pow(1 - 0.08, dt / 16.67);
        look.tilt += (clamp(hx / 260) * HEAD.tilt - look.tilt) * follow;
        look.x += (clamp(hx / 300) * HEAD.shiftX - look.x) * follow;
        look.y += (clamp((hy + 120) / 300) * HEAD.shiftY - look.y) * follow;
        if (headLayer.current) {
          headLayer.current.style.transform = reduce
            ? 'none'
            : `translate(${(look.x * scale).toFixed(2)}px, ${(look.y * scale).toFixed(2)}px) rotate(${look.tilt.toFixed(2)}deg)`;
        }

        // And the whole figure leans a touch the same way, pivoting at his feet.
        if (figure.current) {
          const lean = reduce ? 0 : clamp(hx / 400) * 1.2;
          figure.current.style.transform = `rotate(${lean.toFixed(2)}deg)`;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', steer);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [onScreen, reduce]);

  const irisRefs = [leftIris, rightIris];
  const eyeRefs = [leftEye, rightEye];

  return (
    <div ref={wrap} className={`relative ${className}`}>
      {/* Ground shadow */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-1.5%] left-1/2 h-[4%] w-[120%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(74,13,24,0.38),rgba(74,13,24,0))]"
      />

      <div ref={figure} className="absolute inset-0 will-change-transform" style={{ transformOrigin: '50% 100%' }}>
        <Image
          src={IMAGE.body}
          alt="Safa Raja, SafaKing's cartoon groom in a pink bandhani safa and maroon velvet sherwani"
          fill
          priority
          draggable={false}
          sizes="(max-width: 1024px) 40vw, 220px"
          className="select-none object-contain object-bottom"
        />

        <div
          ref={headLayer}
          className="absolute inset-0 will-change-transform"
          style={{ transformOrigin: `${(PIVOT.x / IMAGE.width) * 100}% ${(PIVOT.y / IMAGE.height) * 100}%` }}
        >
        <Image
          src={IMAGE.head}
          alt=""
          fill
          priority
          draggable={false}
          sizes="(max-width: 1024px) 40vw, 220px"
          className="select-none object-contain object-bottom"
        />

        {/* His eyes, redrawn so they can move */}
        <svg
          viewBox={`0 0 ${IMAGE.width} ${IMAGE.height}`}
          preserveAspectRatio="xMidYMax meet"
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <defs>
            <radialGradient id="sr3-white" cx="0.5" cy="0.62" r="0.62">
              <stop offset="0" stopColor="#FBF3EE" />
              <stop offset="0.75" stopColor="#EADBD2" />
              <stop offset="1" stopColor="#CDB4A6" />
            </radialGradient>
            <radialGradient id="sr3-iris" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#1A120C" />
              <stop offset="0.5" stopColor="#1A120C" />
              <stop offset="0.58" stopColor="#6E4E33" />
              <stop offset="0.8" stopColor="#8C6B4B" />
              <stop offset="0.93" stopColor="#4A3222" />
              <stop offset="1" stopColor="#2A1C12" />
            </radialGradient>
            <linearGradient id="sr3-lidshade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5A2E1C" stopOpacity="0.4" />
              <stop offset="0.4" stopColor="#5A2E1C" stopOpacity="0" />
            </linearGradient>
            {EYES.map((eye, i) => (
              <clipPath key={i} id={`sr3-eye-${i}`}>
                <ellipse cx={eye.white.cx} cy={eye.white.cy} rx={eye.white.rx} ry={eye.white.ry} />
              </clipPath>
            ))}
          </defs>

          {EYES.map((eye, i) => (
            <g key={i}>
              <ellipse ref={eyeRefs[i]} cx={eye.white.cx} cy={eye.white.cy} rx={eye.white.rx} ry={eye.white.ry} fill="none" />
              <g clipPath={`url(#sr3-eye-${i})`}>
                <ellipse cx={eye.white.cx} cy={eye.white.cy} rx={eye.white.rx} ry={eye.white.ry} fill="url(#sr3-white)" />
                <g ref={irisRefs[i]}>
                  <circle cx={eye.iris.cx} cy={eye.iris.cy} r={eye.iris.r} fill="url(#sr3-iris)" />
                  <circle cx={eye.iris.cx + 3.6} cy={eye.iris.cy - 3.2} r={1.8} fill="#FFFFFF" />
                  <circle cx={eye.iris.cx - 2.6} cy={eye.iris.cy + 2.9} r={0.8} fill="#FFFFFF" opacity="0.7" />
                </g>
                <rect
                  x={eye.white.cx - eye.white.rx}
                  y={eye.white.cy - eye.white.ry}
                  width={eye.white.rx * 2}
                  height={eye.white.ry * 2}
                  fill="url(#sr3-lidshade)"
                />
              </g>
            </g>
          ))}
        </svg>
        </div>
      </div>

      {/* The butterfly flies over the whole page, so it is fixed, not inside the figure */}
      <div
        ref={butterfly}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[60] h-16 w-16 will-change-transform"
        style={{ opacity: onScreen ? 1 : 0, transition: 'opacity 0.3s' }}
      >
        <svg viewBox="0 0 48 48" className="h-full w-full drop-shadow-[0_5px_6px_rgba(74,13,24,0.35)]">
          <defs>
            <linearGradient id="bf-upper" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7A1526" />
              <stop offset="0.55" stopColor="#D23A5A" />
              <stop offset="1" stopColor="#F7B42C" />
            </linearGradient>
            <linearGradient id="bf-lower" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F7B42C" />
              <stop offset="1" stopColor="#C8324F" />
            </linearGradient>
          </defs>
          {[false, true].map((mirrored) => (
            <g key={String(mirrored)} transform={mirrored ? 'translate(48 0) scale(-1 1)' : undefined}>
              <g className="sk-wing">
                <path d="M24 24 C 12 3, 1 9, 4 21 C 6 28, 16 28, 24 24 Z" fill="url(#bf-upper)" />
                <path d="M24 25 C 14 28, 7 38, 12 42 C 17 45, 22 35, 24 25 Z" fill="url(#bf-lower)" />
                <circle cx="10" cy="15" r="2.6" fill="#FDF6EC" opacity="0.9" />
                <circle cx="13" cy="36" r="1.8" fill="#FDF6EC" opacity="0.8" />
              </g>
            </g>
          ))}
          <ellipse cx="24" cy="25" rx="2" ry="9" fill="#2D060E" />
          <path d="M23 16 C 21 10, 18 7, 15 6 M 25 16 C 27 10, 30 7, 33 6" stroke="#2D060E" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
