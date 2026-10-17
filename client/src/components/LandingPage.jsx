export function getYoutubeEmbedUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/)|youtube-nocookie\.com\/(?:embed\/|v\/))([\w-]{11})/);
  if (match && match[1]) {
    const videoId = match[1];
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=1&playsinline=1&enablejsapi=1`;
  }
  return null;
}

export function parseEmbedCode(code) {
  if (!code || typeof code !== 'string') return null;
  const trimmed = code.trim();
  if (!trimmed) return null;

  // 1. Extract explicit iframe tag and src & allow
  const iframeMatch = trimmed.match(/<iframe\b[^>]*\ssrc=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    let src = iframeMatch[1].replace(/&amp;/g, '&');

    const allowMatch = trimmed.match(/allow=["']([^"']+)["']/i);
    let allow = allowMatch ? allowMatch[1] : 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    if (!allow.includes('autoplay')) {
      allow += '; autoplay';
    }

    if ((src.includes('youtube.com') || src.includes('youtube-nocookie.com')) && !src.includes('enablejsapi=')) {
      const sep = src.includes('?') ? '&' : '?';
      src = `${src}${sep}enablejsapi=1`;
    }

    return { type: 'iframe', src, allow };
  }

  // 2. Extract direct video tag
  const videoMatch = trimmed.match(/<video\b[^>]*\ssrc=["']([^"']+)["']/i);
  if (videoMatch && videoMatch[1]) {
    return { type: 'video', src: videoMatch[1] };
  }

  // 3. Direct YouTube URL entered in embed code box
  const directYt = getYoutubeEmbedUrl(trimmed);
  if (directYt) {
    return {
      type: 'iframe',
      src: directYt,
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
    };
  }

  // 4. Any loose src attribute containing http/https
  const looseSrcMatch = trimmed.match(/src=["'](https?:\/\/[^"']+)["']/i);
  if (looseSrcMatch && looseSrcMatch[1]) {
    return {
      type: 'iframe',
      src: looseSrcMatch[1].replace(/&amp;/g, '&'),
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
    };
  }

  // 5. Fallback raw html
  return { type: 'html', html: trimmed };
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
  embedCode: '',
  videoInputMode: 'url',
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

  const parsedEmbed = config.videoInputMode === 'code' ? parseEmbedCode(config.embedCode) : null;
  const hasActiveVideo =
    config.enableVideo &&
    ((config.videoInputMode === 'code' && parsedEmbed) ||
      ((config.videoInputMode || 'url') === 'url' && (config.videoUrl || '').trim().length > 0));

  useEffect(() => {
    setYtError(null);
    if (!hasActiveVideo) return;

    const triggerAutoplayNow = () => {
      postToYouTube('mute');
      postToYouTube('playVideo');
      if (videoElemRef.current) {
        videoElemRef.current.defaultMuted = true;
        videoElemRef.current.muted = true;
        videoElemRef.current.play().catch(() => {});
      }
    };

    // 1. Eksekusi instan saat komponen termount
    triggerAutoplayNow();

    // 2. Eksekusi pada event document ready (DOMContentLoaded & readystatechange)
    const handleDocReady = () => {
      triggerAutoplayNow();
      try {
        document.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        window.dispatchEvent(new Event('touchstart'));
      } catch (e) {}
    };

    if (typeof document !== 'undefined') {
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        handleDocReady();
      } else {
        document.addEventListener('DOMContentLoaded', handleDocReady, { once: true });
        document.addEventListener('readystatechange', handleDocReady, { once: true });
      }
    }

    // 3. Timers bertingkat setelah document ready saat iframe YouTube siap
    const timers = [150, 400, 800, 1500, 2500].map((delay) =>
      setTimeout(triggerAutoplayNow, delay)
    );

    // 4. Gesture listener fallback (sentuhan/klik pertama pengguna di layar)
    const handleInteraction = () => {
      triggerAutoplayNow();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('touchstart', handleInteraction, { passive: true });
      window.addEventListener('pointerdown', handleInteraction, { passive: true });
      window.addEventListener('click', handleInteraction);
    }

    return () => {
      timers.forEach(clearTimeout);
      if (typeof document !== 'undefined') {
        document.removeEventListener('DOMContentLoaded', handleDocReady);
        document.removeEventListener('readystatechange', handleDocReady);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('touchstart', handleInteraction);
        window.removeEventListener('pointerdown', handleInteraction);
        window.removeEventListener('click', handleInteraction);
      }
    };
  }, [config.videoUrl, config.enableVideo, config.videoInputMode, config.embedCode, hasActiveVideo]);

  // YouTube postMessage event listener for error 150/101 detection
  useEffect(() => {
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
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('message', handleMessage);
      }
    };
  }, []);

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
        {hasActiveVideo ? (
          <div className="relative mb-5 sm:mb-6 w-full max-w-[360px] sm:max-w-[480px] md:max-w-[540px] aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-black">
            {config.videoInputMode === 'code' && parsedEmbed ? (
              parsedEmbed.type === 'iframe' ? (
                <>
                  <iframe
                    key={parsedEmbed.src}
                    ref={iframeRef}
                    src={parsedEmbed.src}
                    title="YouTube Video Embed"
                    onLoad={() => {
                      postToYouTube('mute');
                      postToYouTube('playVideo');
                    }}
                    className="w-full h-full border-0 absolute inset-0 pointer-events-auto"
                    allow={parsedEmbed.allow}
                    referrerPolicy="strict-origin-when-cross-origin"
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
              ) : parsedEmbed.type === 'video' ? (
                <video
                  ref={videoElemRef}
                  src={parsedEmbed.src}
                  autoPlay
                  loop
                  muted
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  key={config.embedCode}
                  className="w-full h-full relative [&_*]:box-border [&_div]:!w-full [&_div]:!h-full [&_div]:!p-0 [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:!border-0 [&_iframe]:!absolute [&_iframe]:!inset-0 [&_video]:!w-full [&_video]:!h-full [&_video]:object-cover"
                  dangerouslySetInnerHTML={{ __html: parsedEmbed.html }}
                />
              )
            ) : getYoutubeEmbedUrl(config.videoUrl) ? (
              <>
                <iframe
                  key={config.videoUrl}
                  ref={iframeRef}
                  src={getYoutubeEmbedUrl(config.videoUrl)}
                  title="YouTube Video Preview"
                  onLoad={() => {
                    postToYouTube('mute');
                    postToYouTube('playVideo');
                  }}
                  className="w-full h-full border-0 pointer-events-auto"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
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
          className={`flex items-center justify-center gap-2.5 px-8 sm:px-10 py-3.5 sm:py-4 rounded-2xl font-bold text-base sm:text-lg shadow-md hover:shadow-lg transition-all cursor-pointer ${activeTheme.btnClass}`}
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
