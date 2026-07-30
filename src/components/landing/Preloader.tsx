'use client';

import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';

export function Preloader() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ 
        opacity: 0,
        scale: 1.03,
        transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } 
      }}
      className="fixed inset-0 z-50 bg-maroon-950 flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Decorative background grid pattern */}
      <div className="absolute inset-0 pattern-diamond opacity-20 pointer-events-none" />

      {/* Royal ambient gold glow */}
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.3, 0.15]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[400px] h-[400px] bg-royal-400/20 rounded-full blur-3xl pointer-events-none"
      />

      <div className="relative flex flex-col items-center">
        {/* Safa Wrapping Ring Animations */}
        <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
          {/* Inner ring - rotating clockwise */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border-2 border-dashed border-royal-400/30"
          />

          {/* Middle ring - rotating counter-clockwise */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-2 rounded-full border border-double border-royal-300/40"
          />

          {/* Outer pulsing ring */}
          <motion.div
            animate={{ 
              scale: [1, 1.15, 1],
              opacity: [0.4, 0.8, 0.4]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -inset-4 rounded-full border border-royal-500/20"
          />

          {/* Glowing Crown Icon */}
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              filter: ["drop-shadow(0 0 8px rgba(201, 162, 39, 0.4))", "drop-shadow(0 0 20px rgba(201, 162, 39, 0.8))", "drop-shadow(0 0 8px rgba(201, 162, 39, 0.4))"]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-14 h-14 rounded-full bg-royal-gradient flex items-center justify-center shadow-lg shadow-royal-500/20"
          >
            <Crown size={28} className="text-maroon-950 stroke-[2.5]" />
          </motion.div>
        </div>

        {/* Text / Branding */}
        <div className="text-center mb-6">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="font-display font-black text-3xl tracking-[0.25em] text-gradient-gold uppercase"
          >
            SafaKing
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="text-[10px] tracking-[0.4em] text-royal-200 uppercase mt-1.5 font-bold"
          >
            Royal Turban House
          </motion.p>
        </div>

        {/* Custom Progress Bar */}
        <div className="w-48 h-[3px] bg-white/10 rounded-full overflow-hidden relative border border-white/5">
          <motion.div
            initial={{ left: "-100%" }}
            animate={{ left: "100%" }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-royal-400 to-transparent"
          />
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.2, ease: "easeInOut" }}
            className="absolute top-0 bottom-0 left-0 bg-royal-500 shadow-md shadow-royal-400/50"
          />
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="text-[9px] text-royal-300/50 uppercase tracking-[0.2em] mt-3 font-semibold"
        >
          Wrapping Turban Styles...
        </motion.p>
      </div>
    </motion.div>
  );
}
