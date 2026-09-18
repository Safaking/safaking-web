'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { useBackHandler } from '@/lib/native-app';
import { SafaFittingStage } from './SafaFittingStage';

interface VirtualSafaTryOnProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStyle?: (styleName: string) => void;
}

/**
 * The full-screen version of the safa mirror, opened from the hero. The
 * fitting itself lives in SafaFittingStage, shared with the home page section
 * so the two can never drift apart again.
 */
export function VirtualSafaTryOn({ isOpen, onClose, onSelectStyle }: VirtualSafaTryOnProps) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const requestClose = useCallback(() => closeRef.current(), []);

  // The Android hardware back button closes the mirror, not the page.
  useBackHandler(isOpen, requestClose);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, requestClose]);

  const handleBookStyle = (bookingStyle: string) => {
    onSelectStyle?.(bookingStyle);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-maroon-950/90 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-label="Virtual Safa Camera Fitting"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-maroon-900 border border-royal-400/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
          >
            <div className="px-5 py-3.5 bg-maroon-950 border-b border-royal-400/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-royal-500/20 border border-royal-400/40 text-royal-300 flex items-center justify-center">
                  <Sparkles size={16} />
                </span>
                <div>
                  <h3 className="font-display font-black text-white text-base leading-none">Virtual Safa Camera Fitting</h3>
                  <p className="text-[10px] text-royal-200/70 mt-0.5">Drag the safa onto your head · Try on royal safas</p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <SafaFittingStage
              active={isOpen}
              autoStart
              onBookStyle={handleBookStyle}
              stageClassName="flex-1 min-h-[340px] sm:min-h-[420px]"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
