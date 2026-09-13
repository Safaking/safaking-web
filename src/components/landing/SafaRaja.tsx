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
          // Free flight: a lazy figure-of-eight above and around his safa,
          // wide enough that it never parks in front of his face.
          const t = (now - startedAt) / 1000;
          const cx = box.left + box.width / 2;
          const cy = box.top + box.height * 0.06;
          tx = cx + Math.sin(t * 0.6) * box.width * 0.78 + Math.sin(t * 2.1) * 12;
          ty = cy + Math.abs(Math.sin(t * 1.2)) * box.height * 0.16 + Math.cos(t * 2.6) * 8;
        }

        const pull = reduce ? 0.3 : 0.07;
        const drag = reduce ? 0.45 : 0.84;
        pos.vx = (pos.vx + (tx - pos.x) * pull) * drag;
        pos.vy = (pos.vy + (ty - pos.y) * pull) * drag;
        pos.x += pos.vx;
        pos.y += pos.vy;

        // Stays upright and only banks a little into sideways movement.
        // Turning it to face its direction of travel flipped it upside down
        // whenever it flew downward, and snapped it back when it slowed.
        const bank = Math.max(-22, Math.min(22, pos.vx * 2.2));
        pos.angle += (bank - pos.angle) * 0.15;

        if (butterfly.current) {
          butterfly.current.style.transform = `translate3d(${pos.x - 32}px, ${pos.y - 32}px, 0) rotate(${pos.angle}deg)`;
        }

        const look = (eye: DOMRect | undefined, pupil: SVGGElement | null) => {
          if (!eye || !pupil) return;
          const dx = pos.x - (eye.left + eye.width / 2);
          const dy = pos.y - (eye.top + eye.height / 2);
          const distance = Math.hypot(dx, dy) || 1;
          const reach = Math.min(1, distance / 150) * 11;
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
        viewBox="0 0 400 600"
        role="img"
        aria-label="Safa Raja, SafaKing's cartoon groom in a bandhani safa, watching a butterfly"
        className="h-full w-full overflow-visible"
      >
        <defs>
          <radialGradient id="sr-skin" cx="0.38" cy="0.3" r="0.9">
            <stop offset="0" stopColor="#FFE4C4" />
            <stop offset="0.55" stopColor="#F2BA86" />
            <stop offset="1" stopColor="#C98350" />
          </radialGradient>
          <linearGradient id="sr-safa" x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#F4566F" />
            <stop offset="0.5" stopColor="#D22A4E" />
            <stop offset="1" stopColor="#8A1230" />
          </linearGradient>
          <linearGradient id="sr-fold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FF8A9C" />
            <stop offset="0.45" stopColor="#E23B5C" />
            <stop offset="1" stopColor="#A5183C" />
          </linearGradient>
          <pattern id="sr-bandhani" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
            <circle cx="3" cy="3" r="1.5" fill="#FFF3D6" />
            <circle cx="9.5" cy="9.5" r="1.5" fill="#FFD36B" />
          </pattern>
          <linearGradient id="sr-coat" x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor="#B02A45" />
            <stop offset="0.55" stopColor="#7A1526" />
            <stop offset="1" stopColor="#4A0D18" />
          </linearGradient>
          <linearGradient id="sr-sleeve" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5E1020" />
            <stop offset="0.5" stopColor="#8E1C33" />
            <stop offset="1" stopColor="#5E1020" />
          </linearGradient>
          <linearGradient id="sr-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFEAB0" />
            <stop offset="0.5" stopColor="#DDB247" />
            <stop offset="1" stopColor="#9C7415" />
          </linearGradient>
          <linearGradient id="sr-churidar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#E3D3B4" />
            <stop offset="0.5" stopColor="#FFF9EE" />
            <stop offset="1" stopColor="#D2BF9B" />
          </linearGradient>
          <linearGradient id="sr-sash" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFD56A" />
            <stop offset="1" stopColor="#E89A12" />
          </linearGradient>
          <radialGradient id="sr-iris" cx="0.42" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#9A6532" />
            <stop offset="1" stopColor="#3A1F0D" />
          </radialGradient>
          <radialGradient id="sr-white" cx="0.45" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#E9DDCD" />
          </radialGradient>
          <radialGradient id="sr-ground" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#4A0D18" stopOpacity="0.4" />
            <stop offset="1" stopColor="#4A0D18" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Where he stands */}
        <ellipse cx="200" cy="586" rx="130" ry="18" fill="url(#sr-ground)" />

        {/* Legs */}
        <path d="M168 468 C 163 510, 165 540, 170 566 L 197 566 C 199 536, 199 506, 197 468 Z" fill="url(#sr-churidar)" />
        <path d="M203 468 C 201 506, 201 536, 203 566 L 230 566 C 235 540, 237 510, 232 468 Z" fill="url(#sr-churidar)" />
        <path d="M171 534 C 181 539, 189 539, 196 534 M 171 547 C 181 552, 189 552, 196 547 M 204 534 C 212 539, 221 539, 229 534 M 204 547 C 212 552, 221 552, 229 547" stroke="#C9B48C" strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* Mojari with curled toes */}
        <path d="M198 561 C 184 559, 166 559, 151 565 C 139 570, 135 578, 146 581 C 163 584, 189 583, 199 578 Z" fill="url(#sr-gold)" />
        <path d="M151 565 C 141 561, 135 554, 140 547" stroke="#9C7415" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <path d="M202 561 C 216 559, 234 559, 249 565 C 261 570, 265 578, 254 581 C 237 584, 211 583, 201 578 Z" fill="url(#sr-gold)" />
        <path d="M249 565 C 259 561, 265 554, 260 547" stroke="#9C7415" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <path d="M156 570 C 170 567, 184 567, 194 569 M 206 569 C 216 567, 230 567, 244 570" stroke="#FFF3D6" strokeWidth="2" opacity="0.6" fill="none" strokeLinecap="round" />

        {/* Sherwani */}
        <path d="M150 336 C 131 344, 125 380, 127 420 C 129 446, 123 470, 116 490 L 284 490 C 277 470, 271 446, 273 420 C 275 380, 269 344, 250 336 C 232 328, 168 328, 150 336 Z" fill="url(#sr-coat)" />
        <path d="M158 352 C 147 384, 147 432, 154 472" stroke="#E05D72" strokeWidth="12" opacity="0.28" fill="none" strokeLinecap="round" />
        <path d="M118 481 L 282 481" stroke="url(#sr-gold)" strokeWidth="10" strokeLinecap="round" />
        <path d="M200 342 L 200 484" stroke="url(#sr-gold)" strokeWidth="8" />
        {[370, 398, 426, 454].map((y) => (
          <circle key={y} cx="200" cy={y} r="5.5" fill="#FFF3D6" stroke="#9C7415" strokeWidth="1.5" />
        ))}
        {[[160, 424], [240, 424], [164, 458], [236, 458]].map(([x, y]) => (
          <path
            key={`${x}-${y}`}
            d={`M${x} ${y - 9} C ${x + 7} ${y - 2}, ${x + 7} ${y + 2}, ${x} ${y + 9} C ${x - 7} ${y + 2}, ${x - 7} ${y - 2}, ${x} ${y - 9} Z`}
            fill="url(#sr-gold)"
          />
        ))}
        {/* Dupatta across the chest */}
        <path d="M144 340 C 176 380, 222 432, 262 488 L 284 480 C 248 424, 202 370, 170 332 Z" fill="url(#sr-sash)" />
        <path d="M150 344 C 182 384, 228 436, 268 490" stroke="#C8324F" strokeWidth="3" fill="none" strokeDasharray="1 7" strokeLinecap="round" />
        {/* Collar and mala */}
        <path d="M170 330 C 183 344, 217 344, 230 330 L 225 318 C 212 327, 188 327, 175 318 Z" fill="url(#sr-gold)" />
        <path d="M156 350 C 170 404, 230 404, 244 350" fill="none" stroke="#FFF8EA" strokeWidth="7" strokeDasharray="0.1 11" strokeLinecap="round" />
        <path d="M165 348 C 177 390, 223 390, 235 348" fill="none" stroke="#2F9E62" strokeWidth="6" strokeDasharray="0.1 10" strokeLinecap="round" />

        {/* Arms and hands, in front of the coat */}
        <path d="M134 346 C 110 370, 103 420, 110 458 L 138 460 C 138 426, 143 392, 156 370 Z" fill="url(#sr-sleeve)" />
        <path d="M266 346 C 290 370, 297 420, 290 458 L 262 460 C 262 426, 257 392, 244 370 Z" fill="url(#sr-sleeve)" />
        <path d="M110 455 L 139 457 M 261 457 L 290 455" stroke="url(#sr-gold)" strokeWidth="7" strokeLinecap="round" />
        <ellipse cx="124" cy="474" rx="16" ry="18" fill="url(#sr-skin)" />
        <ellipse cx="276" cy="474" rx="16" ry="18" fill="url(#sr-skin)" />
        <path d="M116 480 C 122 486, 130 486, 134 480 M 266 480 C 270 486, 278 486, 284 480" stroke="#B8723F" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7" />

        <g ref={head} style={{ transformBox: 'fill-box', transformOrigin: '50% 92%' }}>
          {/* Pench — the safa's tail, behind him */}
          <path d="M276 172 C 300 218, 306 282, 294 338 C 280 302, 272 252, 260 194 Z" fill="url(#sr-safa)" />
          <path d="M276 172 C 300 218, 306 282, 294 338 C 280 302, 272 252, 260 194 Z" fill="url(#sr-bandhani)" opacity="0.55" />
          <path d="M292 330 C 298 300, 300 262, 290 226" stroke="url(#sr-gold)" strokeWidth="4" fill="none" strokeLinecap="round" />

          {/* Neck, ears, face */}
          <path d="M178 294 L 222 294 L 227 334 C 212 343, 188 343, 173 334 Z" fill="#D38F58" />
          <ellipse cx="114" cy="246" rx="16" ry="23" fill="url(#sr-skin)" />
          <ellipse cx="286" cy="246" rx="16" ry="23" fill="url(#sr-skin)" />
          <circle cx="112" cy="268" r="6" fill="url(#sr-gold)" />
          <circle cx="288" cy="268" r="6" fill="url(#sr-gold)" />
          <ellipse cx="200" cy="238" rx="88" ry="91" fill="url(#sr-skin)" />
          <ellipse cx="200" cy="176" rx="82" ry="22" fill="#8A4A22" opacity="0.16" />
          <ellipse cx="140" cy="278" rx="19" ry="11" fill="#F0677A" opacity="0.3" />
          <ellipse cx="260" cy="278" rx="19" ry="11" fill="#F0677A" opacity="0.3" />

          {/* Brows */}
          <path d="M138 197 C 151 185, 172 184, 186 192" stroke="#3A2016" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M214 192 C 228 184, 249 185, 262 197" stroke="#3A2016" strokeWidth="8" strokeLinecap="round" fill="none" />

          {/* Eyes — the pupils are moved by the animation loop */}
          <ellipse ref={leftEye} cx="165" cy="237" rx="27" ry="31" fill="url(#sr-white)" stroke="#3A2016" strokeWidth="3" />
          <ellipse ref={rightEye} cx="235" cy="237" rx="27" ry="31" fill="url(#sr-white)" stroke="#3A2016" strokeWidth="3" />
          <g ref={leftPupil}>
            <circle cx="165" cy="239" r="16" fill="url(#sr-iris)" />
            <circle cx="165" cy="239" r="8.5" fill="#140904" />
            <circle cx="171.5" cy="231.5" r="5.2" fill="#FFFFFF" />
            <circle cx="159.5" cy="246" r="2.3" fill="#FFFFFF" opacity="0.85" />
          </g>
          <g ref={rightPupil}>
            <circle cx="235" cy="239" r="16" fill="url(#sr-iris)" />
            <circle cx="235" cy="239" r="8.5" fill="#140904" />
            <circle cx="241.5" cy="231.5" r="5.2" fill="#FFFFFF" />
            <circle cx="229.5" cy="246" r="2.3" fill="#FFFFFF" opacity="0.85" />
          </g>
          <ellipse className="sk-blink" cx="165" cy="237" rx="30" ry="34" fill="#F2BA86" />
          <ellipse className="sk-blink" cx="235" cy="237" rx="30" ry="34" fill="#F2BA86" />

          {/* Nose, moustache, smile, tilak */}
          <path d="M200 254 C 190 270, 192 282, 206 282" stroke="#B8723F" strokeWidth="5" strokeLinecap="round" fill="none" />
          <ellipse cx="205" cy="268" rx="6" ry="4" fill="#FFFFFF" opacity="0.28" />
          <path
            d="M200 293 C 186 283, 162 282, 146 297 C 138 305, 126 303, 124 295 C 122 309, 140 319, 158 310 C 174 303, 188 305, 200 307 C 212 305, 226 303, 242 310 C 260 319, 278 309, 276 295 C 274 303, 262 305, 254 297 C 238 282, 214 283, 200 293 Z"
            fill="#3A2016"
          />
          <path d="M158 298 C 174 291, 190 293, 198 298 M 202 298 C 210 293, 226 291, 242 298" stroke="#7A5842" strokeWidth="2.5" fill="none" opacity="0.7" strokeLinecap="round" />
          <path d="M182 319 C 194 332, 206 332, 218 319 C 210 324, 190 324, 182 319 Z" fill="#8B2F2A" />
          <path d="M200 186 L 200 204" stroke="#D2263F" strokeWidth="6" strokeLinecap="round" />
          <circle cx="200" cy="209" r="3.2" fill="#F7B42C" />

          {/* Safa — a full bandhani turban with folds */}
          <path d="M92 196 C 76 120, 126 46, 200 42 C 274 46, 324 120, 308 196 C 284 174, 244 164, 200 166 C 156 164, 116 174, 92 196 Z" fill="url(#sr-safa)" />
          <path d="M92 196 C 76 120, 126 46, 200 42 C 274 46, 324 120, 308 196 C 284 174, 244 164, 200 166 C 156 164, 116 174, 92 196 Z" fill="url(#sr-bandhani)" opacity="0.5" />
          <path d="M96 178 C 140 140, 220 118, 302 150 C 306 162, 306 172, 304 182 C 232 152, 150 166, 100 196 Z" fill="url(#sr-fold)" />
          <path d="M104 132 C 150 96, 228 84, 292 108 C 298 118, 300 126, 300 136 C 236 112, 160 118, 108 150 Z" fill="url(#sr-fold)" />
          <path d="M126 88 C 170 62, 232 58, 276 76 C 282 84, 284 90, 284 98 C 238 80, 176 84, 130 106 Z" fill="url(#sr-fold)" />
          <path d="M96 178 C 140 140, 220 118, 302 150 C 306 162, 306 172, 304 182 C 232 152, 150 166, 100 196 Z" fill="url(#sr-bandhani)" opacity="0.35" />
          <path d="M104 132 C 150 96, 228 84, 292 108 C 298 118, 300 126, 300 136 C 236 112, 160 118, 108 150 Z" fill="url(#sr-bandhani)" opacity="0.35" />
          <path d="M100 196 C 150 166, 232 152, 304 182 M 108 150 C 160 118, 236 112, 300 136 M 130 106 C 176 84, 238 80, 284 98" stroke="#6E0E2A" strokeWidth="4" fill="none" opacity="0.4" strokeLinecap="round" />
          <path d="M94 190 C 146 160, 254 160, 306 190" stroke="url(#sr-gold)" strokeWidth="10" fill="none" strokeLinecap="round" />
          <path d="M138 68 C 168 52, 214 48, 248 56" stroke="#FFFFFF" strokeWidth="6" fill="none" opacity="0.35" strokeLinecap="round" />
          {/* Turra — the fan */}
          <path d="M256 66 C 300 16, 364 34, 360 108 C 338 96, 312 90, 282 94 Z" fill="url(#sr-fold)" />
          <path d="M256 66 C 300 16, 364 34, 360 108 C 338 96, 312 90, 282 94 Z" fill="url(#sr-bandhani)" opacity="0.4" />
          <path d="M256 66 C 300 16, 364 34, 360 108" stroke="url(#sr-gold)" strokeWidth="5" fill="none" strokeLinecap="round" />
          {/* Pearl strings, brooch and kalgi */}
          {[-1, 1].map((side) => (
            <path
              key={side}
              d={`M${200 + side * 18} 138 C ${200 + side * 48} 160, ${200 + side * 72} 160, ${200 + side * 96} 146`}
              stroke="#FFF8EA"
              strokeWidth="5.5"
              strokeDasharray="0.1 9"
              strokeLinecap="round"
              fill="none"
            />
          ))}
          <path d="M204 112 C 196 66, 216 30, 244 8 C 232 44, 226 74, 216 114 Z" fill="#FFF8EA" />
          <path d="M208 108 C 208 74, 220 46, 240 18" stroke="#E4B872" strokeWidth="2.5" fill="none" />
          <ellipse cx="200" cy="136" rx="18" ry="24" fill="url(#sr-gold)" />
          <ellipse cx="200" cy="136" rx="9.5" ry="13" fill="#1E8A55" />
          <ellipse cx="197" cy="131" rx="3" ry="4.5" fill="#FFFFFF" opacity="0.6" />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={188 + i * 6} cy={164} r={2.6} fill="#FFF8EA" />
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
