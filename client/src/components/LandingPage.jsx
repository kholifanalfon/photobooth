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
  Pause,
  Maximize2,
  Minimize2,
  DownloadCloud,
  CheckCircle2,
  FolderArchive,
  Layers,
  Lock
} from 'lucide-react';
import { audioFx } from '../utils/audioEffects.js';
import LandingConfigDrawer, { THEME_PRESETS } from './LandingConfigDrawer.jsx';
import SessionCodeModal from './SessionCodeModal.jsx';
import SessionManagerModal from './SessionManagerModal.jsx';
import FrameManagerModal from './FrameManagerModal.jsx';
import PrinterConfigModal from './PrinterConfigModal.jsx';
import AdminExitModal from './AdminExitModal.jsx';
import {
  getFastVideoUrl,
  preloadAndCacheVideo,
  getCachedVideoBlobUrl,
  isDirectVideoUrl,
  isMediaImage,
  resolveMediaUrl
} from '../utils/videoCache.js';
import { SLOT_PRESETS, MODERN_4R_FRAMES } from '../constants/framePresets.js';

const LOCAL_STORAGE_KEY = 'photobooth_landing_config';

const DEFAULT_CONFIG = {
  title: 'Capture The Magic! ✨',
  subtitle: 'Sentuh tombol untuk membuka kotak hadiah dan memulai sesi fotomu.',
  eventDate: 'Saturday, 17 October 2026',
  coupleNames: 'Kevin & Sheila',
  videoUrl: '',
  enableVideo: false,
  videoRatio: 'auto', // 'auto' | 'portrait' | 'portrait-photo' | 'landscape' | 'square'
  videoDisplayMode: 'both', // 'both' | 'frame' | 'background'
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
  autoPrint: false,
  customFrame: {
    ...MODERN_4R_FRAMES[0],
    slots: MODERN_4R_FRAMES[0].slots.map((s) => ({ ...s }))
  },
  customFrames: [
    ...MODERN_4R_FRAMES.map((f) => ({ ...f, slots: f.slots.map((s) => ({ ...s })) })),
    {
      id: 'frame-wedding-modern-10slots',
      name: 'Wedding Modern 10-Slot (Double 5-Strip 4R)',
      enabled: true,
      orientation: 'portrait',
      width: 1200,
      height: 1800,
      imageUrl: '/frames/wedding_modern_10slots.png',
      layerMode: 'background',
      photoCount: 5,
      slots: (SLOT_PRESETS[10]?.portrait || []).map((s) => ({ ...s }))
    }
  ]
};

