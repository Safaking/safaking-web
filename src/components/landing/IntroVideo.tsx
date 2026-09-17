'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Sparkles, X, RefreshCw, Download, Crown, Sliders, MoveUp, ZoomIn, CheckCircle2, ArrowRight } from 'lucide-react';

interface SafaOverlayOption {
  id: string;
  name: string;
  color: string;
  src: string;
  price: number;
}

const TRYON_SAFAS: SafaOverlayOption[] = [
  { id: 'jodhpuri', name: 'Jodhpuri Neel Zari', color: 'Royal Blue', src: '/tryon/safa-jodhpuri.jpg', price: 50 },
  { id: 'gold', name: 'Sunehri Gold Brocade', color: 'Gold Brocade', src: '/tryon/safa-gold.jpg', price: 50 },
  { id: 'maroon', name: 'Maroon Royal Velvet', color: 'Maroon Zardozi', src: '/tryon/safa-maroon.jpg', price: 50 },
  { id: 'pink', name: 'Rani Pink Chanderi', color: 'Silk Pink', src: '/hero/safa-pink.webp', price: 50 },
  { id: 'banarasi', name: 'Banarasi Brocade', color: 'Classic Maroon', src: '/hero/safa-brocade.webp', price: 50 },
];

/**
 * Replaces the old intro video section with an interactive, real-time Virtual AR Safa Fitting Mirror.
 * Visitors can turn on their camera, try on royal safa styles on their face, adjust fit, and snap photos.
 */
