import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import LandingPage from './components/LandingPage';
import FrameSelector from './components/FrameSelector';
import CameraSession from './components/CameraSession';
import PreviewResult from './components/PreviewResult';
import DownloadPage from './components/DownloadPage';
import SplashScreen from './components/SplashScreen';
import AdminLockScreen from './components/AdminLockScreen';
import { SLOT_PRESETS } from './constants/framePresets.js';

const ADMIN_SESSION_KEY = "pb_admin_unlock_ts";
const ADMIN_SESSION_LIFETIME = 3 * 60 * 60 * 1000; // 3 Jam

function getStoredBoothUnlocked() {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const ts = window.localStorage.getItem(ADMIN_SESSION_KEY);
      if (ts && Date.now() - Number(ts) < ADMIN_SESSION_LIFETIME) {
        return true;
      }
    } catch (_) {}
  }
  return false;
}

export default function App() {
  const [currentStep, setCurrentStep] = useState('LANDING'); // LANDING, FRAME_PICKER, CAMERA, PREVIEW, DOWNLOAD
  const [layoutConfig, setLayoutConfig] = useState(null);
  const [availableCustomFrames, setAvailableCustomFrames] = useState([]);
  const [landingConfig, setLandingConfig] = useState(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [downloadFilename, setDownloadFilename] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [adminExitCode, setAdminExitCode] = useState('9999');
  const [isBoothUnlocked, setIsBoothUnlocked] = useState(() => getStoredBoothUnlocked());

  // Detect live mode from URL path or query parameters
  const [isLiveMode, setIsLiveMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const search = new URLSearchParams(window.location.search);
      return path === '/live' || search.get('mode') === 'live' || search.get('live') === 'true';
    }
    return false;
  });

  // Detect URL path to display dedicated mobile download page if accessed via /download/:filename
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/download/')) {
        const file = path.replace(/^\/download\//, '').split('?')[0];
        setDownloadFilename(file);
        setCurrentStep('DOWNLOAD');
        setShowSplash(false); // Direct mobile download doesn't need splash
      } else if (path === '/live') {
        setIsLiveMode(true);
      }
    }

    // Sync database configuration across all devices directly from server
    fetch(`/api/config/landing?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.config) {
          setLandingConfig(data.config);
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              window.localStorage.setItem('photobooth_landing_config', JSON.stringify(data.config));
            } catch (_) {}
          }
          if (data.config.adminExitCode) {
            setAdminExitCode(data.config.adminExitCode);
          }
          if (data.config.isLive !== undefined && (typeof window !== 'undefined' && window.location.pathname !== '/live')) {
            setIsLiveMode(Boolean(data.config.isLive));
          }
        }
      })
      .catch(() => {});
  }, []);

  // Dismiss splash screen smoothly after initial load
  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  // On resume from background in PWA, re-verify 3-hour session validity
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const isStillValid = getStoredBoothUnlocked();
        if (!isStillValid) {
          setIsBoothUnlocked(false);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const handleStartLanding = (customFrame = null, customFrames = null) => {
    const newSessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    setCurrentSessionId(newSessionId);
    const framesList = Array.isArray(customFrames) && customFrames.length > 0
      ? customFrames
      : (customFrame ? [customFrame] : []);

    let activeFrames = framesList.filter(
      (f) => f && f.enabled && Array.isArray(f.slots) && f.slots.length > 0
    );

    // If none are explicitly marked enabled, take all mapped frames with slots
    if (activeFrames.length === 0) {
      activeFrames = framesList.filter(
        (f) => f && Array.isArray(f.slots) && f.slots.length > 0
      );
    }

    // Fallback if no frames exist
    if (activeFrames.length === 0) {
      activeFrames = [
        customFrame || {
          id: 'frame-1',
          name: 'Frame 1 (4R)',
          enabled: true,
          orientation: 'portrait',
          width: 1200,
          height: 1800,
          imageUrl: '',
          slots: (SLOT_PRESETS[4]?.portrait || []).map((s) => ({ ...s }))
        }
      ];
    }

    setAvailableCustomFrames(activeFrames);
    setCurrentStep('FRAME_PICKER');
  };

  const handleConfirmFrame = (config) => {
    setLayoutConfig(config);
    setCurrentStep('CAMERA');
  };

  const handleCompletePhotos = (photos) => {
    setCapturedPhotos(photos);
    setCurrentStep('PREVIEW');
  };

  const handleResetSession = () => {
    setCapturedPhotos([]);
    setLayoutConfig(null);
    setCurrentSessionId(null);
    setCurrentStep('LANDING');
  };

  return (
    <div className="relative w-full h-full h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col justify-center bg-slate-50">
      {/* PWA Splash Screen on startup */}
      <AnimatePresence>
        {showSplash && <SplashScreen key="splash" />}
      </AnimatePresence>

      {/* Admin Lock Screen after reload/refresh on all pages except /download */}
      {isLiveMode && !isBoothUnlocked && currentStep !== 'DOWNLOAD' && (
        <AdminLockScreen
          onUnlock={() => {
            setIsBoothUnlocked(true);
            if (typeof window !== "undefined" && window.localStorage) {
              try {
                window.localStorage.setItem(ADMIN_SESSION_KEY, String(Date.now()));
              } catch (_) {}
            }
          }}
          expectedCode={adminExitCode}
        />
      )}

      {/* Smooth Page Transitions without Flashing */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
          className={`w-full h-full flex flex-col justify-center bg-slate-50 ${currentStep === "DOWNLOAD" ? "overflow-y-auto" : "overflow-hidden"}`}
        >
          {currentStep === 'DOWNLOAD' && (
            <DownloadPage filename={downloadFilename} />
          )}

          {currentStep === 'LANDING' && (
            <LandingPage
              initialConfig={landingConfig}
              onConfigChange={(newCfg) => setLandingConfig(newCfg)}
              onStartSession={handleStartLanding}
              isLiveMode={isLiveMode}
              onEnterLiveMode={() => {
                setIsBoothUnlocked(true);
                setIsLiveMode(true);
                if (typeof window !== 'undefined') {
                  try {
                    window.history.pushState(null, '', '/live');
                  } catch (_) {}
                }
              }}
              onExitLiveMode={() => {
                setIsLiveMode(false);
                if (typeof window !== 'undefined') {
                  window.history.pushState(null, "", "/");
                }
              }}
            />
          )}

          {currentStep === 'FRAME_PICKER' && (
            <FrameSelector
              onConfirm={handleConfirmFrame}
              onBack={() => setCurrentStep('LANDING')}
              availableCustomFrames={availableCustomFrames}
            />
          )}

          {currentStep === 'CAMERA' && (
            <CameraSession
              layoutConfig={layoutConfig}
              onComplete={handleCompletePhotos}
              onCancel={() => setCurrentStep('FRAME_PICKER')}
            />
          )}

          {currentStep === 'PREVIEW' && (
            <PreviewResult
              photos={capturedPhotos}
              layoutConfig={layoutConfig}
              sessionId={currentSessionId}
              onResetSession={handleResetSession}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
