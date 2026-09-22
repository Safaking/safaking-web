'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, RefreshCw, Share2, Crown, Upload, Move, RotateCcw, Maximize2,
  AlertCircle, Loader2, ArrowRight,
} from 'lucide-react';

export interface SafaOverlayOption {
  id: string;
  name: string;
  color: string;
  src: string;
  /** Must match a style in SAFA_STYLES (ArtistsSection) — it drives the booking form. */
  bookingStyle: 'Rounded' | 'Jodhpuri' | 'Barati Safa';
}

/**
 * Every source here is a cut-out with real transparency. The earlier
 * /tryon/*.jpg files were studio photos on a white sweep, so as an overlay
 * they painted a white square across the customer's face.
 */
export const TRYON_SAFAS: SafaOverlayOption[] = [
  { id: 'jodhpuri', name: 'Jodhpuri Neel Zari', color: 'Royal Blue', src: '/tryon/safa-jodhpuri.webp', bookingStyle: 'Jodhpuri' },
  { id: 'gold', name: 'Sunehri Gold Brocade', color: 'Gold Brocade', src: '/tryon/safa-gold.webp', bookingStyle: 'Jodhpuri' },
  { id: 'maroon', name: 'Maroon Royal Velvet', color: 'Maroon Zardozi', src: '/tryon/safa-maroon.webp', bookingStyle: 'Rounded' },
  { id: 'pink', name: 'Rani Pink Chanderi', color: 'Silk Pink', src: '/tryon/safa-pink.webp', bookingStyle: 'Barati Safa' },
  { id: 'banarasi', name: 'Banarasi Brocade', color: 'Classic Maroon', src: '/tryon/safa-brocade.webp', bookingStyle: 'Jodhpuri' },
];

/**
 * Where the safa sits, in fractions of the stage. The live preview and the
 * saved photo both read these, so what the customer lines up is what they get.
 */
interface Fit {
  x: number;
  y: number;
  /** Safa width as a fraction of the stage width. */
  width: number;
  rotation: number;
}

/**
 * A head fills about this much of the frame's height whichever way the stage
 * is shaped, so the opening size is worked out from the height. Sizing it off
 * the width instead left the safa swallowing the whole picture on a wide
 * desktop stage.
 */
const SAFA_HEIGHT_SHARE = 0.55;
const FALLBACK_FIT: Fit = { x: 0.5, y: 0.3, width: 0.74, rotation: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Why the camera would not open, in words a customer can act on. */
function cameraMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera permission is blocked. Allow the camera for this site in your browser settings — or use a photo instead.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera found on this device. Use a photo instead.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Another app is already using the camera. Close it and tap Try Again.';
  }
  if (name === 'NotSupportedError') {
    return 'This browser will not open a camera here — a camera needs a secure (https) connection. Use a photo instead.';
  }
  return 'The camera could not be started. Tap Try Again, or use a photo instead.';
}

export interface SafaFittingStageProps {
  /** The camera is only held while this is true. */
  active: boolean;
  /**
   * Ask for the camera the moment the stage becomes active. The home page
   * leaves this off — a permission prompt nobody asked for is not a welcome.
   */
  autoStart?: boolean;
  /** Fires with the booking style behind the chosen safa. */
  onBookStyle?: (bookingStyle: string) => void;
  /** Sizing for the camera area. */
  stageClassName?: string;
  /** Line of copy beside the booking button. */
  bookingNote?: string;
}

