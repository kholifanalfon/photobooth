import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Sparkles } from 'lucide-react';

export default function SplashScreen({ onFinish }) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: 'easeInOut' }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-rose-50 via-white to-pink-50 select-none"
    >
      {/* Centered Brand Icon */}
      <div className="relative flex items-center justify-center mb-6">
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.15, 0.4] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="absolute w-32 h-32 rounded-3xl bg-rose-400 blur-xl"
        />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="relative z-10 w-24 h-24 rounded-3xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-2xl shadow-rose-300 border-2 border-white/80"
        >
          <Camera className="w-12 h-12 text-white drop-shadow-md" />
        </motion.div>
      </div>

      {/* Brand Text */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-center space-y-1.5"
      >
        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-2">
          <span>Photobooth</span>
          <Sparkles className="w-5 h-5 text-amber-400" />
        </h1>
        <p className="text-xs text-slate-500 font-medium tracking-wide">
          Memuat sistem photobooth offline-ready...
        </p>
      </motion.div>

      {/* Subtle Progress Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 w-44 h-1.5 bg-rose-100 rounded-full overflow-hidden"
      >
        <motion.div
          animate={{ x: ['-100%', '100%'] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
          className="w-1/2 h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full"
        />
      </motion.div>
    </motion.div>
  );
}
