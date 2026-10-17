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
  if (explicitRatio === 'portrait' || explicitRatio === 'landscape') {
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
import { motion } from 'framer-motion';
import { Sparkles, Camera, Gift, SlidersHorizontal, Heart, AlertCircle } from 'lucide-react';
import { audioFx } from '../utils/audioEffects.js';
import LandingConfigDrawer, { THEME_PRESETS } from './LandingConfigDrawer.jsx';

const LOCAL_STORAGE_KEY = 'photobooth_landing_config';

const DEFAULT_CONFIG = {
  title: 'Capture The Magic! ✨',
  subtitle: 'Sentuh tombol untuk membuka kotak hadiah dan memulai sesi fotomu.',
  videoUrl: '',
  enableVideo: false,
  videoRatio: 'auto', // 'auto' | 'landscape' | 'portrait'
  theme: 'general',
  isTitleCustom: false,
  isSubtitleCustom: false
};

export default function LandingPage({ onStartSession }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [ytError, setYtError] = useState(null);
  const [elementDetectedRatio, setElementDetectedRatio] = useState(null);
  const iframeRef = useRef(null);
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
  const ytEmbedUrl = getYoutubeEmbedUrl(config.videoUrl);
  const gdriveEmbedUrl = getGoogleDriveEmbedUrl(config.videoUrl);

  const effectiveRatio = detectVideoAspectRatio(config.videoUrl, config.videoRatio, elementDetectedRatio);
  const isPortrait = effectiveRatio === 'portrait';

  useEffect(() => {
    setYtError(null);
    setElementDetectedRatio(null);
  }, [config.videoUrl]);

  const postToYouTube = (func, args = []) => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      }
    } catch (e) {}
  };

  // Autoplay attempt: Trigger play immediately upon load + gesture fallback
  useEffect(() => {
    if (!hasActiveVideo) return;

    postToYouTube('mute');
    postToYouTube('playVideo');

    if (videoElemRef.current) {
      videoElemRef.current.muted = true;
      const playPromise = videoElemRef.current.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    }

    const handleInteraction = () => {
      postToYouTube('mute');
      postToYouTube('playVideo');
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

  // YouTube postMessage event listener for error 150/101 detection
  useEffect(() => {
    const handleMessage = (e) => {
      if (!e.origin || (!e.origin.includes('youtube.com') && !e.origin.includes('youtube-nocookie.com'))) {
        return;
      }
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
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('message', handleMessage);
      }
    };
  }, []);

  const activeTheme = THEME_PRESETS[config.theme] || THEME_PRESETS.general;
  const isWedding = config.theme === 'wedding';

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

      {/* Main Container - Expands responsively when Hero Video is active */}
      <div
        className={`z-10 flex flex-col items-center w-full text-center px-3 sm:px-6 my-auto transition-all duration-300 ${
          hasActiveVideo
            ? isPortrait
              ? 'max-w-md'
              : 'max-w-4xl sm:max-w-5xl'
            : 'max-w-lg sm:max-w-xl'
        }`}
      >
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`font-extrabold ${activeTheme.headingClass} tracking-tight transition-all duration-300 ${
            hasActiveVideo
              ? 'text-lg sm:text-2xl md:text-3xl mb-1'
              : 'text-2xl sm:text-3xl md:text-4xl mb-1.5'
          }`}
        >
          {config.title || activeTheme.defaultTitle}
        </motion.h1>
        <p
          className={`${activeTheme.subheadingClass} font-normal transition-all duration-300 ${
            hasActiveVideo
              ? 'text-xs sm:text-sm mb-3 sm:mb-4 max-w-md line-clamp-2'
              : 'text-xs sm:text-sm md:text-base mb-4 sm:mb-5 max-w-sm'
          }`}
        >
          {config.subtitle || activeTheme.defaultSubtitle}
        </p>

        {/* Center Display: Thematic Framed Video Preview OR Animated Gift Box */}
        {hasActiveVideo ? (
          <div
            className={`relative mb-4 sm:mb-5 mx-auto select-none transition-all duration-300 ${
              isPortrait
                ? 'w-auto max-w-[300px] sm:max-w-[360px]'
                : 'w-full max-w-[500px] sm:max-w-[700px] md:max-w-[860px]'
            }`}
          >
            {/* Thematic Outer Frame Wrapping Video */}
            <div
              className={`relative p-2 sm:p-3 sm:pb-3.5 rounded-3xl transition-all duration-300 ${
                isWedding
                  ? 'bg-gradient-to-br from-rose-50/95 via-white to-amber-50/80 border-2 border-rose-200/90 shadow-2xl ring-1 ring-amber-300/40 shadow-rose-200/50'
                  : 'bg-white/95 border border-slate-200/90 shadow-2xl ring-1 ring-slate-100 shadow-slate-300/40'
              }`}
            >
              {/* Wedding Thematic Corner Ornaments & Ribbon */}
              {isWedding ? (
                <>
                  {/* Top-Left Corner Filigree Accent */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-rose-300 rounded-tl-xl pointer-events-none" />
                  {/* Top-Right Corner Filigree Accent */}
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-rose-300 rounded-tr-xl pointer-events-none" />
                  {/* Bottom-Left Corner Filigree Accent */}
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-rose-300 rounded-bl-xl pointer-events-none" />
                  {/* Bottom-Right Corner Filigree Accent */}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-rose-300 rounded-br-xl pointer-events-none" />

                  {/* Wedding Badge Header */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-rose-400 to-rose-500 text-white text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase rounded-full shadow-sm flex items-center gap-1.5 z-20 pointer-events-none whitespace-nowrap">
                    <Heart size={10} className="fill-white" />
                    <span>Wedding Celebration</span>
                    <Heart size={10} className="fill-white" />
                  </div>
                </>
              ) : (
                <>
                  {/* General Thematic Washi Tape Top Accent */}
                  <div className="absolute -top-2.5 left-6 w-12 sm:w-14 h-4 sm:h-5 bg-rose-200/80 backdrop-blur-2xs -rotate-2 border-l border-r border-dashed border-rose-300 shadow-2xs pointer-events-none rounded-2xs z-20" />
                  {/* General Badge Footer */}
                  <div className="absolute -bottom-2.5 right-5 px-2.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full shadow-xs flex items-center gap-1 z-20 pointer-events-none tracking-wide">
                    <Sparkles size={10} />
                    <span>PHOTOBOOTH</span>
                  </div>
                </>
              )}

              {/* Inner Video Viewport with Borderless Cropping & Interaction Lock */}
              <div
                className={`relative rounded-2xl overflow-hidden bg-black select-none border border-slate-900/10 ${
                  isPortrait
                    ? 'w-full aspect-[9/16] max-h-[54vh] sm:max-h-[60vh]'
                    : 'w-full aspect-video max-h-[54vh] sm:max-h-[60vh]'
                }`}
              >
                {/* Transparent Interaction Lock Layer to ensure clean video without external pop-outs or clicks */}
                <div className="absolute inset-0 z-10 select-none pointer-events-auto" />

                {ytEmbedUrl ? (
                  <>
                    <iframe
                      key={config.videoUrl}
                      ref={iframeRef}
                      src={ytEmbedUrl}
                      title="YouTube Video Preview"
                      onLoad={() => {
                        postToYouTube('mute');
                        postToYouTube('playVideo');
                      }}
                      className="w-full h-full border-0 pointer-events-none select-none scale-[1.02]"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                    {ytError && (
                      <div className="absolute inset-0 bg-black/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-20">
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
                ) : gdriveEmbedUrl ? (
                  <iframe
                    key={config.videoUrl}
                    src={gdriveEmbedUrl}
                    title="Google Drive Video Player"
                    className="absolute -top-[52px] -bottom-[52px] -left-[2px] -right-[2px] w-[calc(100%+4px)] h-[calc(100%+104px)] border-0 pointer-events-none select-none"
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                  />
                ) : (
                  <video
                    ref={videoElemRef}
                    src={config.videoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    onLoadedMetadata={(e) => {
                      if (e.target && e.target.videoWidth && e.target.videoHeight) {
                        setElementDetectedRatio(e.target.videoHeight > e.target.videoWidth ? 'portrait' : 'landscape');
                      }
                    }}
                    className="w-full h-full object-cover pointer-events-none select-none"
                  />
                )}
              </div>
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
