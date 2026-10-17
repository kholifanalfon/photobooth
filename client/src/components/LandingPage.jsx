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
    <div className="relative flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-br from-pink-100 via-purple-50 to-indigo-100 overflow-hidden select-none p-4 sm:p-8">
      {/* Floating decorative elements */}
      <motion.div
        animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
        className="absolute top-6 left-6 sm:top-12 sm:left-16 text-pink-400 opacity-60 pointer-events-none"
      >
        <Sparkles size={36} className="sm:w-12 sm:h-12" />
      </motion.div>
      <motion.div
        animate={{ y: [0, 25, 0], rotate: [0, -15, 15, 0] }}
        transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
        className="absolute bottom-10 right-6 sm:bottom-20 sm:right-20 text-indigo-400 opacity-60 pointer-events-none"
      >
        <Camera size={44} className="sm:w-14 sm:h-14" />
      </motion.div>

      {/* Main Gift Container */}
      <div className="z-10 flex flex-col items-center max-w-lg w-full text-center px-4 py-6">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-2"
        >
          Capture The Magic! ✨
        </motion.h1>
        <p className="text-slate-600 text-sm sm:text-base md:text-lg mb-6 sm:mb-8 font-medium max-w-md">
          Sentuh tombol untuk membuka kotak hadiah dan memulai sesi fotomu.
        </p>

        {/* Gift Box Graphic */}
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
            animate={isOpen ? { scale: [1, 1.2, 0.9], y: -30 } : { y: [0, -8, 0] }}
            transition={isOpen ? { duration: 0.5 } : { repeat: Infinity, duration: 2.5 }}
            className="w-36 h-36 sm:w-48 sm:h-48 bg-gradient-to-tr from-pink-500 to-rose-400 rounded-3xl shadow-2xl flex items-center justify-center border-4 border-white relative"
          >
            <Gift className="w-18 h-18 sm:w-24 sm:h-24 text-white drop-shadow-md" size={72} />
            {isOpen && (
              <motion.div
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 bg-yellow-300 rounded-full blur-xl"
              />
            )}
          </motion.div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleStart}
          className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600 text-white font-extrabold text-xl sm:text-2xl rounded-full shadow-xl shadow-pink-500/30 transition-all flex items-center justify-center gap-3 border-2 border-white/50 cursor-pointer"
        >
          <Camera size={26} className="sm:w-7 sm:h-7" />
          Mulai Sekarang
        </motion.button>
      </div>
    </div>
  );
}
