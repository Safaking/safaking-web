'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Crown } from 'lucide-react';

/**
 * Sits right after the trust bar and before the artists/catalogue sections —
 * visitors have just landed and seen the value props, so this is where a
 * short brand story earns its place, before asking for a purchase decision.
 */
export function IntroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-maroon-950 relative overflow-hidden">
      <div className="absolute inset-0 pattern-diamond opacity-10" />
      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 space-y-3"
        >
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-royal-500/20 border border-royal-400/30 text-royal-300 text-xs font-bold uppercase tracking-widest">
            <Crown size={15} /> Our Story
          </span>
          <h2 className="text-3xl sm:text-5xl font-display font-black text-royal-100 uppercase tracking-wider">
            Meet SafaKing
          </h2>
          <p className="text-royal-200/70 text-sm max-w-xl mx-auto leading-relaxed">
            A minute with the craft, the artists, and the royal tradition behind every safa.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/40 border border-royal-400/20 group"
        >
          <video
            ref={videoRef}
            src="/videos/intro.mp4"
            className="w-full aspect-video max-h-[70vh] bg-black object-contain"
            playsInline
            loop
            muted={muted}
            preload="metadata"
            onClick={togglePlay}
          />

          {!playing && (
            <button
              onClick={togglePlay}
              aria-label="Play video"
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors"
            >
              <span className="w-20 h-20 rounded-full bg-royal-gradient flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                <Play size={30} className="text-maroon-950 ml-1" fill="currentColor" />
              </span>
            </button>
          )}

          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              onClick={togglePlay}
              aria-label={playing ? 'Pause video' : 'Play video'}
              className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
            >
              {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
            <button
              onClick={toggleMute}
              aria-label={muted ? 'Unmute video' : 'Mute video'}
              className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
