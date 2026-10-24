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

const MAROON = '#2D060E';
const GOLD = '#C9A227';
const CREAM = '#F7EFE3';

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

  ctx.fillStyle = MAROON;
  ctx.fillRect(0, 0, W, H);

  const [logo, groom] = await Promise.all([
    loadImage('/logo.png'),
    loadImage('/groom_main.jpg'),
  ]);

  // ── the groom, across the top, fading into the maroon ──────────────────
  const bandH = Math.round(H * 0.3);
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
    fade.addColorStop(0, 'rgba(45,6,14,0)');
    fade.addColorStop(1, MAROON);
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
  ctx.fillStyle = CREAM;
  ctx.font = `700 76px Georgia, 'Times New Roman', serif`;
  ctx.fillText('SAFAKING', W / 2, y);
  y += 34;

  ctx.fillStyle = GOLD;
  ctx.font = `600 24px Helvetica, Arial, sans-serif`;
  ctx.fillText('ROYAL TURBAN HOUSE', W / 2, y);
  y += 58;

  ctx.fillStyle = CREAM;
  ctx.font = `400 30px Helvetica, Arial, sans-serif`;
  ctx.fillText('Scan to get credit off your first order', W / 2, y);
  y += 40;

  // ── the QR, on white, with its quiet zone intact ───────────────────────
  const qrSize = 520;
  const pad = 26;
  const qrX = (W - qrSize) / 2;
  ctx.fillStyle = '#fff';
  ctx.fillRect(qrX - pad, y - pad, qrSize + pad * 2, qrSize + pad * 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrCanvas, qrX, y, qrSize, qrSize);
  ctx.imageSmoothingEnabled = true;
  y += qrSize + pad + 62;

  // ── the code in figures, for anyone who cannot scan ────────────────────
  ctx.fillStyle = GOLD;
  ctx.font = `700 30px Helvetica, Arial, sans-serif`;
  ctx.fillText('OR USE CODE', W / 2, y);
  y += 58;
  ctx.fillStyle = CREAM;
  ctx.font = `700 72px 'Courier New', monospace`;
  ctx.fillText(code, W / 2, y);

  // ── address and number, along the bottom ───────────────────────────────
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, H - 190, W, 4);

  ctx.fillStyle = CREAM;
  ctx.font = `700 34px Helvetica, Arial, sans-serif`;
  ctx.fillText(BUSINESS.phone, W / 2, H - 132);

  ctx.fillStyle = 'rgba(247,239,227,0.65)';
  ctx.font = `400 22px Helvetica, Arial, sans-serif`;
  const lines = wrap(ctx, BUSINESS.address, W - 160).slice(0, 2);
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H - 92 + i * 30));

  ctx.fillStyle = GOLD;
  ctx.font = `600 20px Helvetica, Arial, sans-serif`;
  ctx.fillText('www.safaking.in', W / 2, H - 28);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
