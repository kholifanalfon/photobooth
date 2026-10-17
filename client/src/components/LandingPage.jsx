export function getYoutubeEmbedUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/)|youtube-nocookie\.com\/(?:embed\/|v\/))([\w-]{11})/);
  if (match && match[1]) {
    const videoId = match[1];
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&playsinline=1&enablejsapi=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0`;
  }
  return null;
}

export function getGoogleDriveEmbedUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+)|uc\?id=([a-zA-Z0-9_-]+))/i);
  if (match) {
    const fileId = match[1] || match[2] || match[3];
    return `https://drive.google.com/file/d/${fileId}/preview?autoplay=1`;
  }
  return null;
}

export function detectVideoAspectRatio(url, explicitRatio = 'auto', detectedFromElement = null) {
  if (['portrait', 'portrait-photo', 'landscape', 'square'].includes(explicitRatio)) {
    return explicitRatio;
  }
  if (detectedFromElement === 'portrait' || detectedFromElement === 'landscape') {
    return detectedFromElement;
  }
  if (url && typeof url === 'string') {
    if (url.includes('/shorts/')) {
      return 'portrait';
    }
  }
  return 'landscape';
}

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Camera, Gift, SlidersHorizontal, Heart, AlertCircle, Calendar } from 'lucide-react';
import { audioFx } from '../utils/audioEffects.js';
import LandingConfigDrawer, { THEME_PRESETS } from './LandingConfigDrawer.jsx';
import { getFastVideoUrl, preloadAndCacheVideo, isDirectVideoUrl } from '../utils/videoCache.js';

const LOCAL_STORAGE_KEY = 'photobooth_landing_config';

const DEFAULT_CONFIG = {
  title: 'Capture The Magic! ✨',
  subtitle: 'Sentuh tombol untuk membuka kotak hadiah dan memulai sesi fotomu.',
  eventDate: 'Saturday, 17 October 2026',
  coupleNames: 'The Wedding Celebration',
  videoUrl: '',
  enableVideo: false,
  videoRatio: 'auto', // 'auto' | 'portrait' | 'portrait-photo' | 'landscape' | 'square'
  theme: 'general',
  isTitleCustom: false,
  isSubtitleCustom: false
};