export default function LandingPage({ onStartSession, isLiveMode = false, onEnterLiveMode, onExitLiveMode, initialConfig = null, onConfigChange = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSessionCodeModalOpen, setIsSessionCodeModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [elementDetectedRatio, setElementDetectedRatio] = useState(null);
  const [exactNumericRatio, setExactNumericRatio] = useState(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const videoElemRef = useRef(null);
  const bgVideoRef = useRef(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [cacheProgress, setCacheProgress] = useState(null);

  // Initialize config safely from parent state or localStorage
  const [config, setConfig] = useState(() => {
    if (initialConfig && typeof initialConfig === 'object') {
      return { ...DEFAULT_CONFIG, ...initialConfig };
    }
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
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [isFrameManagerOpen, setIsFrameManagerOpen] = useState(false);
  const [isPrinterConfigOpen, setIsPrinterConfigOpen] = useState(false);
  const prevVideoUrlRef = useRef(null);
  const isLaunchingRef = useRef(false);

  // Sync fresh config directly from server on mount (no stale cache)
  useEffect(() => {
    let isMounted = true;
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      fetch(`/api/config/landing?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isMounted && data && data.config) {
            setConfig((prev) => {
              const next = {
                ...prev,
                ...data.config,
                coupleNames: data.config.coupleNames || prev.coupleNames || 'Kevin & Sheila',
                eventDate: data.config.eventDate || prev.eventDate || 'Saturday, 17 October 2026',
                videoDisplayMode: data.config.videoDisplayMode || prev.videoDisplayMode || 'background',
                customFrames:
                  Array.isArray(data.config.customFrames) && data.config.customFrames.length > 0
                    ? data.config.customFrames
                    : prev.customFrames,
                customFrame: data.config.customFrame || prev.customFrame
              };
              if (typeof window !== 'undefined' && window.localStorage) {
                try {
                  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
                } catch (_) {}
              }
              if (typeof onConfigChange === 'function') {
                onConfigChange(next);
              }
              return next;
            });
          }
        })
        .catch((err) => console.warn('Failed to load landing config from server:', err));
    }
    return () => {
      isMounted = false;
    };
  }, []);

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
        } catch (_) {}
      }
      // Persist directly to server (exclude volatile blob: URLs)
      if (typeof window !== 'undefined' && typeof fetch === 'function') {
        const payload = { ...next };
        if (payload.videoUrl && payload.videoUrl.startsWith('blob:')) {
          delete payload.videoUrl;
        }
        fetch('/api/config/landing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch((err) => console.warn('Failed to sync landing config to server:', err));
      }
      if (typeof onConfigChange === 'function') {
        onConfigChange(next);
      }
      return next;
    });
  };

  const handleGoLive = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    handleUpdateConfig({ isLive: true });
    if (typeof onEnterLiveMode === 'function') {
      if (typeof window !== 'undefined') {
        try {
          window.history.pushState(null, '', '/live');
        } catch (_) {}
      }
      onEnterLiveMode();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.assign('/live');
    }
  };

  const handleExitLive = () => {
    setIsExitModalOpen(false);
    handleUpdateConfig({ isLive: false });
    if (typeof onExitLiveMode === 'function') {
      onExitLiveMode();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  const togglePlayPauseVideo = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    const bg = bgVideoRef.current;
    const frame = videoElemRef.current;
    const target = bg || frame;

    if (!target) return;

    if (!target.paused) {
      if (bg) bg.pause();
      if (frame) frame.pause();
      setIsVideoPlaying(false);
    } else {
      if (bg) bg.play().catch(() => {});
      if (frame) frame.play().catch(() => {});
      setIsVideoPlaying(true);
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
    if (isLaunchingRef.current) return;
    isLaunchingRef.current = true;
    setIsSessionCodeModalOpen(false);
    if (audioFx && typeof audioFx.playGiftPopSound === 'function') {
      audioFx.playGiftPopSound();
    }
    setIsOpen(true);
    setTimeout(() => {
      isLaunchingRef.current = false;
      if (typeof onStartSession === 'function') {
        onStartSession(config.customFrame, config.customFrames);
      }
    }, 800);
  };

  const hasActiveVideo = config.enableVideo && Boolean((config.videoUrl || '').trim());
  const displayMode = config.videoDisplayMode || 'both';
  const showBackgroundVideo = hasActiveVideo && (displayMode === 'both' || displayMode === 'background');
  const showFrameVideo = hasActiveVideo && (displayMode === 'both' || displayMode === 'frame');
  const isImageMedia = isMediaImage(config.videoUrl);

  const effectiveRatio = detectVideoAspectRatio(config.videoUrl, config.videoRatio, elementDetectedRatio);
  const isPortraitMode = effectiveRatio === 'portrait' || effectiveRatio === 'portrait-photo';

  useEffect(() => {
    let isMounted = true;
    const nextUrl = config.videoUrl || '';

    if (!nextUrl) {
      prevVideoUrlRef.current = '';
      setCachedVideoSrc('');
      setElementDetectedRatio(null);
      setExactNumericRatio(null);
      setIsVideoLoading(false);
      setCacheProgress(null);
      return;
    }

    const isCurrentUrlAlreadyBlob = Boolean(
      cachedVideoSrc && (cachedVideoSrc.startsWith('blob:') || cachedVideoSrc.startsWith('data:'))
    );

    // If URL hasn't changed and we already have a resolved cached blob URL, avoid re-running
    if (nextUrl === prevVideoUrlRef.current && isCurrentUrlAlreadyBlob) {
      return;
    }

    prevVideoUrlRef.current = nextUrl;
    setElementDetectedRatio(null);
    setExactNumericRatio(null);
    setIsVideoLoading(true);

    if (isMediaImage(nextUrl)) {
      setCachedVideoSrc(nextUrl);
      setIsVideoLoading(false);
      setCacheProgress(null);
      return;
    }

    if (!isDirectVideoUrl(nextUrl)) {
      setCachedVideoSrc(nextUrl);
      setCacheProgress(null);
      return;
    }

    // 1. Fast path: check if already in CacheStorage or in-memory cache
    getCachedVideoBlobUrl(nextUrl)
      .then((cachedBlob) => {
        if (!isMounted) return;
        if (cachedBlob) {
          setCachedVideoSrc(cachedBlob);
          setCacheProgress(null);
          return;
        }

        // 2. Direct streaming fallback while background caching takes place
        const initialFast = getFastVideoUrl(nextUrl);
        setCachedVideoSrc((prev) => (prev ? prev : initialFast));

        preloadAndCacheVideo(nextUrl, (percent, stats) => {
          if (!isMounted) return;
          const received = stats?.receivedBytes || 0;
          const total = stats?.totalBytes || 0;
          const loadedMB = (received / (1024 * 1024)).toFixed(1);
          const totalMB = total > 0 ? (total / (1024 * 1024)).toFixed(1) : null;

          setCacheProgress({
            percent: Math.round(percent),
            loadedMB,
            totalMB,
            isComplete: percent >= 100
          });
        })
          .then((freshCachedBlob) => {
            if (!isMounted) return;
            if (freshCachedBlob && freshCachedBlob !== initialFast) {
              setCacheProgress((prev) => (prev ? { ...prev, percent: 100, isComplete: true } : null));
              setTimeout(() => {
                if (isMounted) setCacheProgress(null);
              }, 1200);

              // Preserve playback position if video element is already actively playing
              const targetEl = bgVideoRef.current || videoElemRef.current;
              if (targetEl && targetEl.currentTime > 0) {
                const savedTime = targetEl.currentTime;
                const wasPaused = targetEl.paused;
                setCachedVideoSrc(freshCachedBlob);

                const handleRestore = () => {
                  [bgVideoRef.current, videoElemRef.current].forEach((el) => {
                    if (el) {
                      try {
                        el.currentTime = savedTime;
                        if (!wasPaused) {
                          el.play().catch(() => {});
                        }
                      } catch (_) {}
                    }
                  });
                  if (targetEl) {
                    targetEl.removeEventListener('loadedmetadata', handleRestore);
                  }
                };
                targetEl.addEventListener('loadedmetadata', handleRestore);
              } else {
                setCachedVideoSrc(freshCachedBlob);
              }
            } else {
              setCacheProgress(null);
            }
          })
          .catch(() => {
            if (isMounted) setCacheProgress(null);
          });
      })
      .catch(() => {
        if (isMounted) {
          setCachedVideoSrc(nextUrl);
          setCacheProgress(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [config.videoUrl]);

  // Keep isVideoPlaying in sync with actual media element state
  useEffect(() => {
    const bg = bgVideoRef.current;
    const frame = videoElemRef.current;

    const onPlay = () => setIsVideoPlaying(true);
    const onPause = () => {
      if ((!bg || bg.paused) && (!frame || frame.paused)) {
        setIsVideoPlaying(false);
      }
    };

    if (bg) {
      bg.addEventListener('play', onPlay);
      bg.addEventListener('pause', onPause);
    }
    if (frame) {
      frame.addEventListener('play', onPlay);
      frame.addEventListener('pause', onPause);
    }

    return () => {
      if (bg) {
        bg.removeEventListener('play', onPlay);
        bg.removeEventListener('pause', onPause);
      }
      if (frame) {
        frame.removeEventListener('play', onPlay);
        frame.removeEventListener('pause', onPause);
      }
    };
  }, [hasActiveVideo, showBackgroundVideo, showFrameVideo, cachedVideoSrc]);

  // Autoplay video file immediately upon load + gesture fallback for mobile/iOS Safari
  useEffect(() => {
    if (!hasActiveVideo) return;

    const playBoth = () => {
      const bg = bgVideoRef.current;
      const frame = videoElemRef.current;

      [bg, frame].forEach((el) => {
        if (el) {
          el.defaultMuted = true;
          el.muted = true;
          el.setAttribute('playsinline', '');
          el.setAttribute('webkit-playsinline', 'true');
          const playPromise = el.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
          }
        }
      });
    };

    playBoth();

    // Also retry on user interaction for mobile browsers requiring user activation
    const handleInteraction = () => {
      playBoth();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', handleInteraction, { passive: true });
      window.addEventListener('touchstart', handleInteraction, { passive: true });
      window.addEventListener('click', handleInteraction, { passive: true });
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerdown', handleInteraction);
        window.removeEventListener('touchstart', handleInteraction);
        window.removeEventListener('click', handleInteraction);
      }
    };
  }, [config.videoUrl, config.enableVideo, hasActiveVideo, cachedVideoSrc, showBackgroundVideo, showFrameVideo]);

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
      {/* Ambient Fullscreen Background Video/Image Layer */}
      {showBackgroundVideo && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
          {isImageMedia ? (
            <img
              src={resolveMediaUrl(config.videoUrl)}
              alt="Ambient Background"
              className="w-full h-full object-cover scale-105 filter blur-[2px] opacity-85 transition-opacity duration-700"
            />
          ) : (
            <video
              key={`bg-${cachedVideoSrc || config.videoUrl || 'video'}`}
              ref={bgVideoRef}
              src={cachedVideoSrc || resolveMediaUrl(config.videoUrl)}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="w-full h-full object-cover scale-105 filter blur-[2px] opacity-85 transition-opacity duration-700"
              onTimeUpdate={(e) => {
                // If background video starts playing, sync and wake up frame video if paused or desynced
                if (showFrameVideo && videoElemRef.current && e.target.currentTime > 0) {
                  setIsVideoLoading(false);
                  const frameEl = videoElemRef.current;
                  if (frameEl.paused) {
                    frameEl.currentTime = e.target.currentTime;
                    frameEl.play().catch(() => {});
                  } else if (Math.abs(frameEl.currentTime - e.target.currentTime) > 0.4) {
                    frameEl.currentTime = e.target.currentTime;
                  }
                }
              }}
              onError={() => {
                const direct = resolveMediaUrl(config.videoUrl);
                if (cachedVideoSrc && cachedVideoSrc !== direct) {
                  setCachedVideoSrc(direct);
                }
              }}
            />
          )}
          {/* Subtle ambient tint */}
          <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] border-none" />
          {/* Prominent Center Radial Vignette: High contrast center glow for crystal-clear readability */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 65% 60% at 50% 50%, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.82) 30%, rgba(255, 255, 255, 0.45) 55%, rgba(255, 255, 255, 0.05) 80%, transparent 100%)'
            }}
          />
        </div>
      )}
      {/* Top Left Navigation: Settings & Session Management Buttons */}
      <div className="absolute top-3 left-3 sm:top-5 sm:left-5 z-30 flex items-center gap-2">
        {!isLiveMode && (
          <>
            <button
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Buka Pengaturan Landing"
              title="Buka Pengaturan Landing"
              className="p-2.5 sm:p-3 rounded-2xl bg-white/90 hover:bg-white border border-slate-200/80 text-slate-700 hover:text-slate-900 shadow-xs transition-colors cursor-pointer backdrop-blur-xs flex items-center justify-center"
            >
              <SlidersHorizontal size={18} className="text-rose-500 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={() => setIsFrameManagerOpen(true)}
              aria-label="Kelola Frame Photobooth"
              title="Kelola Frame Photobooth (Desain, Slot Foto, Ukuran Kertas & Upload)"
              className="px-3 py-2.5 sm:py-3 rounded-2xl bg-white/90 hover:bg-white border border-slate-200/80 text-slate-700 hover:text-rose-600 shadow-xs transition-colors cursor-pointer backdrop-blur-xs flex items-center gap-1.5 font-bold text-xs sm:text-sm"
            >
              <Layers size={17} className="text-rose-500" />
              <span className="hidden sm:inline">Kelola Frame</span>
            </button>
          </>
        )}
        <button
          onClick={() => setIsSessionsModalOpen(true)}
          aria-label="Kelola Sesi Foto"
          title="Kelola Sesi Foto (Preview, Print, Download, QR, Hapus)"
          className="px-3 py-2.5 sm:py-3 rounded-2xl bg-white/90 hover:bg-white border border-slate-200/80 text-slate-700 hover:text-rose-600 shadow-xs transition-colors cursor-pointer backdrop-blur-xs flex items-center gap-1.5 font-bold text-xs sm:text-sm"
        >
          <FolderArchive size={17} className="text-rose-500" />
          <span className="hidden sm:inline">Kelola Sesi</span>
        </button>
      </div>

      {/* Floating Bottom-Right: Background Video Pause / Resume Control Button */}
      {hasActiveVideo && !isImageMedia && (
        <button
          type="button"
          onClick={togglePlayPauseVideo}
          aria-label={isVideoPlaying ? 'Jeda Video Background' : 'Putar Video Background'}
          title={isVideoPlaying ? 'Jeda Video Background' : 'Putar Video Background'}
          className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg shadow-rose-300/50 flex items-center justify-center cursor-pointer transition-transform active:scale-90"
        >
          {isVideoPlaying ? (
            <Pause size={17} className="fill-white" />
          ) : (
            <Play size={17} className="fill-white ml-0.5" />
          )}
          <span className="sr-only">{isVideoPlaying ? 'Jeda Video' : 'Putar Video'}</span>
        </button>
      )}

      {/* Top-Right Lock & Fullscreen Controls in Live Mode */}
      {isLiveMode && (
        <div className="absolute top-3 right-3 sm:top-5 sm:right-5 z-30 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsExitModalOpen(true)}
            aria-label="Buka Kunci Mode Live"
            title="Buka Kunci & Keluar Mode Live"
            className="p-2 sm:p-2.5 rounded-xl bg-white/40 hover:bg-white/80 border border-slate-200/50 text-slate-500 hover:text-rose-600 shadow-2xs transition-colors cursor-pointer backdrop-blur-xs"
          >
            <Lock size={16} />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Masuk Mode Layar Penuh (Kiosk)'}
            className="p-2 sm:p-2.5 rounded-xl bg-white/40 hover:bg-white/80 border border-slate-200/50 text-slate-500 hover:text-slate-800 shadow-2xs transition-colors cursor-pointer backdrop-blur-xs"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
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
        className={`z-10 relative flex flex-col items-center w-full text-center px-2 sm:px-4 my-auto transition-all duration-300 ${
          showFrameVideo
            ? isPortraitMode
              ? 'max-w-sm sm:max-w-md'
              : 'max-w-4xl sm:max-w-5xl'
            : 'max-w-lg sm:max-w-xl'
        }`}
      >
        {/* Center Spotlight Aura specifically for background video mode */}
        {showBackgroundVideo && (
          <div
            className="absolute -inset-x-12 -inset-y-10 sm:-inset-x-20 sm:-inset-y-16 pointer-events-none -z-10 rounded-full blur-2xl opacity-90"
            style={{
              background:
                'radial-gradient(circle, rgba(255, 255, 255, 0.88) 0%, rgba(255, 255, 255, 0.6) 45%, rgba(255, 255, 255, 0.15) 75%, transparent 100%)'
            }}
          />
        )}
        {/* Title and Subtitle OUTSIDE the frame */}
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`font-black tracking-tight transition-all duration-300 ${activeTheme.headingClass} ${
            isWedding
              ? 'font-romantic text-4xl sm:text-5xl md:text-6xl text-rose-950 mb-0 leading-tight drop-shadow-[0_1px_3px_rgba(255,255,255,0.95)]'
              : 'text-2xl sm:text-3xl md:text-4xl mb-1'
          }`}
        >
          {config.title || (isWedding ? 'The Wedding Celebration' : activeTheme.defaultTitle)}
        </motion.h1>

        <p
          className={`${activeTheme.subheadingClass} font-normal transition-all duration-300 ${
            isWedding
              ? 'font-romantic-serif italic text-xs sm:text-sm text-rose-900/90 mb-3 sm:mb-4 max-w-md drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]'
              : 'text-xs sm:text-sm md:text-base text-slate-600 mb-3 sm:mb-4 max-w-sm'
          }`}
        >
          {config.subtitle || (isWedding ? 'Abadikan momen bahagia dan penuh cinta di hari istimewa ini.' : activeTheme.defaultSubtitle)}
        </p>

        {/* Center Display: Thematic Framed Video Preview OR Animated Gift Box */}
        {showFrameVideo ? (
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
                {isImageMedia ? (
                  <img
                    src={resolveMediaUrl(config.videoUrl)}
                    alt="Landing Preview"
                    onLoad={() => setIsVideoLoading(false)}
                    className="w-full h-full object-cover block mx-auto select-none pointer-events-none"
                  />
                ) : (
                  <video
                    key={`frame-${cachedVideoSrc || config.videoUrl || 'video'}`}
                    ref={videoElemRef}
                    src={cachedVideoSrc || resolveMediaUrl(config.videoUrl)}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    controls={false}
                    onLoadedMetadata={(e) => {
                      const videoWidth = e.target.videoWidth;
                      const videoHeight = e.target.videoHeight;
                      if (videoWidth && videoHeight) {
                        setElementDetectedRatio(videoHeight >= videoWidth ? 'portrait' : 'landscape');
                        setExactNumericRatio(videoWidth / videoHeight);
                      }
                      e.target.defaultMuted = true;
                      e.target.muted = true;
                      e.target.play().catch(() => {});
                    }}
                    onLoadedData={() => {
                      setIsVideoLoading(false);
                      if (videoElemRef.current) {
                        videoElemRef.current.play().catch(() => {});
                      }
                    }}
                    onCanPlay={() => {
                      setIsVideoLoading(false);
                      if (videoElemRef.current) {
                        videoElemRef.current.play().catch(() => {});
                      }
                    }}
                    onPlaying={() => {
                      setIsVideoLoading(false);
                    }}
                    onTimeUpdate={(e) => {
                      if (e.target.currentTime > 0) {
                        setIsVideoLoading(false);
                      }
                      // Keep background video in sync with frame video
                      if (showBackgroundVideo && bgVideoRef.current && e.target.currentTime > 0) {
                        const bgEl = bgVideoRef.current;
                        if (bgEl.paused) {
                          bgEl.currentTime = e.target.currentTime;
                          bgEl.play().catch(() => {});
                        } else if (Math.abs(bgEl.currentTime - e.target.currentTime) > 0.4) {
                          bgEl.currentTime = e.target.currentTime;
                        }
                      }
                    }}
                    onError={() => {
                      const direct = resolveMediaUrl(config.videoUrl);
                      if (cachedVideoSrc && cachedVideoSrc !== direct) {
                        setCachedVideoSrc(direct);
                      }
                      setIsVideoLoading(false);
                    }}
                    className="w-full h-full object-cover block mx-auto select-none pointer-events-none"
                  />
                )}

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
        ) : showBackgroundVideo ? (
          /* Clean Typography Hero for Background Video Mode (NO gift box, matching IMG_0556) */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="my-4 sm:my-6 flex flex-col items-center"
          >
            <div
              className={`tracking-wide text-center drop-shadow-xs ${
                isWedding
                  ? 'font-romantic text-4xl sm:text-5xl md:text-6xl text-rose-950 font-normal leading-tight drop-shadow-[0_1px_3px_rgba(255,255,255,0.95)]'
                  : 'font-bold text-2xl sm:text-3xl text-slate-800'
              }`}
            >
              {config.coupleNames || (isWedding ? 'Kevin & Sheila' : 'Special Celebration')}
            </div>
            <div
              className={`mt-1.5 sm:mt-2 text-center tracking-wide ${
                isWedding
                  ? 'font-romantic-serif italic text-sm sm:text-base text-rose-900/90 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]'
                  : 'text-xs sm:text-sm text-slate-500 font-medium'
              }`}
            >
              {config.eventDate || 'Saturday, 17 October 2026'}
            </div>
          </motion.div>
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

      {/* Floating Bottom Cache Progress Indicator - Centered Flex Container */}
      <AnimatePresence>
        {cacheProgress && (
          <div className="fixed inset-x-0 bottom-5 sm:bottom-7 z-40 flex justify-center pointer-events-none px-4">
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-[320px] sm:max-w-sm pointer-events-auto"
            >
              <div className="flex items-center gap-2.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-slate-700/60 shadow-xl shadow-black/40 text-white">
                {cacheProgress.isComplete ? (
                  <CheckCircle2 size={17} className="text-emerald-400 shrink-0" />
                ) : (
                  <DownloadCloud size={17} className="text-rose-400 shrink-0 animate-bounce" />
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs font-semibold">
                    <span className="truncate">
                      {cacheProgress.isComplete
                        ? 'Tersimpan di cache'
                        : 'Memuat ke cache'}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono">
                      <span className="text-rose-300 font-bold">
                        {cacheProgress.percent}%
                      </span>
                      {cacheProgress.loadedMB && (
                        <span className="text-[10px] text-slate-400">
                          ({cacheProgress.loadedMB}{cacheProgress.totalMB ? `/${cacheProgress.totalMB}` : ''} MB)
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        cacheProgress.isComplete
                          ? 'bg-emerald-400'
                          : 'bg-gradient-to-r from-rose-500 to-pink-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, cacheProgress.percent))}%` }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slide-over Drawer for Configuration (Only mounted/opened from configuration page) */}
      <LandingConfigDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        config={config}
        onUpdateConfig={handleUpdateConfig}
        onGoLive={handleGoLive}
        onOpenSessions={() => setIsSessionsModalOpen(true)}
        onOpenFrameManager={() => setIsFrameManagerOpen(true)}
        onOpenPrinterConfig={() => setIsPrinterConfigOpen(true)}
      />

      {/* Printer Configuration Modal (Root Level) */}
      <PrinterConfigModal
        isOpen={isPrinterConfigOpen}
        onClose={() => setIsPrinterConfigOpen(false)}
        config={config}
        onUpdateConfig={handleUpdateConfig}
      />

      {/* Frame Manager Modal */}
      <FrameManagerModal
        isOpen={isFrameManagerOpen}
        onClose={() => setIsFrameManagerOpen(false)}
        config={config}
        onUpdateConfig={handleUpdateConfig}
      />

      {/* Session Manager Modal */}
      <SessionManagerModal
        isOpen={isSessionsModalOpen}
        onClose={() => setIsSessionsModalOpen(false)}
        printerConfig={config}
      />

      {/* Session Access Code Modal (Opens if requireSessionCode is active) */}
      <SessionCodeModal
        isOpen={isSessionCodeModalOpen}
        onClose={() => setIsSessionCodeModalOpen(false)}
        onSuccess={proceedSessionLaunch}
        expectedCode={config.sessionCode || '1234'}
        theme={config.theme}
      />

      {/* Admin Exit Modal (Open lock & exit Live Mode) */}
      <AdminExitModal
        isOpen={isExitModalOpen}
        onClose={() => setIsExitModalOpen(false)}
        onSuccess={handleExitLive}
        expectedCode={config.adminExitCode || config.adminCode || '9999'}
        title="Buka Kunci Mode Live"
        description="Masukkan Kode Admin untuk membuka kunci dan keluar dari Mode Live Kiosk."
        actionLabel="Buka Kunci"
      />
    </div>
  );
}
