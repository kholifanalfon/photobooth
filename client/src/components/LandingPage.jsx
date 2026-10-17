
export function getYoutubeEmbedUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  if (match && match[1]) {
    const videoId = match[1];
    const originParam = typeof window !== 'undefined' && window.location && window.location.origin
      ? `&origin=${encodeURIComponent(window.location.origin)}`
      : '';
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=1&playsinline=1&enablejsapi=1${originParam}`;
  }
  return null;
}
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Camera, Gift, SlidersHorizontal, Heart, Play, AlertCircle } from 'lucide-react';
import { audioFx } from '../utils/audioEffects.js';
import LandingConfigDrawer, { THEME_PRESETS } from './LandingConfigDrawer.jsx';

const LOCAL_STORAGE_KEY = 'photobooth_landing_config';

const DEFAULT_CONFIG = {
  title: 'Capture The Magic! ✨',
  subtitle: 'Sentuh tombol untuk membuka kotak hadiah dan memulai sesi fotomu.',
  videoUrl: '',
  enableVideo: false,
  theme: 'general',
  isTitleCustom: false,
  isSubtitleCustom: false
};

export default function LandingPage({ onStartSession }) {
  const videoElemRef = useRef(null);
  const iframeRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [ytError, setYtError] = useState(null);
  const [config, setConfig] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
        }
      } catch (e) {
        console.warn('Failed to parse landing config from localStorage', e);
      }
    }
    return DEFAULT_CONFIG;
  });

  const activeTheme = THEME_PRESETS[config.theme] || THEME_PRESETS.general;

  const handleUpdateConfig = (updates) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn('Failed to save landing config to localStorage', e);
        }
      }
      return next;
    });
  };

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


  useEffect(() => {
    setYtError(null);
    if (!config.enableVideo || !config.videoUrl) return;

    const handleMessage = (e) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (!data) return;
        if (data.event === 'onError') {
          if (data.info === 150 || data.info === 101) {
            setYtError('Pemilik video YouTube ini membatasi pemutaran di situs eksternal (Error 150 / Hak Cipta). Silakan gunakan video YouTube lain yang mengizinkan embed atau unggah MP4 langsung.');
          } else if (data.info === 100 || data.info === 2) {
            setYtError('Video YouTube tidak ditemukan atau URL tidak valid.');
          }
        }
      } catch (err) {}
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('message', handleMessage);
    }

    const triggerPlay = () => {
      try {
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'mute' }),
            '*'
          );
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo' }),
            '*'
          );
        }
      } catch (e) {}
    };

    const timer1 = setTimeout(triggerPlay, 600);
    const timer2 = setTimeout(triggerPlay, 1600);

    const handleUserInteraction = () => {
      triggerPlay();
      if (videoElemRef.current) {
        videoElemRef.current.play().catch(() => {});
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('touchstart', handleUserInteraction, { once: true, passive: true });
      window.addEventListener('click', handleUserInteraction, { once: true });
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (typeof window !== 'undefined') {
        window.removeEventListener('message', handleMessage);
        window.removeEventListener('touchstart', handleUserInteraction);
        window.removeEventListener('click', handleUserInteraction);
      }
    };
  }, [config.videoUrl, config.enableVideo]);

  const isWedding = config.theme === 'wedding';

  return (
    <div
      className={`relative flex flex-col items-center justify-center h-full h-[100dvh] max-h-[100dvh] w-full ${activeTheme.bgClass} overflow-hidden select-none p-3 sm:p-6 transition-colors duration-300`}
    >
      {/* Settings Gear Button (Opens Left Drawer) */}
      <button
        onClick={() => setIsDrawerOpen(true)}
        aria-label="Buka Pengaturan Landing"
        title="Konfigurasi Judul, Video & Tema"
        className="absolute top-3 left-3 sm:top-5 sm:left-5 z-20 p-2 sm:p-2.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200 text-slate-700 hover:text-slate-900 shadow-xs transition-colors cursor-pointer backdrop-blur-xs"
      >
        <SlidersHorizontal size={17} className="sm:w-5 sm:h-5" />
      </button>

      {/* Decorative accent icons (Dynamic based on theme) */}
      {isWedding ? (
        <>
          <motion.div
            animate={{ y: [0, -8, 0], rotate: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
            className="absolute top-4 right-4 sm:top-8 sm:right-10 text-rose-300/80 pointer-events-none"
          >
            <Heart size={26} className="sm:w-8 sm:h-8 fill-rose-100" />
          </motion.div>
          <motion.div
            animate={{ y: [0, 8, 0], scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
            className="absolute bottom-4 left-4 sm:bottom-10 sm:left-10 text-amber-300/80 pointer-events-none"
          >
            <Sparkles size={28} className="sm:w-9 sm:h-9" />
          </motion.div>
        </>
      ) : (
        <>
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="absolute top-4 right-4 sm:top-8 sm:right-10 text-rose-300 pointer-events-none"
          >
            <Sparkles size={24} className="sm:w-8 sm:h-8" />
          </motion.div>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
            className="absolute bottom-4 right-4 sm:bottom-10 sm:right-10 text-slate-300 pointer-events-none"
          >
            <Camera size={28} className="sm:w-9 sm:h-9" />
          </motion.div>
        </>
      )}

      {/* Main Container without card wrapper */}
      <div className="z-10 flex flex-col items-center max-w-lg sm:max-w-xl w-full text-center px-4 my-auto">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-2xl sm:text-3xl md:text-4xl font-extrabold ${activeTheme.headingClass} tracking-tight mb-1.5`}
        >
          {config.title || activeTheme.defaultTitle}
        </motion.h1>
        <p className={`${activeTheme.subheadingClass} text-xs sm:text-sm md:text-base mb-4 sm:mb-5 font-normal max-w-sm`}>
          {config.subtitle || activeTheme.defaultSubtitle}
        </p>

        {/* Center Display: Video Preview OR Animated Gift Box */}
        {config.enableVideo && config.videoUrl ? (
          <div className="relative mb-5 sm:mb-6 w-full max-w-[360px] sm:max-w-[480px] md:max-w-[540px] aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-black">
            {getYoutubeEmbedUrl(config.videoUrl) ? (
              <>
                <iframe
                  ref={iframeRef}
                  src={getYoutubeEmbedUrl(config.videoUrl)}
                  title="YouTube Video Preview"
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
                {ytError && (
                  <div className="absolute inset-0 bg-black/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-10">
                    <AlertCircle className="w-7 h-7 text-amber-400 mb-1.5 shrink-0" />
                    <p className="text-xs text-slate-100 leading-relaxed font-medium max-w-xs">
                      {ytError}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsDrawerOpen(true)}
                      className="mt-2.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Buka Pengaturan Video
                    </button>
                  </div>
                )}
              </>
            ) : (
              <video
                ref={videoElemRef}
                src={config.videoUrl}
                autoPlay
                loop
                muted
                controls
                playsInline
                className="w-full h-full object-cover"
              />
            )}
          </div>
        ) : (
          /* Gift Box Graphic (Flat Solid) */
          <div
            role="button"
            tabIndex={0}
            aria-label="Buka Kotak Hadiah"
            className="relative mb-5 sm:mb-6 cursor-pointer focus:outline-none"
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
              className={`w-28 h-28 sm:w-36 sm:h-36 ${
                isWedding ? 'bg-amber-600' : 'bg-rose-500'
              } rounded-2xl sm:rounded-3xl flex items-center justify-center relative shadow-sm`}
            >
              {isWedding ? (
                <Heart className="w-14 h-14 sm:w-18 sm:h-18 text-white fill-white/20" size={56} />
              ) : (
                <Gift className="w-14 h-14 sm:w-18 sm:h-18 text-white" size={56} />
              )}
              {isOpen && (
                <motion.div
                  initial={{ scale: 0, opacity: 0.8 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  className={`absolute inset-0 ${isWedding ? 'bg-amber-300' : 'bg-rose-300'} rounded-2xl sm:rounded-3xl`}
                />
              )}
            </motion.div>
          </div>
        )}

        {/* Compact CTA Button (Flat Solid) */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStart}
          className={`px-6 sm:px-8 py-2.5 sm:py-3 ${activeTheme.btnClass} font-bold text-sm sm:text-base rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs`}
        >
          <Camera size={18} className="sm:w-5 sm:h-5" />
          Mulai Sekarang
        </motion.button>
      </div>

      {/* Left Configuration Drawer */}
      <LandingConfigDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        config={config}
        onUpdateConfig={handleUpdateConfig}
      />
    </div>
  );
}
