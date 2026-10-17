import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Camera, Gift } from 'lucide-react';
import { audioFx } from '../utils/audioEffects.js';

export default function LandingPage({ onStartSession }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleStart = () => {
    if (isOpen) return;
    if (audioFx && typeof audioFx.playGiftPopSound === 'function') {
      audioFx.playGiftPopSound();
    }
    setIsOpen(true);
    setTimeout(() => {
      if (typeof onStartSession === 'function') {
        onStartSession();
      }
    }, 800);
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[100dvh] h-auto w-full bg-slate-50 overflow-x-hidden select-none p-4 sm:p-8">
      {/* Decorative accent icons (Flat monochrome) */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        className="absolute top-4 left-4 sm:top-10 sm:left-12 text-rose-300 pointer-events-none"
      >
        <Sparkles size={28} className="sm:w-9 sm:h-9" />
      </motion.div>
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
        className="absolute bottom-6 right-4 sm:bottom-12 sm:right-12 text-slate-300 pointer-events-none"
      >
        <Camera size={32} className="sm:w-10 sm:h-10" />
      </motion.div>

      {/* Main Container without card wrapper */}
      <div className="z-10 flex flex-col items-center max-w-lg w-full text-center px-4 py-4 sm:py-6 my-auto">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-2"
        >
          Capture The Magic! ✨
        </motion.h1>
        <p className="text-slate-500 text-xs sm:text-base md:text-lg mb-6 sm:mb-8 font-normal max-w-md">
          Sentuh tombol untuk membuka kotak hadiah dan memulai sesi fotomu.
        </p>

        {/* Gift Box Graphic (Flat Solid) */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Buka Kotak Hadiah"
          className="relative mb-6 sm:mb-8 cursor-pointer focus:outline-none"
          onClick={handleStart}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleStart();
            }
          }}
        >
          <motion.div
            animate={isOpen ? { scale: [1, 1.15, 0.95], y: -20 } : { y: [0, -6, 0] }}
            transition={isOpen ? { duration: 0.5 } : { repeat: Infinity, duration: 2.5 }}
            className="w-32 h-32 sm:w-40 sm:h-40 bg-rose-500 rounded-3xl flex items-center justify-center relative shadow-sm"
          >
            <Gift className="w-16 h-16 sm:w-20 sm:h-20 text-white" size={64} />
            {isOpen && (
              <motion.div
                initial={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 bg-rose-300 rounded-3xl"
              />
            )}
          </motion.div>
        </div>

        {/* Compact CTA Button (Flat Solid) */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStart}
          className="px-6 sm:px-8 py-2.5 sm:py-3 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-bold text-sm sm:text-base rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <Camera size={18} className="sm:w-5 sm:h-5" />
          Mulai Sekarang
        </motion.button>
      </div>
    </div>
  );
}
