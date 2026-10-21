import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import LandingPage from './components/LandingPage.jsx';
import FrameSelector from './components/FrameSelector.jsx';
import CameraSession from './components/CameraSession.jsx';
import PreviewResult from './components/PreviewResult.jsx';
import DownloadPage from './components/DownloadPage.jsx';
import AdminLockScreen from './components/AdminLockScreen.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import { SLOT_PRESETS } from './constants/framePresets.js';

const ADMIN_SESSION_KEY = 'photobooth_admin_session_unlocked';

export default function App() {
  const [currentStep, setCurrentStep] = useState('LANDING'); // LANDING | FRAME_PICKER | CAMERA | PREVIEW | DOWNLOAD
  const [layoutConfig, setLayoutConfig] = useState(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [landingConfig, setLandingConfig] = useState(null);
  const [availableCustomFrames, setAvailableCustomFrames] = useState([]);
  const [downloadFilename, setDownloadFilename] = useState(null);

  // Live Mode & Kiosk Lock States
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isBoothUnlocked, setIsBoothUnlocked] = useState(false);
  const [adminExitCode, setAdminExitCode] = useState('1234');
  const [showSplash, setShowSplash] = useState(true);

  // Check URL on load for /download/:filename route or /live route
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname.startsWith('/download/')) {
        const parts = pathname.split('/download/');
        if (parts[1]) {
          setDownloadFilename(decodeURIComponent(parts[1]));
          setCurrentStep('DOWNLOAD');
          return;
        }
      }

      if (pathname === '/live' || pathname === '/kiosk') {
        setIsLiveMode(true);
      }
    }
  }, []);

  // Check existing session unlock state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(ADMIN_SESSION_KEY);
        if (stored) {
          setIsBoothUnlocked(true);
        }
      } catch (_) {}
    }
  }, []);

  // Fetch landing config & admin settings directly on app bootstrap
  useEffect(() => {
    let isMounted = true;
    const fetchFreshConfig = async () => {
      try {
        // 1. Try /api/config/landing directly
        const res = await fetch(`/api/config/landing?t=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
          const data = await res.json();
          const config = data?.config || data;
          if (isMounted && config) {
            setLandingConfig(config);
            if (config.adminExitCode || config.adminCode) {
              setAdminExitCode(String(config.adminExitCode || config.adminCode));
            }
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                window.localStorage.setItem('photobooth_landing_config', JSON.stringify(config));
              } catch (_) {}
            }
            return;
          }
        }

        // 2. Fallback to /api/admin/settings
        const adminRes = await fetch(`/api/admin/settings?t=${Date.now()}`);
        if (adminRes.ok) {
          const data = await adminRes.json();
          if (isMounted && data) {
            if (data.adminExitCode) {
              setAdminExitCode(String(data.adminExitCode));
            }
            if (data.landingConfig) {
              setLandingConfig(data.landingConfig);
              if (data.landingConfig.adminCode) {
                setAdminExitCode(String(data.landingConfig.adminCode));
              }
              if (typeof window !== 'undefined' && window.localStorage) {
                try {
                  window.localStorage.setItem('photobooth_landing_config', JSON.stringify(data.landingConfig));
                } catch (_) {}
              }
            }
          }
        }
      } catch (_) {}
    };

    fetchFreshConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // Hide splash screen after brief delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Redirect to /live after splash if booth is already in Live mode
  useEffect(() => {
    if (showSplash || typeof window === 'undefined') return;

    const pathname = window.location.pathname;
    if (pathname !== '/' && pathname !== '') return;
    if (!landingConfig || !landingConfig.isLive) return;

    setIsLiveMode(true);
    try {
      window.history.replaceState(null, '', '/live');
    } catch (_) {}
  }, [showSplash, landingConfig]);

  // Keyboard shortcut: Shift + Escape to trigger lock screen when in live mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && e.key === 'Escape') {
        if (isLiveMode) {
          setIsBoothUnlocked(false);
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              window.localStorage.removeItem(ADMIN_SESSION_KEY);
            } catch (_) {}
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLiveMode]);

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
        (customFrame && Array.isArray(customFrame.slots) && customFrame.slots.length > 0)
          ? customFrame
          : {
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

      {/* Smooth Page Transitions without Stuck Freezing */}
      <AnimatePresence>
        <motion.div
          key={currentStep}
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
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
              printerConfig={landingConfig}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
