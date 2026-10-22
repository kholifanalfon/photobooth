import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import LandingPage from './components/LandingPage.jsx';
import FrameSelector from './components/FrameSelector.jsx';
import CameraSession from './components/CameraSession.jsx';
import PreviewResult from './components/PreviewResult.jsx';
import DownloadPage from './components/DownloadPage.jsx';
import AdminLockScreen from './components/AdminLockScreen.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import EventSelectorScreen from './components/EventSelectorScreen.jsx';
import EventManagerModal from './components/EventManagerModal.jsx';
import AdminExitModal from './components/AdminExitModal.jsx';
import { resolveApiUrl } from './utils/apiConfig.js';
import { SLOT_PRESETS } from './constants/framePresets.js';
import {
  readAdminSessionTimestamp,
  touchAdminSession,
  clearAdminSession,
  isAdminSessionExpired
} from './utils/adminSession.js';

export default function App() {
  const [currentStep, setCurrentStep] = useState('LANDING'); // EVENT_SELECT | LANDING | FRAME_PICKER | CAMERA | PREVIEW | DOWNLOAD
  const [eventsList, setEventsList] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [isEventManagerOpen, setIsEventManagerOpen] = useState(false);
  const [isAdminExitModalOpenForSelector, setIsAdminExitModalOpenForSelector] = useState(false);
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
  const adminLastActivityRef = useRef(0);

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

  // Check existing session unlock state from localStorage (expires after 1 hour idle)
  useEffect(() => {
    const storedTimestamp = readAdminSessionTimestamp();
    if (storedTimestamp) {
      adminLastActivityRef.current = storedTimestamp;
      setIsBoothUnlocked(true);
    }
  }, []);

  // Re-lock kiosk after 1 hour without any user activity
  useEffect(() => {
    if (!isBoothUnlocked || typeof window === 'undefined') return;

    if (!adminLastActivityRef.current) {
      adminLastActivityRef.current = readAdminSessionTimestamp() || Date.now();
      touchAdminSession(adminLastActivityRef.current);
    }

    let lastPersistedAt = adminLastActivityRef.current;

    const markActivity = () => {
      const now = Date.now();
      adminLastActivityRef.current = now;
      if (now - lastPersistedAt >= 5000) {
        lastPersistedAt = now;
        touchAdminSession(now);
      }
    };

    const lockIfExpired = () => {
      if (isAdminSessionExpired(adminLastActivityRef.current)) {
        adminLastActivityRef.current = 0;
        clearAdminSession();
        setIsBoothUnlocked(false);
      }
    };

    const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll', 'wheel'];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, { passive: true });
    });

    const expiryTimer = window.setInterval(lockIfExpired, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        lockIfExpired();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });
      window.clearInterval(expiryTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isBoothUnlocked]);

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

  const fetchEvents = async () => {
    try {
      const url = resolveApiUrl('/api/events');
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const data = await res.json();
        const events = Array.isArray(data?.events) ? data.events : (Array.isArray(data) ? data : []);
        setEventsList(events);
        return events;
      }
    } catch (err) {
      console.warn('Failed to fetch events:', err);
    }
    return [];
  };

  useEffect(() => {
    let isMounted = true;
    const initEventsFlow = async () => {
      const events = await fetchEvents();
      if (!isMounted) return;

      let paramSlug = null;
      let paramEventId = null;
      if (typeof window !== 'undefined' && window.location.search) {
        try {
          const params = new URLSearchParams(window.location.search);
          paramSlug = params.get('event');
          paramEventId = params.get('eventId');
        } catch (_) {}
      }

      let storedEventId = null;
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          storedEventId = window.localStorage.getItem('photobooth_active_event_id');
        } catch (_) {}
      }

      const activeEvents = events.filter((e) => e && e.status !== 'INACTIVE');

      let matchedEvent = null;
      if (paramEventId) {
        matchedEvent = activeEvents.find((e) => e.id === paramEventId) || events.find((e) => e.id === paramEventId);
      }
      if (!matchedEvent && paramSlug) {
        matchedEvent = activeEvents.find((e) => e.slug === paramSlug) || events.find((e) => e.slug === paramSlug);
      }
      if (!matchedEvent && storedEventId) {
        matchedEvent = activeEvents.find((e) => e.id === storedEventId);
      }

      const isDownloadRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/download/');

      if (matchedEvent) {
        setActiveEvent(matchedEvent);
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem('photobooth_active_event_id', matchedEvent.id);
          } catch (_) {}
        }
        if (!isDownloadRoute) {
          setCurrentStep('LANDING');
        }
      } else if (activeEvents.length === 1) {
        const single = activeEvents[0];
        setActiveEvent(single);
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem('photobooth_active_event_id', single.id);
          } catch (_) {}
        }
        if (!isDownloadRoute) {
          setCurrentStep('LANDING');
        }
      } else if (activeEvents.length > 1) {
        if (!isDownloadRoute) {
          setActiveEvent(null);
          setCurrentStep('EVENT_SELECT');
        }
      }
    };

    initEventsFlow();

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
          adminLastActivityRef.current = 0;
          clearAdminSession();
          setIsBoothUnlocked(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLiveMode]);

  const effectiveLandingConfig = useMemo(() => {
    if (!landingConfig && !activeEvent) return null;
    const base = landingConfig || {};
    if (!activeEvent) return base;

    const eventCfg = activeEvent.config || {};
    return {
      ...base,
      ...eventCfg,
      title: eventCfg.title || eventCfg.eventTitle || base.title,
      subtitle: eventCfg.subtitle || eventCfg.eventSubtitle || base.subtitle,
      coupleNames: eventCfg.coupleNames || base.coupleNames,
      eventDate: eventCfg.eventDate || base.eventDate,
      footerText: eventCfg.footerText || base.footerText,
      theme: eventCfg.theme || base.theme || 'general',
      videoUrl: eventCfg.videoUrl || eventCfg.videoBgUrl || base.videoUrl || '',
      enableVideo: Boolean(eventCfg.videoUrl || eventCfg.videoBgUrl || base.enableVideo),
      printCopies: eventCfg.printCopies !== undefined ? eventCfg.printCopies : base.printCopies,
      paperSize: eventCfg.paperSize || base.paperSize || '4R',
      autoPrint: eventCfg.autoPrint !== undefined ? eventCfg.autoPrint : base.autoPrint
    };
  }, [landingConfig, activeEvent]);

  const handleSelectEvent = async (event) => {
    setActiveEvent(event);
    if (typeof window !== 'undefined' && window.localStorage && event?.id) {
      try {
        window.localStorage.setItem('photobooth_active_event_id', event.id);
      } catch (_) {}
    }
    if (event?.id) {
      try {
        const framesRes = await fetch(resolveApiUrl(`/api/config/frames?eventId=${encodeURIComponent(event.id)}`));
        if (framesRes.ok) {
          const frameData = await framesRes.json();
          const frames = frameData.customFrames || frameData.frames;
          if (Array.isArray(frames) && frames.length > 0) {
            setAvailableCustomFrames(frames.filter((f) => f && f.enabled));
          }
        }
      } catch (_) {}
    }
    setCurrentStep('LANDING');
  };

  const handleRequestSwitchEvent = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem('photobooth_active_event_id');
      } catch (_) {}
    }
    setActiveEvent(null);
    setCurrentStep('EVENT_SELECT');
  };

  const handleStartLanding = async (customFrame = null, customFrames = null) => {
    let newSessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    try {
      const postUrl = resolveApiUrl('/api/sessions');
      const payload = {
        eventId: activeEvent?.id || null,
        frameTemplate: customFrame?.id || 'custom',
        photoCount: Number(customFrame?.photoCount) || 4,
        frameColor: '#FFFFFF'
      };
      const res = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const created = await res.json();
        if (created && created.id) {
          newSessionId = created.id;
        }
      }
    } catch (err) {
      console.warn('Could not persist session to backend, using fallback ID:', err);
    }

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
            adminLastActivityRef.current = touchAdminSession();
            setIsBoothUnlocked(true);
          }}
          expectedCode={adminExitCode}
        />
      )}

      {/* Smooth Page Transitions without Stuck Freezing */}
      <motion.div
        key={currentStep}
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        className={`absolute inset-0 w-full h-full flex flex-col justify-center bg-slate-50 ${currentStep === "DOWNLOAD" ? "overflow-y-auto" : "overflow-hidden"}`}
      >
          {currentStep === 'DOWNLOAD' && (
            <DownloadPage filename={downloadFilename} />
          )}

          {currentStep === 'EVENT_SELECT' && (
            <EventSelectorScreen
              events={eventsList.filter((e) => e && e.status !== 'INACTIVE')}
              onSelectEvent={handleSelectEvent}
              onOpenAdmin={() => setIsAdminExitModalOpenForSelector(true)}
            />
          )}

          {currentStep === 'LANDING' && (
            <LandingPage
              initialConfig={effectiveLandingConfig}
              onConfigChange={(newCfg) => setLandingConfig(newCfg)}
              onStartSession={handleStartLanding}
              isLiveMode={isLiveMode}
              hasMultipleEvents={eventsList.filter((e) => e && e.status !== 'INACTIVE').length > 1}
              activeEventName={activeEvent?.name || ''}
              activeEventId={activeEvent?.id || null}
              onRequestSwitchEvent={handleRequestSwitchEvent}
              events={eventsList}
              onOpenEventManager={() => setIsEventManagerOpen(true)}
              onRefreshEvents={fetchEvents}
              onEnterLiveMode={() => {
                adminLastActivityRef.current = touchAdminSession();
                setIsBoothUnlocked(true);
                setIsLiveMode(true);
                if (typeof window !== 'undefined') {
                  try {
                    window.history.pushState(null, '', '/live');
                  } catch (_) {}
                }
              }}
              onExitLiveMode={() => {
                adminLastActivityRef.current = 0;
                clearAdminSession();
                setIsBoothUnlocked(false);
                setIsLiveMode(false);
                if (typeof window !== 'undefined') {
                  window.history.pushState(null, '', '/');
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
              printerConfig={effectiveLandingConfig}
            />
          )}
      </motion.div>

      {/* Root Event Manager Modal */}
      <EventManagerModal
        isOpen={isEventManagerOpen}
        onClose={() => setIsEventManagerOpen(false)}
        events={eventsList}
        onRefreshEvents={fetchEvents}
        currentEventId={activeEvent?.id}
      />

      {/* Admin Exit Modal for EventSelectorScreen */}
      <AdminExitModal
        isOpen={isAdminExitModalOpenForSelector}
        onClose={() => setIsAdminExitModalOpenForSelector(false)}
        onSuccess={() => {
          setIsAdminExitModalOpenForSelector(false);
          setIsEventManagerOpen(true);
        }}
        expectedCode={adminExitCode}
        title="Akses Pengaturan Admin"
        description="Masukkan Kode Admin untuk membuka pengelolaan event photobooth."
        actionLabel="Buka Kelola Event"
      />
    </div>
  );
}