export function SafaFittingStage({
  active,
  autoStart = false,
  onBookStyle,
  stageClassName = 'min-h-[340px] sm:min-h-[420px] flex-1',
  bookingNote,
}: SafaFittingStageProps) {
  const [selectedSafa, setSelectedSafa] = useState<SafaOverlayOption>(TRYON_SAFAS[0]);
  const [source, setSource] = useState<'camera' | 'photo'>('camera');
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'live' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);
  const [fit, setFit] = useState<Fit>(FALLBACK_FIT);
  /** Once the customer has moved anything, the opening size stops overriding it. */
  const fitTouchedRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const photoElRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);
  const wantCameraRef = useRef(false);
  const capturedBlobRef = useRef<Blob | null>(null);

  const defaultFit = useCallback((): Fit => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box?.width) return FALLBACK_FIT;
    return { ...FALLBACK_FIT, width: clamp((SAFA_HEIGHT_SHARE * box.height) / box.width, 0.3, 1.3) };
  }, []);

  const resetFit = useCallback(() => {
    fitTouchedRef.current = false;
    setFit(defaultFit());
  }, [defaultFit]);

  // ---- Camera ---------------------------------------------------------------
  // These two keep a stable identity on purpose. A callback that changes
  // whenever the stream changes re-fires the effect that owns it: the cleanup
  // then runs against a stale closure, tearing the live view down the instant
  // it comes up (and, in the modal, restarting the camera forever).

  const attachStream = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (!el || !streamRef.current) return;
    if (el.srcObject !== streamRef.current) el.srcObject = streamRef.current;
    void el.play().catch(() => {});
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    startingRef.current = false;
    setCameraState((previous) => (previous === 'error' ? previous : 'idle'));
  }, []);

  const startCamera = useCallback(async () => {
    if (startingRef.current || streamRef.current) return;
    startingRef.current = true;
    wantCameraRef.current = true;
    setCameraError(null);
    setCameraState('starting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException('getUserMedia unavailable', 'NotSupportedError');
      }
      let media: MediaStream;
      try {
        media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err) {
        // An ideal size is only a wish, but a fussy front camera can still
        // refuse it — ask again for any camera at all before giving up.
        if (err instanceof DOMException && err.name === 'OverconstrainedError') {
          media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw err;
        }
      }
      if (!wantCameraRef.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = media;
      attachStream(videoRef.current);
      setCameraState('live');
    } catch (err) {
      console.error('Safa fitting camera:', err);
      setCameraError(cameraMessage(err));
      setCameraState('error');
    } finally {
      startingRef.current = false;
    }
  }, [attachStream]);

  // One start per opening, one stop on the way out.
  useEffect(() => {
    if (!active || source !== 'camera') {
      wantCameraRef.current = false;
      stopCamera();
      return;
    }
    if (autoStart) void startCamera();
    return () => {
      wantCameraRef.current = false;
      stopCamera();
    };
  }, [active, autoStart, source, startCamera, stopCamera]);

  // Leaving clears the session: no stale snapshot, no held camera.
  useEffect(() => {
    if (active) return;
    setCapturedPhoto(null);
    capturedBlobRef.current = null;
    fitTouchedRef.current = false;
    setFit(FALLBACK_FIT);
    setSource('camera');
    setCameraState('idle');
    setCameraError(null);
    setSnapError(null);
    setPhotoUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
  }, [active]);

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  // ---- Placing the safa -----------------------------------------------------

  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; fromX: number; fromY: number } | null>(null);

  const onDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!stageRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      fromX: fit.x,
      fromY: fit.y,
    };
  };

  const onDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage || drag.pointerId !== event.pointerId) return;
    const box = stage.getBoundingClientRect();
    fitTouchedRef.current = true;
    setFit((previous) => ({
      ...previous,
      x: clamp(drag.fromX + (event.clientX - drag.startX) / box.width, 0.1, 0.9),
      y: clamp(drag.fromY + (event.clientY - drag.startY) / box.height, 0, 0.95),
    }));
  };

  const onDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  // ---- The snapshot ---------------------------------------------------------

  const overlayCache = useRef(new Map<string, HTMLImageElement>());

  const loadOverlay = useCallback(async (src: string) => {
    const cached = overlayCache.current.get(src);
    if (cached?.complete && cached.naturalWidth > 0) return cached;
    const image = new window.Image();
    // No crossOrigin here: these live on our own origin, so the canvas stays
    // clean either way — and asking in CORS mode makes the CDN return a
    // variant the decoder rejects, which killed Snap on the live site.
    image.src = src;
    await image.decode();
    overlayCache.current.set(src, image);
    return image;
  }, []);

  const handleSnapPhoto = async () => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage || snapping) return;

    const base: HTMLVideoElement | HTMLImageElement | null =
      source === 'camera' ? videoRef.current : photoElRef.current;
    if (!base) return;

    setSnapping(true);
    try {
      // A photo tapped the moment it was chosen may still be decoding.
      if (base instanceof HTMLImageElement && !base.naturalWidth) await base.decode();
      const baseWidth = base instanceof HTMLVideoElement ? base.videoWidth : base.naturalWidth;
      const baseHeight = base instanceof HTMLVideoElement ? base.videoHeight : base.naturalHeight;
      if (!baseWidth || !baseHeight) return;

      const overlay = await loadOverlay(selectedSafa.src);

      // The canvas takes the stage's own shape, so the saved photo is framed
      // exactly like the mirror the customer was looking at.
      const box = stage.getBoundingClientRect();
      const width = 1080;
      const height = Math.round((width * box.height) / box.width) || 1440;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Same crop as CSS object-cover: fill the frame, centre the overflow.
      const cover = Math.max(width / baseWidth, height / baseHeight);
      const drawWidth = baseWidth * cover;
      const drawHeight = baseHeight * cover;
      const drawX = (width - drawWidth) / 2;
      const drawY = (height - drawHeight) / 2;

      ctx.save();
      if (source === 'camera') {
        // The live view is mirrored, the way a real mirror is.
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(base, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();

      const safaWidth = width * fit.width;
      const safaHeight = safaWidth * (overlay.naturalHeight / overlay.naturalWidth);
      ctx.save();
      ctx.translate(width * fit.x, height * fit.y);
      ctx.rotate((fit.rotation * Math.PI) / 180);
      ctx.drawImage(overlay, -safaWidth / 2, -safaHeight / 2, safaWidth, safaHeight);
      ctx.restore();

      setCapturedPhoto(canvas.toDataURL('image/png'));
      canvas.toBlob((blob) => { capturedBlobRef.current = blob; }, 'image/png');
      setSnapError(null);
    } catch (err) {
      console.error('Safa fitting snapshot:', err);
      setSnapError('That photo could not be captured. Please try again.');
    } finally {
      setSnapping(false);
    }
  };

  /**
   * Hands the picture to the phone's own share sheet — where the customer
   * picks who gets it — and falls back to a plain download on a desktop.
   */
  const handleSave = async () => {
    if (!capturedPhoto || saving) return;
    setSaving(true);
    try {
      const fileName = `safaking-${selectedSafa.id}-tryon.png`;

      // Inside the Android app the WebView has neither navigator.share nor
      // downloads, so both web routes below silently did nothing. Write the
      // picture to the app's cache and open Android's real share sheet —
      // WhatsApp, Gallery, Drive — through the native plugins instead.
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const [{ Filesystem, Directory }, { Share }] = await Promise.all([
          import('@capacitor/filesystem'),
          import('@capacitor/share'),
        ]);
        const written = await Filesystem.writeFile({
          path: fileName,
          data: capturedPhoto.slice(capturedPhoto.indexOf(',') + 1),
          directory: Directory.Cache,
        });
        await Share.share({ title: 'My SafaKing look', files: [written.uri], dialogTitle: 'Share your safa look' });
        return;
      }

      const blob = capturedBlobRef.current ?? await (await fetch(capturedPhoto)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });

      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My SafaKing look' });
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      // A share sheet the customer dismissed lands here too — nothing to say.
      const cancelled = (err instanceof DOMException && err.name === 'AbortError')
        || /cancel/i.test(String((err as { message?: string })?.message ?? ''));
      if (!cancelled) {
        console.error('Safa fitting save:', err);
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePickPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Create the URL before clearing the input, and keep the creation out of a
    // state updater — React re-runs updaters, which would leak a second URL.
    const url = URL.createObjectURL(file);
    setPhotoUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return url;
    });
    setCapturedPhoto(null);
    setCameraError(null);
    setSource('photo');
    // Cleared last, and only so that picking the same file again still fires.
    event.target.value = '';
  };

  const handleBookStyle = () => {
    onBookStyle?.(selectedSafa.bookingStyle);
    // The form is further down the same page; let any modal close first.
    requestAnimationFrame(() => {
      document.getElementById('artist-booking-form')?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const fittingReady = !capturedPhoto && (source === 'photo' ? !!photoUrl : cameraState === 'live');
  /** Artists are sent out for baraat safas; a groom's own safa is bought online. */
  const tiedByArtist = selectedSafa.bookingStyle === 'Barati Safa';

  // Size the safa to the stage the first time there is something to fit onto.
  useEffect(() => {
    if (!fittingReady || fitTouchedRef.current) return;
    setFit(defaultFit());
  }, [fittingReady, defaultFit]);

  return (
    <>
      <div
        ref={stageRef}
        className={`relative bg-black flex items-center justify-center overflow-hidden ${stageClassName}`}
      >
        {capturedPhoto ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capturedPhoto} alt="Your safa look" className="w-full h-full object-contain" />
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={() => setCapturedPhoto(null)}
                className="px-3.5 py-2 rounded-xl bg-black/70 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 border border-white/20"
              >
                <RefreshCw size={14} /> Retake
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-royal-500 text-maroon-950 text-xs font-black flex items-center gap-1.5 shadow-lg disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                Save / Share
              </button>
            </div>
          </>
        ) : (
          <>
            {source === 'camera' ? (
              <video ref={attachStream} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
            ) : photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={photoElRef}
                src={photoUrl}
                alt="Your photo"
                onError={() => {
                  setPhotoUrl((previous) => {
                    if (previous) URL.revokeObjectURL(previous);
                    return null;
                  });
                  setSource('camera');
                  setCameraState('error');
                  setCameraError('That picture could not be opened — an iPhone HEIC photo often cannot. Try a JPG or PNG, or use the camera.');
                }}
                className="w-full h-full object-cover"
              />
            ) : null}

            {fittingReady && (
              <div
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
                className="absolute touch-none cursor-grab active:cursor-grabbing"
                style={{
                  left: `${fit.x * 100}%`,
                  top: `${fit.y * 100}%`,
                  width: `${fit.width * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${fit.rotation}deg)`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedSafa.src}
                  alt={selectedSafa.name}
                  draggable={false}
                  className="w-full h-auto select-none drop-shadow-[0_22px_32px_rgba(0,0,0,0.65)]"
                />
              </div>
            )}

            {/* Before the camera is live: an invitation, a wait, or a reason. */}
            {source === 'camera' && cameraState !== 'live' && (
              <div className="absolute inset-0 bg-maroon-950/85 backdrop-blur-sm p-7 text-center flex flex-col items-center justify-center">
                {cameraState === 'starting' ? (
                  <>
                    <Loader2 size={34} className="text-royal-300 animate-spin mb-3" />
                    <p className="text-sm font-bold text-white">Opening the camera…</p>
                    <p className="text-xs text-royal-200/70 mt-1">Allow camera access when your browser asks.</p>
                  </>
                ) : (
                  <>
                    {cameraState === 'error' ? (
                      <AlertCircle size={34} className="text-rose-300 mb-3" />
                    ) : (
                      <span className="w-16 h-16 rounded-full bg-royal-500/20 border border-royal-400/40 text-royal-300 flex items-center justify-center mb-4">
                        <Camera size={30} />
                      </span>
                    )}
                    <p className="text-sm font-bold text-white max-w-sm leading-relaxed">
                      {cameraError || 'Turn on your camera to see how a royal safa looks on you.'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => void startCamera()}
                        className="px-5 py-2.5 rounded-full bg-royal-500 hover:bg-royal-400 text-maroon-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                      >
                        <Camera size={14} /> {cameraState === 'error' ? 'Try Again' : 'Enable Camera'}
                      </button>
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="px-5 py-2.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                      >
                        <Upload size={14} /> Use A Photo
                      </button>
                    </div>
                    <p className="text-[10px] text-royal-200/60 mt-3 max-w-xs">
                      Nothing leaves your phone — the picture is made and kept on your own device.
                    </p>
                  </>
                )}
              </div>
            )}

            {fittingReady && (
              <>
                <span className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 pointer-events-none">
                  <Move size={11} /> Drag the safa onto your head
                </span>
                <button
                  onClick={() => void handleSnapPhoto()}
                  disabled={snapping}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full bg-royal-500 hover:bg-royal-400 text-maroon-950 font-black text-xs uppercase tracking-wider whitespace-nowrap shadow-2xl flex items-center gap-2 border-2 border-white/40 disabled:opacity-70"
                >
                  {snapping ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                  Snap My Safa Look
                </button>
              </>
            )}
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileRef} type="file" accept="image/*" onChange={handlePickPhoto} className="hidden" />

      <div className="p-4 sm:p-5 bg-maroon-950 border-t border-royal-400/20 shrink-0 space-y-3">
        {snapError && (
          <p className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-xs font-medium text-rose-200">
            <AlertCircle size={13} className="shrink-0" /> {snapError}
          </p>
        )}

        {fittingReady && (
          <div className="bg-white/5 p-2.5 rounded-2xl border border-white/10 space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-royal-300 flex items-center gap-1">
                  <Maximize2 size={11} /> Size
                </span>
                <input
                  type="range"
                  min={30}
                  max={130}
                  value={Math.round(fit.width * 100)}
                  onChange={(event) => { fitTouchedRef.current = true; setFit((previous) => ({ ...previous, width: Number(event.target.value) / 100 })); }}
                  className="accent-royal-400 h-1.5 bg-white/20 rounded-lg cursor-pointer"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-royal-300 flex items-center gap-1">
                  <RotateCcw size={11} /> Tilt
                </span>
                <input
                  type="range"
                  min={-30}
                  max={30}
                  value={fit.rotation}
                  onChange={(event) => { fitTouchedRef.current = true; setFit((previous) => ({ ...previous, rotation: Number(event.target.value) })); }}
                  className="accent-royal-400 h-1.5 bg-white/20 rounded-lg cursor-pointer"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button
                onClick={resetFit}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
              >
                <RefreshCw size={11} /> Reset fit
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Upload size={11} /> {source === 'photo' ? 'Change photo' : 'Use a photo'}
                </button>
                {source === 'photo' && (
                  <button
                    onClick={() => { setCapturedPhoto(null); setSource('camera'); }}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Camera size={11} /> Camera
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-royal-300 uppercase tracking-widest">Select safa style to try on</p>
            <span className="text-xs font-bold text-royal-400">{selectedSafa.name}</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {TRYON_SAFAS.map((safa) => (
              <button
                key={safa.id}
                onClick={() => setSelectedSafa(safa)}
                aria-pressed={selectedSafa.id === safa.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 transition-all ${
                  selectedSafa.id === safa.id
                    ? 'bg-royal-500 text-maroon-950 border-royal-400 font-bold shadow-lg'
                    : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                }`}
              >
                <span className="w-7 h-7 rounded-full overflow-hidden bg-black/20 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={safa.src} alt="" className="w-full h-full object-cover" />
                </span>
                <span className="text-xs font-bold whitespace-nowrap">{safa.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <span className="text-xs text-royal-200/70 text-center sm:text-left">
            {bookingNote ?? `Selected: ${selectedSafa.name}`}
          </span>
          <button
            onClick={handleBookStyle}
            className="w-full sm:w-auto px-6 py-3 rounded-full bg-royal-500 hover:bg-royal-400 text-maroon-950 font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 shrink-0"
          >
            <Crown size={15} /> {tiedByArtist ? 'Book Artist For This Style' : 'Buy This Safa Online'} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
