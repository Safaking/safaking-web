import { BUSINESS } from '@/lib/business';

/**
 * The referral QR as a sheet somebody can actually put up.
 *
 * A bare QR PNG is useless on a wall: nothing on it says whose it is, what
 * scanning it gets you, or who to ring. This draws an A4 poster around the
 * code — the shop's name and mark, a groom in a safa, the code in figures,
 * and the address and number along the bottom.
 *
 * Drawn at 150dpi rather than 300. A4 at 300dpi is 2480×3508, which comes out
 * around 8MB and takes long enough on a mid-range phone to look broken; 150dpi
 * prints perfectly well for a poster read from arm's length.
 */

const DPI = 150;
const W = Math.round(8.27 * DPI); // 1240
const H = Math.round(11.69 * DPI); // 1754

// The home screen's own palette: a cream page, gold rules, maroon type.
// The poster read as a different shop in dark maroon.
const CREAM = '#FDF6EC';      // royal-50, the page
const CREAM_WARM = '#F9EBD4'; // royal-100
const GOLD = '#C9A227';       // royal-500
const GOLD_DEEP = '#A8841F';  // royal-600
const MAROON = '#4A0D18';     // maroon-900, the type
const MAROON_DEEP = '#2D060E';// maroon-950
const PLAY_URL = 'play.google.com/store/apps/details?id=in.safaking.app';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    // A missing picture must not cost the shop its poster — the QR, the code
    // and the phone number are what matter, and they are drawn either way.
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Wrap text to a width, since canvas will happily run it off the page. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * @param code    the referral code, printed and encoded
 * @param qrCanvas the already-rendered QR, reused rather than redrawn so the
 *                 poster cannot disagree with what is on screen
 */
export async function buildReferPoster(
  code: string,
  qrCanvas: HTMLCanvasElement
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // The page, warming towards the foot like the home screen does.
  const page = ctx.createLinearGradient(0, 0, 0, H);
  page.addColorStop(0, CREAM);
  page.addColorStop(1, CREAM_WARM);
  ctx.fillStyle = page;
  ctx.fillRect(0, 0, W, H);

  const [logo, groom] = await Promise.all([
    loadImage('/logo.png'),
    loadImage('/groom_main.jpg'),
  ]);

  // The mark, very faint and very large behind everything — the same trick the
  // hero plays with the word SAFA. Drawn before anything else so it never
  // competes with the QR, which has to stay readable above all.
  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.06;
    const mw = W * 1.15;
    const mh = (logo.height / logo.width) * mw;
    ctx.drawImage(logo, (W - mw) / 2, H * 0.34, mw, mh);
    ctx.restore();
  }

  // ── the groom, across the top, fading into the maroon ──────────────────
  const bandH = Math.round(H * 0.27);
  if (groom) {
    // Clipped to the band. Covering the width means a tall photograph is
    // scaled far past the band's height, and without this it ran down the
    // whole sheet with the name, the code and the QR sitting on top of it.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, bandH);
    ctx.clip();
    const scale = Math.max(W / groom.width, bandH / groom.height);
    const dw = groom.width * scale;
    const dh = groom.height * scale;
    // Anchored to the top: the face is the part worth keeping.
    ctx.drawImage(groom, (W - dw) / 2, 0, dw, dh);
    const fade = ctx.createLinearGradient(0, bandH * 0.45, 0, bandH);
    fade.addColorStop(0, 'rgba(253,246,236,0)');
    fade.addColorStop(1, CREAM);
    ctx.fillStyle = fade;
    ctx.fillRect(0, bandH * 0.45, W, bandH * 0.55 + 2);
    ctx.restore();
  }

  // ── mark and name ──────────────────────────────────────────────────────
  let y = bandH + 40;
  if (logo) {
    const lw = 150;
    const lh = (logo.height / logo.width) * lw;
    ctx.drawImage(logo, (W - lw) / 2, y, lw, lh);
    y += lh + 28;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = MAROON_DEEP;
  ctx.font = `700 76px Georgia, 'Times New Roman', serif`;
  ctx.fillText('SAFAKING', W / 2, y);
  y += 34;

  ctx.fillStyle = GOLD_DEEP;
  ctx.font = `600 24px Helvetica, Arial, sans-serif`;
  ctx.fillText('ROYAL TURBAN HOUSE', W / 2, y);
  y += 58;

  ctx.fillStyle = MAROON;
  ctx.font = `400 30px Helvetica, Arial, sans-serif`;
  ctx.fillText('Scan to get credit off your first order', W / 2, y);
  y += 40;

  // ── the QR, on white, with its quiet zone intact ───────────────────────
  // Sized so the code below it clears the foot. At 520 the code landed
  // inside the maroon band and was sliced in half.
  const qrSize = 440;
  const pad = 26;
  const qrX = (W - qrSize) / 2;
  ctx.fillStyle = '#fff';
  ctx.fillRect(qrX - pad, y - pad, qrSize + pad * 2, qrSize + pad * 2);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(qrX - pad, y - pad, qrSize + pad * 2, qrSize + pad * 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrCanvas, qrX, y, qrSize, qrSize);
  ctx.imageSmoothingEnabled = true;
  y += qrSize + pad + 54;

  // ── the code in figures, for anyone who cannot scan ────────────────────
  ctx.fillStyle = GOLD_DEEP;
  ctx.font = `700 30px Helvetica, Arial, sans-serif`;
  ctx.fillText('OR USE CODE', W / 2, y);
  y += 56;
  ctx.fillStyle = MAROON_DEEP;
  ctx.font = `700 72px 'Courier New', monospace`;
  ctx.fillText(code, W / 2, y);

  // ── address and number, along the bottom ───────────────────────────────
  // A maroon foot, so the cream page ends on the shop's own colour.
  const footH = 250;
  ctx.fillStyle = MAROON_DEEP;
  ctx.fillRect(0, H - footH, W, footH);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, H - footH, W, 5);

  ctx.fillStyle = CREAM;
  ctx.font = `700 36px Helvetica, Arial, sans-serif`;
  ctx.fillText(BUSINESS.phone, W / 2, H - footH + 56);

  ctx.fillStyle = 'rgba(253,246,236,0.6)';
  ctx.font = `400 21px Helvetica, Arial, sans-serif`;
  const lines = wrap(ctx, BUSINESS.address, W - 180).slice(0, 2);
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H - footH + 94 + i * 28));

  // Both ways in, spelled out: somebody reading this off a wall cannot click.
  ctx.fillStyle = GOLD;
  ctx.font = `700 26px Helvetica, Arial, sans-serif`;
  ctx.fillText('www.safaking.in', W / 2, H - footH + 168);

  ctx.fillStyle = 'rgba(253,246,236,0.55)';
  ctx.font = `400 19px Helvetica, Arial, sans-serif`;
  ctx.fillText(`Android app · ${PLAY_URL}`, W / 2, H - footH + 204);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