export default function LandingPage({ onStartSession }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [elementDetectedRatio, setElementDetectedRatio] = useState(null);
  const [exactNumericRatio, setExactNumericRatio] = useState(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const videoElemRef = useRef(null);

  // Initialize config safely from localStorage
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

  const [cachedVideoSrc, setCachedVideoSrc] = useState(() => getFastVideoUrl(config?.videoUrl));

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

  const hasActiveVideo = config.enableVideo && Boolean((config.videoUrl || '').trim());

  const effectiveRatio = detectVideoAspectRatio(config.videoUrl, config.videoRatio, elementDetectedRatio);
  const isPortraitMode = effectiveRatio === 'portrait' || effectiveRatio === 'portrait-photo';

  useEffect(() => {
    setElementDetectedRatio(null);
    setExactNumericRatio(null);
    setIsVideoLoading(true);

    if (isDirectVideoUrl(config.videoUrl)) {
      setCachedVideoSrc(getFastVideoUrl(config.videoUrl));
      preloadAndCacheVideo(config.videoUrl)
        .then((cached) => {
          if (cached) setCachedVideoSrc(cached);
        })
        .catch(() => {});
    } else {
      setCachedVideoSrc(config.videoUrl);
    }
  }, [config.videoUrl]);

  // Autoplay video file immediately upon load + gesture fallback
  useEffect(() => {
    if (!hasActiveVideo) return;

    if (videoElemRef.current) {
      videoElemRef.current.muted = true;
      const playPromise = videoElemRef.current.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    }

    const handleInteraction = () => {
      if (videoElemRef.current && videoElemRef.current.paused) {
        videoElemRef.current.play().catch(() => {});
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', handleInteraction, { once: true });
      window.addEventListener('touchstart', handleInteraction, { once: true });
      window.addEventListener('click', handleInteraction, { once: true });
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerdown', handleInteraction);
        window.removeEventListener('touchstart', handleInteraction);
        window.removeEventListener('click', handleInteraction);
      }
    };
  }, [config.videoUrl, config.enableVideo, hasActiveVideo]);

  const activeTheme = THEME_PRESETS[config.theme] || THEME_PRESETS.general;
  const isWedding = config.theme === 'wedding';

  // Compute aspect ratio classes dynamically to avoid blank space
  const getAspectRatioClasses = () => {
    if (exactNumericRatio) {
      return 'w-full max-h-[50vh] sm:max-h-[56vh]';
    }
    switch (effectiveRatio) {
      case 'portrait-photo':
        return 'aspect-[3/4] w-full max-h-[50vh] sm:max-h-[56vh]';
      case 'portrait':
        return 'aspect-[9/16] w-full max-h-[50vh] sm:max-h-[56vh]';
      case 'square':
        return 'aspect-square w-full max-h-[48vh] sm:max-h-[54vh]';
      case 'landscape':
      default:
        return 'aspect-video w-full max-h-[48vh] sm:max-h-[54vh]';
    }
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center h-full h-[100dvh] max-h-[100dvh] w-full bg-slate-50 overflow-hidden select-none p-3 sm:p-6 transition-colors duration-300"
    >
      {/* Settings Gear Button (Opens Left Drawer) */}
      <button
        onClick={() => setIsDrawerOpen(true)}
        aria-label="Buka Pengaturan Landing"
        title="Konfigurasi Judul, Video & Tema"
        className="absolute top-3 left-3 sm:top-5 sm:left-5 z-30 p-2 sm:p-2.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200 text-slate-700 hover:text-slate-900 shadow-xs transition-colors cursor-pointer backdrop-blur-xs"
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

      {/* Main Container */}
      <div
        className={`z-10 flex flex-col items-center w-full text-center px-2 sm:px-4 my-auto transition-all duration-300 ${
          hasActiveVideo
            ? isPortraitMode
              ? 'max-w-sm sm:max-w-md'
              : 'max-w-4xl sm:max-w-5xl'
            : 'max-w-lg sm:max-w-xl'
        }`}
      >
        {/* Title and Subtitle OUTSIDE the frame */}
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`font-extrabold ${activeTheme.headingClass} tracking-tight transition-all duration-300 ${
            isWedding
              ? 'font-romantic text-3xl sm:text-4xl md:text-5xl font-normal text-rose-950 mb-0.5 drop-shadow-2xs'
              : 'text-2xl sm:text-3xl md:text-4xl mb-1'
          }`}
        >
          {config.title || activeTheme.defaultTitle}
        </motion.h1>

        <p
          className={`${activeTheme.subheadingClass} font-normal transition-all duration-300 ${
            isWedding
              ? 'font-romantic-serif italic text-xs sm:text-sm text-rose-800/80 mb-3 sm:mb-4 max-w-sm line-clamp-2'
              : 'text-xs sm:text-sm md:text-base text-slate-600 mb-3 sm:mb-4 max-w-sm'
          }`}
        >
          {config.subtitle || activeTheme.defaultSubtitle}
        </p>

        {/* Center Display: Thematic Framed Video Preview OR Animated Gift Box */}
        {hasActiveVideo ? (
          <div
            className={`relative mb-3 sm:mb-4 mx-auto select-none transition-all duration-300 ${
              isPortraitMode
                ? 'w-auto max-w-[310px] sm:max-w-[370px]'
                : 'w-full max-w-[500px] sm:max-w-[700px] md:max-w-[840px]'
            }`}
          >
            {/* Thematic Outer Frame Snugly Wrapping Video (Hidden while video is loading) */}
            <div
              className={`relative p-2 sm:p-2.5 rounded-3xl transition-all duration-500 ${
                isVideoLoading
                  ? 'bg-transparent border-transparent shadow-none ring-0'
                  : isWedding
                  ? 'bg-gradient-to-br from-rose-50/95 via-white to-amber-50/80 border-2 border-rose-200/90 shadow-2xl ring-1 ring-amber-300/40 shadow-rose-200/50'
                  : 'bg-white/95 border border-slate-200/90 shadow-2xl ring-1 ring-slate-100 shadow-slate-300/40'
              }`}
            >
              {/* Wedding Thematic Corner Filigree Accents (Hidden while loading) */}
              {!isVideoLoading && (
                isWedding ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-rose-300 rounded-tl-xl pointer-events-none" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-rose-300 rounded-tr-xl pointer-events-none" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-rose-300 rounded-bl-xl pointer-events-none" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-rose-300 rounded-br-xl pointer-events-none" />
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                    <div className="absolute -top-2.5 left-6 w-12 sm:w-14 h-4 sm:h-5 bg-rose-200/80 backdrop-blur-2xs -rotate-2 border-l border-r border-dashed border-rose-300 shadow-2xs pointer-events-none rounded-2xs z-20" />
                    <div className="absolute -bottom-2.5 right-5 px-2.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full shadow-xs flex items-center gap-1 z-20 pointer-events-none tracking-wide">
                      <Sparkles size={10} />
                      <span>PHOTOBOOTH</span>
                    </div>
                  </motion.div>
                )
              )}

              {/* Frame Header Top: Tanggal Acara Berlangsung (Hidden while loading) */}
              {!isVideoLoading && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="py-1 px-2 text-center flex items-center justify-center gap-1.5 select-none border-b border-rose-100/70 mb-1.5"
                >
                  <Sparkles size={11} className="text-amber-400" />
                  <span className="text-[10px] sm:text-[11px] font-semibold tracking-widest uppercase text-rose-800/85">
                    {config.eventDate || 'Saturday, 17 October 2026'}
                  </span>
                  <Sparkles size={11} className="text-amber-400" />
                </motion.div>
              )}

              {/* Inner Video Viewport Fitted Snugly to Video Size */}
              <div
                style={!isVideoLoading && exactNumericRatio ? { aspectRatio: exactNumericRatio } : {}}
                className={`relative rounded-2xl overflow-hidden select-none flex items-center justify-center transition-all duration-500 ${
                  isVideoLoading
                    ? 'w-[260px] sm:w-[320px] h-[220px] sm:h-[260px] mx-auto bg-transparent border-0'
                    : `bg-black border border-slate-900/10 ${getAspectRatioClasses()}`
                }`}
              >
                {/* Transparent Interaction Lock Layer to ensure clean video without external pop-outs or clicks */}
                <div className="absolute inset-0 z-10 select-none pointer-events-auto" />

                {/* Video Element */}
                <video
                  ref={videoElemRef}
                  src={cachedVideoSrc || config.videoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  onLoadedMetadata={(e) => {
                    if (e.target && e.target.videoWidth && e.target.videoHeight) {
                      const ratio = e.target.videoWidth / e.target.videoHeight;
                      setExactNumericRatio(ratio);
                      setElementDetectedRatio(e.target.videoHeight > e.target.videoWidth ? 'portrait' : 'landscape');
                    }
                  }}
                  onLoadedData={() => setIsVideoLoading(false)}
                  onCanPlay={() => setIsVideoLoading(false)}
                  onPlaying={() => setIsVideoLoading(false)}
                  onWaiting={() => setIsVideoLoading(true)}
                  className={`w-full h-full object-contain pointer-events-none select-none transition-opacity duration-300 ${
                    isVideoLoading ? 'opacity-0' : 'opacity-100'
                  }`}
                />

                {/* Themed Video Loading Animation */}
                <AnimatePresence>
                  {isVideoLoading && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.35 }}
                      className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-5 rounded-2xl select-none ${
                        isWedding
                          ? 'bg-rose-950/85 backdrop-blur-md border border-rose-300/30 shadow-2xl shadow-rose-900/30'
                          : 'bg-slate-900/85 backdrop-blur-md border border-slate-700/50 shadow-2xl shadow-black/40'
                      }`}
                    >
                      {isWedding ? (
                        /* Wedding Theme Loading Animation: Glowing Heart + Golden Rings */
                        <div className="flex flex-col items-center text-center space-y-3">
                          <div className="relative flex items-center justify-center w-14 h-14">
                            <motion.div
                              animate={{ scale: [1, 1.35, 1], opacity: [0.25, 0.65, 0.25] }}
                              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                              className="absolute inset-0 rounded-full bg-rose-400/30 blur-sm"
                            />
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 5, ease: "linear" }}
                              className="absolute inset-0.5 rounded-full border border-dashed border-amber-300/70"
                            />
                            <motion.div
                              animate={{ scale: [1, 1.18, 1] }}
                              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                              className="relative z-10 text-rose-400"
                            >
                              <Heart size={26} className="fill-rose-500/80 text-rose-300 drop-shadow-md" />
                            </motion.div>
                          </div>

                          <div className="space-y-1">
                            <p className="font-romantic text-base sm:text-lg text-rose-200 tracking-wide drop-shadow-sm">
                              Mempersiapkan Momen Bahagia
                            </p>
                            <div className="flex items-center justify-center gap-1.5 text-[10px] text-rose-200/75 font-medium">
                              <Sparkles size={11} className="text-amber-300 animate-pulse" />
                              <span>Memuat tayangan video cinta...</span>
                              <Sparkles size={11} className="text-amber-300 animate-pulse" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* General Theme Loading Animation: Rotating Camera & Star Sparks */
                        <div className="flex flex-col items-center text-center space-y-3">
                          <div className="relative flex items-center justify-center w-14 h-14">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                              className="absolute inset-0 rounded-2xl border-2 border-dashed border-rose-400/80"
                            />
                            <motion.div
                              animate={{ y: [-2, 2, -2] }}
                              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                              className="relative z-10 text-rose-400"
                            >
                              <Camera size={24} className="text-rose-400 drop-shadow-sm" />
                            </motion.div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-100 tracking-wide">
                              Menyiapkan Video Photobooth
                            </p>
                            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-300 font-medium">
                              <Sparkles size={11} className="text-amber-300 animate-pulse" />
                              <span>Sesaat lagi siap...</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Frame Footer Bottom: Nama Pengantin Romantis Selaras dengan Title + Letter Spacing */}
              {!isVideoLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="pt-2 pb-1.5 px-2 text-center border-t border-rose-200/80 mt-1.5 select-none flex items-center justify-center"
                >
                  <div className="inline-flex items-center justify-center gap-2.5 px-5 py-1 rounded-full bg-white/95 border border-rose-200/90 shadow-2xs max-w-full">
                    {isWedding ? (
                      <Heart size={14} className="text-rose-500 fill-rose-400 shrink-0 animate-pulse" />
                    ) : (
                      <Sparkles size={13} className="text-amber-500 shrink-0" />
                    )}
                    <span className={`truncate max-w-[280px] sm:max-w-[400px] text-rose-950 ${
                      isWedding
                        ? 'font-romantic text-2xl sm:text-3xl font-normal tracking-wider sm:tracking-widest leading-none drop-shadow-2xs py-0.5'
                        : 'text-xs sm:text-sm font-semibold tracking-wider'
                    }`}>
                      {config.coupleNames || (isWedding ? 'The Wedding Celebration' : 'Special Celebration')}
                    </span>
                    {isWedding ? (
                      <Heart size={14} className="text-rose-500 fill-rose-400 shrink-0 animate-pulse" />
                    ) : (
                      <Sparkles size={13} className="text-amber-500 shrink-0" />
                    )}
                  </div>
                </motion.div>
              )}
            </div>
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
            {/* Box Body */}
            <motion.div
              animate={isOpen ? { scale: [1, 1.15, 0.95], rotate: [0, -3, 3, 0] } : {}}
              transition={{ duration: 0.5 }}
              className="w-36 h-36 sm:w-44 sm:h-44 bg-rose-500 rounded-3xl relative flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
            >
              {/* Ribbon Vertical */}
              <div className="absolute w-8 sm:w-10 h-full bg-amber-300" />
              {/* Ribbon Horizontal */}
              <div className="absolute h-8 sm:h-10 w-full bg-amber-300" />

              {/* Gift Ribbon Bow */}
              <div className="absolute -top-4 w-12 h-6 sm:w-14 sm:h-8 flex justify-center">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-4 border-amber-300 -mr-2 bg-amber-200" />
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-4 border-amber-300 -ml-2 bg-amber-200" />
              </div>

              {/* Center icon */}
              <div className="z-10 bg-white p-3 sm:p-3.5 rounded-2xl shadow-sm">
                <Gift className="w-8 h-8 sm:w-10 sm:h-10 text-rose-500" />
              </div>
            </motion.div>
          </div>
        )}

        {/* Action Button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleStart}
          className={`flex items-center justify-center gap-2.5 px-8 sm:px-12 py-3.5 sm:py-4 rounded-2xl font-bold text-base sm:text-lg shadow-md hover:shadow-xl transition-all cursor-pointer ${activeTheme.btnClass}`}
        >
          <Camera size={20} className="sm:w-6 sm:h-6" />
          <span>Mulai Sekarang</span>
        </motion.button>
      </div>

      {/* Slide-over Drawer for Configuration */}
      <LandingConfigDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        config={config}
        onUpdateConfig={handleUpdateConfig}
      />
    </div>
  );
}
