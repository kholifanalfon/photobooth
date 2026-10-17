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
    <div className="relative flex flex-col items-center justify-center min-h-screen w-full bg-slate-50 overflow-hidden select-none p-4 sm:p-8">
      {/* Decorative accent icons (Flat monochrome) */}
      <motion.div
        animate={{ y: [0, -12, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        className="absolute top-6 left-6 sm:top-12 sm:left-16 text-rose-300 pointer-events-none"
      >
        <Sparkles size={32} className="sm:w-10 sm:h-10" />
      </motion.div>
      <motion.div
        animate={{ y: [0, 15, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
        className="absolute bottom-10 right-6 sm:bottom-16 sm:right-16 text-slate-300 pointer-events-none"
      >
        <Camera size={40} className="sm:w-12 sm:h-12" />
      </motion.div>

      {/* Main Container without card wrapper */}
      <div className="z-10 flex flex-col items-center max-w-lg w-full text-center px-4 py-6">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-2"
        >
          Capture The Magic! ✨
        </motion.h1>
        <p className="text-slate-500 text-sm sm:text-base md:text-lg mb-8 sm:mb-10 font-normal max-w-md">
          Sentuh tombol untuk membuka kotak hadiah dan memulai sesi fotomu.
        </p>

        {/* Gift Box Graphic (Flat Solid) */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Buka Kotak Hadiah"
          className="relative mb-8 sm:mb-10 cursor-pointer focus:outline-none"
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
            className="w-36 h-36 sm:w-44 sm:h-44 bg-rose-500 rounded-3xl flex items-center justify-center relative shadow-sm"
          >
            <Gift className="w-18 h-18 sm:w-22 sm:h-22 text-white" size={72} />
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

        {/* CTA Button (Flat Solid) */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStart}
          className="w-full sm:w-auto px-8 sm:px-12 py-3.5 sm:py-4 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-bold text-lg sm:text-xl rounded-xl transition-colors flex items-center justify-center gap-2.5 cursor-pointer shadow-sm"
        >
          <Camera size={22} className="sm:w-6 sm:h-6" />
          Mulai Sekarang
        </motion.button>
      </div>
    </div>
  );
}
