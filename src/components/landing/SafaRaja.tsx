'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Safa Raja — SafaKing's own cartoon groom — and the butterfly he can't take
 * his eyes off.
 *
 * The butterfly chases the mouse on a spring, so it flutters after the
 * pointer rather than sticking to it. Safa Raja's pupils and head follow the
 * butterfly, not the mouse. With no mouse (a phone) or once the pointer leaves
 * the window, the butterfly wanders around him on its own; a tap sends it to
 * that spot.
 *
 * Everything runs in one requestAnimationFrame loop that writes transforms
 * straight to the elements, so moving the mouse never re-renders React.
 */
export function SafaRaja({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const butterfly = useRef<HTMLDivElement>(null);
  const head = useRef<SVGGElement>(null);
  const leftEye = useRef<SVGEllipseElement>(null);
  const rightEye = useRef<SVGEllipseElement>(null);
  const leftPupil = useRef<SVGGElement>(null);
  const rightPupil = useRef<SVGGElement>(null);
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
    const startedAt = performance.now();
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
      const headBox = head.current?.getBoundingClientRect();

      if (box) {
        let tx = target.x;
        let ty = target.y;
        if (!target.steering) {
          // Free flight: a lazy figure-of-eight around his head.
          const t = (now - startedAt) / 1000;
          const cx = box.left + box.width / 2;
          const cy = box.top + box.height * 0.3;
          tx = cx + Math.sin(t * 0.6) * box.width * 0.62 + Math.sin(t * 2.1) * 14;
          ty = cy + Math.sin(t * 1.2) * box.height * 0.22 + Math.cos(t * 2.6) * 10;
        }

        const pull = reduce ? 0.3 : 0.07;
        const drag = reduce ? 0.45 : 0.84;
        pos.vx = (pos.vx + (tx - pos.x) * pull) * drag;
        pos.vy = (pos.vy + (ty - pos.y) * pull) * drag;
        pos.x += pos.vx;
        pos.y += pos.vy;

        // Face the way it's flying; settle upright when hovering.
        const speed = Math.hypot(pos.vx, pos.vy);
        const heading = speed > 0.8 ? (Math.atan2(pos.vy, pos.vx) * 180) / Math.PI + 90 : 0;
        const turn = ((heading - pos.angle + 540) % 360) - 180;
        pos.angle += turn * 0.12;

        if (butterfly.current) {
          butterfly.current.style.transform = `translate3d(${pos.x - 32}px, ${pos.y - 32}px, 0) rotate(${pos.angle}deg)`;
        }

        const look = (eye: DOMRect | undefined, pupil: SVGGElement | null) => {
          if (!eye || !pupil) return;
          const dx = pos.x - (eye.left + eye.width / 2);
          const dy = pos.y - (eye.top + eye.height / 2);
          const distance = Math.hypot(dx, dy) || 1;
          const reach = Math.min(1, distance / 140) * 10;
          pupil.setAttribute('transform', `translate(${((dx / distance) * reach).toFixed(2)} ${((dy / distance) * reach * 0.85).toFixed(2)})`);
        };
        look(left, leftPupil.current);
        look(right, rightPupil.current);

        if (head.current && headBox) {
          const dx = pos.x - (headBox.left + headBox.width / 2);
          const dy = pos.y - (headBox.top + headBox.height / 2);
          const tilt = reduce ? 0 : Math.max(-8, Math.min(8, dx / 55));
          const nod = reduce ? 0 : Math.max(-6, Math.min(6, dy / 70));
          head.current.style.transform = `translate(0px, ${nod.toFixed(2)}px) rotate(${tilt.toFixed(2)}deg)`;
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

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <svg
        viewBox="0 0 400 480"
        role="img"
        aria-label="Safa Raja, SafaKing's cartoon groom in a maroon safa, watching a butterfly"
        className="h-full w-full overflow-visible drop-shadow-[0_30px_35px_rgba(74,13,24,0.28)]"
      >
        <defs>
          <linearGradient id="sr-safa" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#D23A5A" />
            <stop offset="1" stopColor="#7A1526" />
          </linearGradient>
          <linearGradient id="sr-turra" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F07A8E" />
            <stop offset="1" stopColor="#C8324F" />
          </linearGradient>
          <linearGradient id="sr-coat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8B1E2F" />
            <stop offset="1" stopColor="#4A0D18" />
          </linearGradient>
          <radialGradient id="sr-skin" cx="0.45" cy="0.38" r="0.75">
            <stop offset="0" stopColor="#F8D0A4" />
            <stop offset="1" stopColor="#D79660" />
          </radialGradient>
        </defs>

        <ellipse cx="200" cy="472" rx="130" ry="9" fill="#4A0D18" opacity="0.18" />

        {/* Sherwani */}
        <path d="M88 474 C 92 386, 130 340, 200 334 C 270 340, 308 386, 312 474 Z" fill="url(#sr-coat)" />
        <path d="M200 340 L 200 474" stroke="#C9A227" strokeWidth="9" />
        {[366, 398, 430, 462].map((y) => (
          <circle key={y} cx="200" cy={y} r="5" fill="#F0D5A8" />
        ))}
        <path d="M112 474 C 118 420, 132 392, 150 376" stroke="#C9A227" strokeWidth="5" fill="none" opacity="0.7" />
        <path d="M288 474 C 282 420, 268 392, 250 376" stroke="#C9A227" strokeWidth="5" fill="none" opacity="0.7" />
        <path d="M146 352 C 166 414, 234 414, 254 352" fill="none" stroke="#FDF6EC" strokeWidth="6" strokeDasharray="0.1 11" strokeLinecap="round" />
        <path d="M156 350 C 172 396, 228 396, 244 350" fill="none" stroke="#2F8F5B" strokeWidth="5" strokeDasharray="0.1 10" strokeLinecap="round" />

        <g ref={head} style={{ transformBox: 'fill-box', transformOrigin: '50% 85%' }}>
          {/* Neck, ears, face */}
          <rect x="176" y="300" width="48" height="48" rx="16" fill="#CF8C57" />
          <ellipse cx="108" cy="244" rx="16" ry="23" fill="#DDA06C" />
          <ellipse cx="292" cy="244" rx="16" ry="23" fill="#DDA06C" />
          <circle cx="106" cy="262" r="5" fill="#C9A227" />
          <circle cx="294" cy="262" r="5" fill="#C9A227" />
          <ellipse cx="200" cy="240" rx="94" ry="100" fill="url(#sr-skin)" />
          <ellipse cx="138" cy="276" rx="17" ry="10" fill="#E8646A" opacity="0.22" />
          <ellipse cx="262" cy="276" rx="17" ry="10" fill="#E8646A" opacity="0.22" />

          {/* Brows */}
          <path d="M138 206 C 150 196, 170 195, 184 202" stroke="#3A2016" strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M216 202 C 230 195, 250 196, 262 206" stroke="#3A2016" strokeWidth="7" strokeLinecap="round" fill="none" />

          {/* Eyes — the pupils are moved by the animation loop */}
          <ellipse ref={leftEye} cx="163" cy="236" rx="24" ry="27" fill="#FFFDF8" />
          <ellipse ref={rightEye} cx="237" cy="236" rx="24" ry="27" fill="#FFFDF8" />
          <g ref={leftPupil}>
            <circle cx="163" cy="238" r="12.5" fill="#2A150E" />
            <circle cx="168" cy="232" r="4" fill="#FFFFFF" />
          </g>
          <g ref={rightPupil}>
            <circle cx="237" cy="238" r="12.5" fill="#2A150E" />
            <circle cx="242" cy="232" r="4" fill="#FFFFFF" />
          </g>
          <ellipse className="sk-blink" cx="163" cy="236" rx="26" ry="29" fill="#E4A874" />
          <ellipse className="sk-blink" cx="237" cy="236" rx="26" ry="29" fill="#E4A874" />

          {/* Nose, moustache, smile */}
          <path d="M200 250 C 193 266, 195 276, 207 276" stroke="#B0703F" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path
            d="M200 288 C 186 278, 162 277, 146 292 C 138 300, 128 298, 126 290 C 124 304, 140 312, 156 304 C 172 298, 186 300, 200 302 C 214 300, 228 298, 244 304 C 260 312, 276 304, 274 290 C 272 298, 262 300, 254 292 C 238 277, 214 278, 200 288 Z"
            fill="#3A2016"
          />
          <path d="M180 318 C 192 328, 208 328, 220 318" stroke="#8B3A2E" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M200 182 L 200 198" stroke="#C8324F" strokeWidth="5" strokeLinecap="round" />

          {/* Pench — the safa's tail, down his left */}
          <path d="M104 192 C 80 242, 82 306, 94 350 C 112 316, 118 262, 124 204 Z" fill="#A8233D" />
          <path d="M100 222 C 92 262, 92 300, 98 332" stroke="#C9A227" strokeWidth="4" fill="none" opacity="0.8" />

          {/* Safa */}
          <path d="M94 196 C 84 120, 132 60, 200 56 C 268 60, 316 120, 306 196 C 280 176, 240 168, 200 170 C 160 168, 120 176, 94 196 Z" fill="url(#sr-safa)" />
          <path d="M126 88 L 172 176 M 164 66 L 216 170 M 210 60 L 258 160 M 252 72 L 290 150" stroke="#5A0E18" strokeWidth="7" opacity="0.28" strokeLinecap="round" />
          <path d="M98 182 C 150 156, 250 156, 302 182" stroke="#F0D5A8" strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M108 140 C 158 112, 244 112, 294 142" stroke="#C9A227" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.9" />
          {/* Turra — the fan on top */}
          <path d="M246 74 C 290 28, 352 48, 346 118 C 326 104, 300 98, 272 102 Z" fill="url(#sr-turra)" />
          <path d="M246 74 C 290 28, 352 48, 346 118" stroke="#C9A227" strokeWidth="5" fill="none" strokeLinecap="round" />
          {/* Kalgi — brooch and feather */}
          <path d="M202 104 C 196 64, 214 32, 240 14 C 230 46, 224 74, 214 106 Z" fill="#FDF6EC" />
          <path d="M206 100 C 206 70, 218 44, 236 22" stroke="#E4B872" strokeWidth="2.5" fill="none" />
          <ellipse cx="200" cy="126" rx="17" ry="23" fill="#C9A227" />
          <ellipse cx="200" cy="126" rx="9" ry="12" fill="#1E7A4C" />
          {[-1, 1].map((side) => (
            <path
              key={side}
              d={`M${200 + side * 17} 128 C ${200 + side * 46} 150, ${200 + side * 70} 150, ${200 + side * 92} 138`}
              stroke="#FDF6EC"
              strokeWidth="5"
              strokeDasharray="0.1 9"
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </g>
      </svg>

      {/* The butterfly flies over the whole page, so it is fixed, not inside the SVG */}
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