export function IntroVideo() {
  const [selectedSafa, setSelectedSafa] = useState<SafaOverlayOption>(TRYON_SAFAS[0]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Manual fitting controls
  const [positionY, setPositionY] = useState(25); // percentage from top
  const [scale, setScale] = useState(65); // percentage size
  const [rotation, setRotation] = useState(0); // degrees tilt

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Start live webcam camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Camera access denied or unavailable. Click Enable Camera to grant permission.');
      setCameraActive(false);
    }
  }, []);

  // Stop camera when unmounted
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Snap photo & combine camera frame + safa overlay onto canvas
  const handleSnapPhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw video frame (mirrored horizontal)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform

    // Draw Safa overlay image
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = selectedSafa.src;
    img.onload = () => {
      const safaWidth = (canvas.width * scale) / 100;
      const safaHeight = (img.height / img.width) * safaWidth;
      const safaX = (canvas.width - safaWidth) / 2;
      const safaY = (canvas.height * positionY) / 100 - safaHeight * 0.4;

      ctx.save();
      ctx.translate(safaX + safaWidth / 2, safaY + safaHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -safaWidth / 2, -safaHeight / 2, safaWidth, safaHeight);
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/png');
      setCapturedPhoto(dataUrl);
    };
  };

  // Download captured snapshot photo
  const handleDownload = () => {
    if (!capturedPhoto) return;
    const link = document.createElement('a');
    link.href = capturedPhoto;
    link.download = `safaking-virtual-tryon-${selectedSafa.id}.png`;
    link.click();
  };

  // Scroll to booking form
  const handleBookStyle = () => {
    const element = document.getElementById('artist-booking-form');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="virtual-tryon" className="py-20 px-4 sm:px-6 lg:px-8 bg-maroon-950 text-white relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 pattern-diamond opacity-15 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-royal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 space-y-3"
        >
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-royal-500/20 border border-royal-400/30 text-royal-300 text-xs font-bold uppercase tracking-widest">
            <Sparkles size={15} /> Real-Time Virtual Mirror
          </span>
          <h2 className="text-3xl sm:text-5xl font-display font-black text-royal-100 uppercase tracking-wider">
            Meet SafaKing — <span className="text-gradient-gold italic">Try On Your Crown</span>
          </h2>
          <p className="text-royal-200/70 text-sm max-w-xl mx-auto leading-relaxed">
            Turn on your camera and try on royal safas on your face in real-time. Choose your favourite style, adjust the fit, and snap your look!
          </p>
        </motion.div>

        {/* Main AR Virtual Fitting Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/60 border border-royal-400/30 bg-maroon-900 flex flex-col"
        >
          {/* Camera Viewport Area */}
          <div className="relative aspect-[4/3] sm:aspect-[16/9] w-full bg-black flex items-center justify-center overflow-hidden">
            {capturedPhoto ? (
              /* Photo Preview Mode */
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={capturedPhoto} alt="Captured Safa Look" className="max-h-full object-contain" />
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={() => setCapturedPhoto(null)}
                    className="px-3.5 py-2 rounded-xl bg-black/70 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 border border-white/20 hover:bg-black/90"
                  >
                    <RefreshCw size={14} /> Retake
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 rounded-xl bg-royal-500 text-maroon-950 text-xs font-black flex items-center gap-1.5 shadow-lg hover:bg-royal-400"
                  >
                    <Download size={14} /> Save Photo
                  </button>
                </div>
              </div>
            ) : cameraActive ? (
              /* Live Camera + AR Safa Overlay */
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />

                {/* AR Safa Turban Floating Overlay */}
                <div
                  className="absolute pointer-events-none transition-all duration-75"
                  style={{
                    top: `${positionY}%`,
                    left: '50%',
                    transform: `translate(-50%, -50%) scale(${scale / 100}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    width: '340px',
                  }}
                >
                  <Image
                    src={selectedSafa.src}
                    alt={selectedSafa.name}
                    width={400}
                    height={400}
                    className="w-full h-auto object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,0.7)]"
                    priority
                  />
                </div>

                {/* Snap Camera Button */}
                <button
                  onClick={handleSnapPhoto}
                  className="absolute bottom-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full bg-royal-500 hover:bg-royal-400 text-maroon-950 font-black text-xs uppercase tracking-widest shadow-2xl flex items-center gap-2 border-2 border-white/40 active:scale-95 transition-transform"
                >
                  <Camera size={16} /> Snap My Safa Look
                </button>
              </div>
            ) : (
              /* Camera Activation Screen */
              <div className="p-8 sm:p-12 text-center max-w-md flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-royal-500/20 border border-royal-400/40 text-royal-300 flex items-center justify-center mb-4 shadow-xl">
                  <Camera size={36} />
                </div>
                <h3 className="font-display font-bold text-xl text-white mb-2">Virtual Safa Camera Fitting</h3>
                <p className="text-xs text-royal-200/70 mb-6 leading-relaxed">
                  Turn on your camera to see how Jodhpuri, Velvet, Gold & Silk Safas look on your face in real-time.
                </p>
                <button
                  onClick={startCamera}
                  className="px-7 py-3.5 rounded-full bg-royal-500 hover:bg-royal-400 text-maroon-950 font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 transition-transform hover:scale-105"
                >
                  <Camera size={16} /> Enable Camera AR Try-On
                </button>
                {cameraError && (
                  <p className="text-xs text-rose-300 font-medium mt-4 bg-rose-950/60 p-2.5 rounded-xl border border-rose-500/40">
                    {cameraError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Bottom Fitting Controls & Style Selector Bar */}
          <div className="p-4 sm:p-6 bg-maroon-950 border-t border-royal-400/20 space-y-4">
            {/* Quick Fitting Sliders */}
            {!capturedPhoto && cameraActive && (
              <div className="grid grid-cols-3 gap-3 bg-white/5 p-3 rounded-2xl border border-white/10 text-xs text-royal-200">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-royal-300 flex items-center gap-1">
                    <MoveUp size={11} /> Position Y
                  </span>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    value={positionY}
                    onChange={(e) => setPositionY(Number(e.target.value))}
                    className="accent-royal-400 h-1.5 bg-white/20 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-royal-300 flex items-center gap-1">
                    <ZoomIn size={11} /> Size Scale
                  </span>
                  <input
                    type="range"
                    min="35"
                    max="100"
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="accent-royal-400 h-1.5 bg-white/20 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-royal-300 flex items-center gap-1">
                    <Sliders size={11} /> Tilt Angle
                  </span>
                  <input
                    type="range"
                    min="-25"
                    max="25"
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="accent-royal-400 h-1.5 bg-white/20 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Safa Style Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-royal-300 uppercase tracking-widest">Select Safa Style to Try On</p>
                <span className="text-xs font-bold text-royal-400">{selectedSafa.name}</span>
              </div>
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none]">
                {TRYON_SAFAS.map((safa) => (
                  <button
                    key={safa.id}
                    onClick={() => setSelectedSafa(safa)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border shrink-0 transition-all ${
                      selectedSafa.id === safa.id
                        ? 'bg-royal-500 text-maroon-950 border-royal-400 font-bold shadow-lg shadow-royal-500/20 scale-105'
                        : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                    }`}
                  >
                    <span className="w-7 h-7 rounded-full overflow-hidden bg-black/20 shrink-0 relative">
                      <Image src={safa.src} alt={safa.name} fill className="object-cover" />
                    </span>
                    <span className="text-xs font-bold whitespace-nowrap">{safa.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CTA Action */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
              <span className="text-xs text-royal-200/70">
                Found your look? Book our master artist to tie it on your wedding day!
              </span>
              <button
                onClick={handleBookStyle}
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-royal-500 hover:bg-royal-400 text-maroon-950 font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 shrink-0 transition-transform active:scale-95"
              >
                <Crown size={15} /> Book Artist For This Style <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
