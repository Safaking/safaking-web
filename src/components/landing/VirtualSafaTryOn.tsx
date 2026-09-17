'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, RefreshCw, Download, Share2, Sparkles, Sliders, CheckCircle2, AlertCircle, Crown, ZoomIn, ZoomOut, MoveUp, MoveDown } from 'lucide-react';

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

interface VirtualSafaTryOnProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStyle?: (styleName: string) => void;
}

export function VirtualSafaTryOn({ isOpen, onClose, onSelectStyle }: VirtualSafaTryOnProps) {
  const [selectedSafa, setSelectedSafa] = useState<SafaOverlayOption>(TRYON_SAFAS[0]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Manual fitting controls (position, size, rotation)
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
      setCameraError('Camera access denied or unavailable. You can upload a face photo instead!');
      setCameraActive(false);
    }
  }, []);

  // Stop camera when closed
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCapturedPhoto(null);
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

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

  // Select style & navigate to booking form
  const handleBookStyle = () => {
    onSelectStyle?.(selectedSafa.name.includes('Jodhpuri') ? 'Jodhpuri' : selectedSafa.name.includes('Pink') ? 'Barati Safa' : 'Rounded');
    onClose();
    const element = document.getElementById('artist-booking-form');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-maroon-950/90 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-maroon-900 border border-royal-400/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        >
          {/* Top Bar */}
          <div className="px-5 py-3.5 bg-maroon-950 border-b border-royal-400/20 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-royal-500/20 border border-royal-400/40 text-royal-300 flex items-center justify-center">
                <Sparkles size={16} />
              </span>
              <div>
                <h3 className="font-display font-black text-white text-base leading-none">Virtual Safa Camera Fitting</h3>
                <p className="text-[10px] text-royal-200/70 mt-0.5">Live AR Turban Mirror · Try On Royal Safas</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Camera Viewport Area */}
          <div className="relative flex-1 bg-black min-h-[340px] sm:min-h-[420px] flex items-center justify-center overflow-hidden">
            {capturedPhoto ? (
              /* Photo Preview Mode */
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={capturedPhoto} alt="Captured Safa Look" className="max-h-full object-contain" />
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={() => setCapturedPhoto(null)}
                    className="px-3.5 py-2 rounded-xl bg-black/70 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 border border-white/20"
                  >
                    <RefreshCw size={14} /> Retake
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 rounded-xl bg-royal-500 text-maroon-950 text-xs font-black flex items-center gap-1.5 shadow-lg"
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
                    width: '320px',
                  }}
                >
                  <Image
                    src={selectedSafa.src}
                    alt={selectedSafa.name}
                    width={400}
                    height={400}
                    className="w-full h-auto object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)]"
                    priority
                  />
                </div>

                {/* Snap Camera Button */}
                <button
                  onClick={handleSnapPhoto}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full bg-royal-500 hover:bg-royal-400 text-maroon-950 font-black text-xs uppercase tracking-widest shadow-2xl flex items-center gap-2 border-2 border-white/40"
                >
                  <Camera size={16} /> Snap My Safa Look
                </button>
              </div>
            ) : (
              /* Camera Permission / Error Fallback */
              <div className="p-8 text-center max-w-md">
                <Camera size={44} className="mx-auto text-royal-400/60 mb-3" />
                <p className="text-sm font-bold text-white mb-2">{cameraError || 'Starting Camera...'}</p>
                <button
                  onClick={startCamera}
                  className="mt-3 px-5 py-2.5 rounded-full bg-royal-500 text-maroon-950 text-xs font-bold uppercase tracking-wider"
                >
                  Enable Camera
                </button>
              </div>
            )}
          </div>

          {/* Hidden Canvas for Capturing Snapshot */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Bottom Fitting Controls & Safa Carousel */}
          <div className="p-4 bg-maroon-950 border-t border-royal-400/20 shrink-0 space-y-3">
            {/* Quick Adjustment Sliders */}
            {!capturedPhoto && cameraActive && (
              <div className="grid grid-cols-3 gap-2 bg-white/5 p-2.5 rounded-2xl border border-white/10 text-xs text-royal-200">
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

            {/* Safa Selection Carousel */}
            <div>
              <p className="text-[10px] font-bold text-royal-300 uppercase tracking-widest mb-2">Select Safa Style to Try On</p>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                {TRYON_SAFAS.map((safa) => (
                  <button
                    key={safa.id}
                    onClick={() => setSelectedSafa(safa)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 transition-all ${
                      selectedSafa.id === safa.id
                        ? 'bg-royal-500 text-maroon-950 border-royal-400 font-bold shadow-lg'
                        : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full overflow-hidden bg-black/20 shrink-0 relative">
                      <Image src={safa.src} alt={safa.name} fill className="object-cover" />
                    </span>
                    <span className="text-xs whitespace-nowrap">{safa.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CTA Action Bar */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-white text-xs font-bold">
                <span>Selected: <span className="text-royal-300">{selectedSafa.name}</span></span>
              </div>
              <button
                onClick={handleBookStyle}
                className="px-5 py-2.5 rounded-xl bg-royal-500 hover:bg-royal-400 text-maroon-950 font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-1.5"
              >
                <Crown size={14} /> Book Artist For This Style
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
