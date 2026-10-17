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
import {
  Sparkles,
  Camera,
  Gift,
  SlidersHorizontal,
  Heart,
  AlertCircle,
  Calendar,
  Play,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { audioFx } from '../utils/audioEffects.js';
import LandingConfigDrawer, { THEME_PRESETS } from './LandingConfigDrawer.jsx';
import SessionCodeModal from './SessionCodeModal.jsx';
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
  isSubtitleCustom: false,
  // Session Access PIN
  requireSessionCode: false,
  sessionCode: '1234',
  // Printer defaults
  printerName: 'Default System Printer',
  paperSize: '4R',
  printCopies: 1,
  printMethod: 'kiosk',
  autoPrint: false
};

export default function LandingPage({ onStartSession, isLiveMode = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSessionCodeModalOpen, setIsSessionCodeModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

  const handleGoLive = () => {
    if (typeof window !== 'undefined') {
      const liveUrl = `${window.location.origin}/live`;
      const liveWin = window.open(liveUrl, '_blank');
      if (liveWin) {
        liveWin.focus();
      }
    }
  };

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handleStart = () => {
    if (isOpen) return;

    // In live mode, request fullscreen on user interaction
    if (isLiveMode && typeof document !== 'undefined' && !document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }

    // Check if session code dialog is required
    if (config.requireSessionCode && (config.sessionCode || '').trim() !== '') {
      setIsSessionCodeModalOpen(true);
      return;
    }

    proceedSessionLaunch();
  };

  const proceedSessionLaunch = () => {
    setIsSessionCodeModalOpen(false);
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
      if (videoElemRef.current) {
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
      {/* Top Left Navigation: HANYA TAMPIL DI HALAMAN KONFIGURASI (!isLiveMode) */}
      {!isLiveMode && (
        <div className="absolute top-3 left-3 sm:top-5 sm:left-5 z-30 flex items-center gap-2">
          {/* Settings Drawer Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Buka Pengaturan Landing"
            title="Konfigurasi Tampilan, Video, Sesi & Printer"
            className="p-2 sm:p-2.5 rounded-xl bg-white/90 hover:bg-white border border-slate-200 text-slate-700 hover:text-slate-900 shadow-xs transition-colors cursor-pointer backdrop-blur-xs flex items-center gap-1.5"
          >
            <SlidersHorizontal size={17} className="text-rose-500 sm:w-5 sm:h-5" />
            <span className="text-xs font-bold text-slate-700 hidden sm:inline">Konfigurasi</span>
          </button>
        </div>
      )}

      {/* Top Right: Tombol Go Live di mode konfigurasi OR Fullscreen di mode live */}
      {!isLiveMode ? (
        <div className="absolute top-3 right-3 sm:top-5 sm:right-5 z-30 flex items-center gap-2">
          <button
            onClick={handleGoLive}
            aria-label="Luncurkan Halaman Live"
            title="Buka Halaman Live Photobooth di Tab Baru (Tanpa Tombol Setting & Fullscreen)"
            className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-200 hover:shadow-lg hover:shadow-rose-300 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <Play size={14} className="fill-white" />
            <span>Go Live</span>
          </button>
        </div>
      ) : (
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
          title={isFullscreen ? 'Keluar Layar Penuh' : 'Masuk Mode Layar Penuh (Kiosk)'}
          className="absolute top-3 right-3 sm:top-5 sm:right-5 z-30 p-2 sm:p-2.5 rounded-xl bg-white/40 hover:bg-white/80 border border-slate-200/50 text-slate-500 hover:text-slate-800 shadow-2xs transition-colors cursor-pointer backdrop-blur-xs"
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      )}

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
          transition={{ duration: 0.5 }}
          className={`font-black tracking-tight transition-all duration-300 ${activeTheme.headingClass} ${
            isWedding
              ? 'font-romantic text-4xl sm:text-5xl md:text-6xl text-rose-950 mb-0 leading-tight drop-shadow-xs'
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
            className={`relative mb-2 sm:mb-3 mx-auto select-none transition-all duration-300 ${
              isPortraitMode
                ? 'w-fit max-w-[280px] sm:max-w-[340px]'
                : 'w-full max-w-[480px] sm:max-w-[640px]'
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

              {/* Frame Header Top: Event Date Badge (Hidden while loading) */}
              {!isVideoLoading && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="pb-1 pt-0.5 px-2 text-center border-b border-rose-200/80 mb-1 select-none flex items-center justify-center gap-1.5"
                >
                  <Calendar size={11} className="text-rose-400" />
                  <span className="text-[10px] sm:text-[11px] font-serif tracking-widest uppercase text-rose-900/80 font-medium">
                    {config.eventDate || 'Saturday, 17 October 2026'}
                  </span>
                </motion.div>
              )}

              {/* Video Player Display Container */}
              <div
                className={`relative rounded-2xl overflow-hidden shadow-inner bg-black ${getAspectRatioClasses()} ${
                  exactNumericRatio ? 'flex items-center justify-center' : ''
                }`}
                style={
                  exactNumericRatio
                    ? { aspectRatio: String(exactNumericRatio) }
                    : undefined
                }
              >
                <video
                  ref={videoElemRef}
                  src={cachedVideoSrc || config.videoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls={false}
                  onLoadedMetadata={(e) => {
                    const videoWidth = e.target.videoWidth;
                    const videoHeight = e.target.videoHeight;
                    if (videoWidth && videoHeight) {
                      setElementDetectedRatio(videoHeight >= videoWidth ? 'portrait' : 'landscape');
                      setExactNumericRatio(videoWidth / videoHeight);
                    }
                  }}
                  onLoadedData={() => {
                    setIsVideoLoading(false);
                    if (videoElemRef.current) {
                      videoElemRef.current.play().catch(() => {});
                    }
                  }}
                  onCanPlay={() => {
                    setIsVideoLoading(false);
                  }}
                  onWaiting={() => {
                    setIsVideoLoading(true);
                  }}
                  onPlaying={() => {
                    setIsVideoLoading(false);
                  }}
                  className="w-full h-full object-cover block mx-auto select-none pointer-events-none"
                />

                {/* THEMATIC VIDEO LOADING ANIMATION */}
                <AnimatePresence>
                  {isVideoLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`absolute inset-0 flex flex-col items-center justify-center z-30 p-4 select-none backdrop-blur-md ${
                        isWedding
                          ? 'bg-rose-950/85 text-rose-100'
                          : 'bg-slate-900/85 text-slate-100'
                      }`}
                    >
                      {isWedding ? (
                        /* Romantic Wedding Loading Animation: Beating Heart & Sparkle Ring */
                        <div className="flex flex-col items-center text-center space-y-3">
                          <div className="relative flex items-center justify-center w-16 h-16">
                            <motion.div
                              animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0.2, 0.6] }}
                              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                              className="absolute inset-0 rounded-full border-2 border-rose-400/60"
                            />
                            <motion.div
                              animate={{ scale: [1, 1.15, 1] }}
                              transition={{ repeat: Infinity, duration: 0.9, ease: "easeInOut" }}
                              className="relative z-10"
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

              {/* Frame Footer Bottom: Nama Pengantin Romantis Compact & Fit to Frame */}
              {!isVideoLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="pt-1 pb-0.5 px-2 text-center border-t border-rose-200/80 mt-1 select-none flex items-center justify-center"
                >
                  <div className="inline-flex items-center justify-center gap-1.5 px-3.5 py-0.5 rounded-full bg-white/95 border border-rose-200/80 shadow-2xs max-w-full">
                    {isWedding ? (
                      <Heart size={11} className="text-rose-500 fill-rose-400 shrink-0 animate-pulse" />
                    ) : (
                      <Sparkles size={11} className="text-amber-500 shrink-0" />
                    )}
                    <span className={`truncate max-w-[240px] sm:max-w-[320px] text-rose-950 ${
                      isWedding
                        ? 'font-romantic text-lg sm:text-xl font-normal tracking-wide leading-none drop-shadow-2xs py-0.5'
                        : 'text-[11px] sm:text-xs font-semibold tracking-wide'
                    }`}>
                      {config.coupleNames || (isWedding ? 'The Wedding Celebration' : 'Special Celebration')}
                    </span>
                    {isWedding ? (
                      <Heart size={11} className="text-rose-500 fill-rose-400 shrink-0 animate-pulse" />
                    ) : (
                      <Sparkles size={11} className="text-amber-500 shrink-0" />
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

        {/* Action Button: Mulai Sekarang */}
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

      {/* Slide-over Drawer for Configuration (Only mounted/opened from configuration page) */}
      <LandingConfigDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        config={config}
        onUpdateConfig={handleUpdateConfig}
        onGoLive={handleGoLive}
      />

      {/* Session Access Code Modal (Opens if requireSessionCode is active) */}
      <SessionCodeModal
        isOpen={isSessionCodeModalOpen}
        onClose={() => setIsSessionCodeModalOpen(false)}
        onSuccess={proceedSessionLaunch}
        expectedCode={config.sessionCode || '1234'}
        theme={config.theme}
      />
    </div>
  );
}
