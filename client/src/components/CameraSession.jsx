import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Loader2, RotateCcw, Check, RefreshCw, X, FlipHorizontal, Timer, Zap, ZapOff, Maximize, Minimize } from 'lucide-react';
import { audioFx } from '../utils/audioEffects.js';
import { FRAME_CONFIGS } from '../utils/canvasCompositor.js';

export default function CameraSession({
  layoutConfig,
  countdownDuration = 3,
  onComplete,
  onCancel
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const capturedPhotosRef = useRef([]);

  const [currentPose, setCurrentPose] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [poseReviewPhoto, setPoseReviewPhoto] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const [isMirrored, setIsMirrored] = useState(false);
  const [selectedTimer, setSelectedTimer] = useState(3);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFlashSupported, setIsFlashSupported] = useState(false);
  const [isFlashEnabled, setIsFlashEnabled] = useState(false);

  const totalPhotos =
    layoutConfig?.photoCount ||
    (layoutConfig?.layoutType && FRAME_CONFIGS[layoutConfig.layoutType]?.photoCount) ||
    3;

  const totalCountdownSeconds = selectedTimer;
  const TIMER_OPTIONS = [3, 5, 10, 0];
  const cycleTimer = () => {
    if (countdown !== null || Boolean(poseReviewPhoto)) return;
    setSelectedTimer((prev) => {
      const idx = TIMER_OPTIONS.indexOf(prev);
      const nextIdx = (idx + 1) % TIMER_OPTIONS.length;
      return TIMER_OPTIONS[nextIdx];
    });
  };

  useEffect(() => {
    let mounted = true;
    async function getDevices() {
      if (!navigator?.mediaDevices?.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (mounted) {
          const vDevs = devices.filter((d) => d.kind === 'videoinput');
          setVideoDevices(vDevs);
        }
      } catch (e) {}
    }
    getDevices();
    if (navigator?.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', getDevices);
      return () => {
        mounted = false;
        navigator.mediaDevices.removeEventListener('devicechange', getDevices);
      };
    }
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('WebRTC getUserMedia is not supported');
        }

        // Stop existing tracks if switching camera
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // Tiered constraints: try HD first, fallback to standard if rejected
        let stream = null;
        const videoConstraints = selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } };
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false
          });
        } catch (initialErr) {
          // Fallback to basic video constraints with facingMode
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: facingMode },
              audio: false
            });
          } catch (secondaryErr) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
          }
        }

        if (!mounted) {
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;

        const videoTrack = stream.getVideoTracks()?.[0];
        let supportsFlash = false;
        if (videoTrack && typeof videoTrack.getCapabilities === "function") {
          try {
            const caps = videoTrack.getCapabilities() || {};
            supportsFlash = Boolean(caps.torch || (Array.isArray(caps.fillLightMode) && caps.fillLightMode.includes("flash")));
          } catch {
            supportsFlash = false;
          }
        }
        if (mounted) {
          setIsFlashSupported(supportsFlash);
          if (!supportsFlash) {
            setIsFlashEnabled(false);
          }
        }

        if (video) {
          video.srcObject = stream;

          const markReady = () => {
            if (mounted) {
              setIsVideoReady(true);
            }
          };

          // Robust playback initialization: wait for metadata / canplay event
          video.onloadedmetadata = () => {
            markReady();
            if (typeof video.play === 'function') {
              video.play().catch(() => {
                // Ignore autoplay gesture restrictions safely
              });
            }
          };

          if (typeof video.play === 'function') {
            video.play()
              .then(markReady)
              .catch(() => {
                // In mock test environments or restricted autoplay, mark ready so UI doesn't hang
                markReady();
              });
          } else {
            markReady();
          }
        } else {
          setIsVideoReady(true);
        }
      } catch (err) {
        if (mounted) {
          setCameraError('Gagal mengakses kamera. Pastikan izin kamera telah diberikan dan tidak sedang digunakan aplikasi lain.');
        }
      }
    }

    startCamera();

    return () => {
      mounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, selectedDeviceId]);

  const toggleCamera = () => {
    if (countdown !== null || poseReviewPhoto) return;
    setIsVideoReady(false);
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const clearTimers = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleCancel = () => {
    if (
      (capturedPhotosRef.current.length > 0 || poseReviewPhoto) &&
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function'
    ) {
      const confirmed = window.confirm('Apakah Anda yakin ingin membatalkan sesi foto?');
      if (!confirmed) return;
    }

    clearTimers();
    capturedPhotosRef.current = [];
    setCapturedPhotos([]);
    setPoseReviewPhoto(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (typeof onCancel === 'function') {
      onCancel();
    }
  };

  // Calculate active target slot from mapping frame configuration
  const activeSlot = (() => {
    if (
      layoutConfig?.customFrame &&
      Array.isArray(layoutConfig.customFrame.slots) &&
      layoutConfig.customFrame.slots.length > 0
    ) {
      const slots = layoutConfig.customFrame.slots;
      const matchingSlot = slots.find((s, idx) => {
        const pIdx = (s.photoIndex !== undefined && s.photoIndex !== null) ? Number(s.photoIndex) : idx;
        return pIdx === currentPose;
      });
      return matchingSlot || slots[currentPose] || slots[0];
    }
    const standardSlots =
      layoutConfig?.layoutType && FRAME_CONFIGS[layoutConfig.layoutType]?.slots;
    if (Array.isArray(standardSlots) && standardSlots.length > 0) {
      return standardSlots[currentPose] || standardSlots[0];
    }
    return { width: 1200, height: 900 }; // fallback default
  })();

  const slotWidth = Number(activeSlot?.width) > 0 ? Number(activeSlot.width) : 1200;
  const slotHeight = Number(activeSlot?.height) > 0 ? Number(activeSlot.height) : 900;
  const targetSlotRatio = slotWidth / slotHeight;

  const executeShutter = () => {
    setIsFlashing(true);
    audioFx.playShutterSound();

    const video = videoRef.current;
    let photoData = '';

    if (typeof document !== 'undefined') {
      const vW = (video && Number(video.videoWidth) > 0) ? video.videoWidth : 1280;
      const vH = (video && Number(video.videoHeight) > 0) ? video.videoHeight : 720;

      // Crop video frame precisely to target slot aspect ratio (matching viewfinder visible area)
      const videoRatio = vW / vH;
      let cropW = vW;
      let cropH = vH;
      let cropX = 0;
      let cropY = 0;

      if (videoRatio > targetSlotRatio) {
        // Video feed is wider than slot: crop left & right
        cropH = vH;
        cropW = Math.round(vH * targetSlotRatio);
        cropX = Math.round((vW - cropW) / 2);
        cropY = 0;
      } else {
        // Video feed is taller than slot: crop top & bottom
        cropW = vW;
        cropH = Math.round(vW / targetSlotRatio);
        cropX = 0;
        cropY = Math.round((vH - cropH) / 2);
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, cropW);
      canvas.height = Math.max(1, cropH);
      const ctx = canvas.getContext('2d');

      if (ctx) {
        if (isMirrored) {
          // Mirror horizontally when mirror is toggled ON
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        if (video) {
          try {
            ctx.drawImage(
              video,
              cropX,
              cropY,
              cropW,
              cropH,
              0,
              0,
              canvas.width,
              canvas.height
            );
          } catch {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        }
      }

      photoData = canvas.toDataURL ? canvas.toDataURL('image/jpeg', 0.95) : 'data:image/jpeg;base64,mock';
    } else {
      photoData = 'data:image/jpeg;base64,mock';
    }

    setTimeout(() => setIsFlashing(false), 200);
    setCountdown(null);
    setPoseReviewPhoto(photoData);
  };

  const toggleFlash = async () => {
    if (!isFlashSupported || !streamRef.current) return;
    const track = streamRef.current.getVideoTracks()?.[0];
    if (!track) return;

    const nextState = !isFlashEnabled;
    try {
      if (typeof track.applyConstraints === "function") {
        await track.applyConstraints({
          advanced: [{ torch: nextState }]
        });
      }
      setIsFlashEnabled(nextState);
    } catch (err) {
      console.warn("Torch constraint failed:", err);
    }
  };

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleRetake = () => {
    setPoseReviewPhoto(null);
  };

  const handleAcceptPhoto = () => {
    if (!poseReviewPhoto) return;
    const nextPhotos = [...capturedPhotosRef.current, poseReviewPhoto];
    capturedPhotosRef.current = nextPhotos;
    setCapturedPhotos(nextPhotos);
    setPoseReviewPhoto(null);

    if (nextPhotos.length >= totalPhotos) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (typeof onComplete === 'function') {
        onComplete(nextPhotos);
      }
    } else {
      setCurrentPose(nextPhotos.length);
    }
  };

  const triggerCaptureSequence = () => {
    if (countdown !== null || poseReviewPhoto) return;

    let timer = totalCountdownSeconds;
    if (timer <= 0) {
      setCountdown(0);
      audioFx.playCountdownBeep(true);
      executeShutter();
      return;
    }

    setCountdown(timer);
    audioFx.playCountdownBeep(false);

    intervalRef.current = setInterval(() => {
      timer -= 1;
      if (timer > 0) {
        setCountdown(timer);
        audioFx.playCountdownBeep(false);
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setCountdown(0);
        audioFx.playCountdownBeep(true);
        executeShutter();
      }
    }, 1000);
  };

  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center h-full h-[100dvh] bg-slate-50 text-slate-800 p-6 overflow-hidden">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
          <p className="text-rose-600 font-bold text-base sm:text-lg mb-4">{cameraError}</p>
          <button
            onClick={handleCancel}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors cursor-pointer text-sm"
          >
            Kembali ke Menu
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="relative flex flex-col items-center justify-between h-full h-[100dvh] max-h-[100dvh] w-full bg-slate-50 text-slate-800 overflow-hidden select-none p-2.5 sm:p-4">
      {/* Screen Flash Overlay */}
      {isFlashing && <div className="absolute inset-0 bg-white z-50 pointer-events-none" />}

      {/* Top Navigation & Settings Bar (Camera Select, Upload Image, Timer Select) */}
      <div className="z-20 flex items-center justify-center gap-2 sm:gap-3 w-full max-w-2xl shrink-0 mb-2">
        {/* Cancel button */}
        <button
          onClick={handleCancel}
          aria-label="Batalkan Sesi"
          title="Batalkan Sesi"
          className="p-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
        >
          <X size={16} />
        </button>

        {/* Camera Selector Dropdown */}
        <select
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          disabled={countdown !== null || Boolean(poseReviewPhoto)}
          aria-label="Pilih Kamera"
          className="px-2.5 py-1.5 bg-white border border-slate-300 text-slate-800 rounded-lg text-xs font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-rose-500 max-w-[190px] sm:max-w-[260px] truncate cursor-pointer"
        >
          {videoDevices.length > 0 ? (
            videoDevices.map((dev, idx) => (
              <option key={dev.deviceId || idx} value={dev.deviceId}>
                {dev.label || `Camera ${idx + 1}`}
              </option>
            ))
          ) : (
            <option value="">FaceTime HD Camera</option>
          )}
        </select>

        {/* Timer Badge (Replaces Select Dropdown) */}
        <button
          type="button"
          onClick={cycleTimer}
          disabled={countdown !== null || Boolean(poseReviewPhoto)}
          aria-label="Timer Badge"
          title={`Timer: ${selectedTimer}s (Klik untuk ubah durasi)`}
          className="px-3 py-1.5 bg-white hover:bg-slate-50 disabled:hover:bg-white border border-slate-300 text-slate-700 rounded-full text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
        >
          <Timer size={14} className="text-rose-500" />
          <span>{selectedTimer > 0 ? `${selectedTimer}s` : '0s'}</span>
        </button>

        {/* Pose Counter Badge */}
        <div className="hidden min-[480px]:flex bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-xs font-bold text-xs text-slate-700 whitespace-nowrap ml-auto">
          Pose <span className="text-rose-600 font-extrabold ml-1 mr-0.5">{currentPose + 1}</span>/{totalPhotos}
        </div>
      </div>

      {/* Main Viewfinder / Pose Review Card (Aspect ratio matches exact mapping slot configuration) */}
      <div
        data-testid="camera-viewfinder"
        style={{
          aspectRatio: `${slotWidth} / ${slotHeight}`,
          borderRadius: activeSlot?.radius ? `${Math.min(28, Number(activeSlot.radius))}px` : undefined
        }}
        className="relative z-10 w-full max-w-xl max-h-[52vh] sm:max-h-[60vh] bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-300 shadow-md flex items-center justify-center my-auto shrink transition-all duration-300"
      >
        {/* Mapping Frame Slot Dimension Indicator */}
        <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-bold text-white/90 z-20 flex items-center gap-1.5 border border-white/20 select-none pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span>Slot #{currentPose + 1}: {slotWidth}×{slotHeight}px</span>
        </div>
        {/* Loading Spinner until video stream is actively playing */}
        {!isVideoReady && !poseReviewPhoto && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-900 z-20">
            <Loader2 className="w-7 h-7 sm:w-9 sm:h-9 animate-spin text-rose-500" />
            <span className="text-xs font-medium text-slate-300">Menghubungkan kamera...</span>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${
            isMirrored ? 'scale-x-[-1]' : ''
          } transition-opacity duration-300 ${
            isVideoReady && !poseReviewPhoto ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Fullscreen Expand/Collapse Button (Bottom-Right of viewfinder matching user screenshot) */}
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Keluar Fullscreen' : 'Layar Penuh'}
          title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
          className="absolute bottom-3 right-3 z-30 p-2 rounded-xl bg-white/90 hover:bg-white text-slate-800 shadow-md border border-slate-200/90 transition-all cursor-pointer backdrop-blur-xs active:scale-95"
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>

        {/* Pose Review Overlay Snapshot (if photo captured) */}
        {poseReviewPhoto && (
          <img
            src={poseReviewPhoto}
            alt="Review Pose"
            className="absolute inset-0 w-full h-full object-cover z-20"
          />
        )}

        {/* Big Countdown Overlay */}
        <AnimatePresence>
          {countdown !== null && countdown > 0 && (
            <motion.div
              key={countdown}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-30"
            >
              <span className="text-7xl sm:text-9xl font-black text-white">
                {countdown}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Controls (Matching Screenshot: Mirror: Off/On, START, Flash: On/Off) */}
      <div className="z-20 flex flex-col items-center gap-2 w-full max-w-lg pt-2 shrink-0">
        {poseReviewPhoto ? (
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full max-w-sm">
            <button
              onClick={handleRetake}
              className="w-full sm:flex-1 py-2.5 px-3 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer active:scale-98"
            >
              <RotateCcw size={15} className="text-slate-500" />
              Foto Ulang (Retake)
            </button>
            <button
              onClick={handleAcceptPhoto}
              className="w-full sm:flex-1 py-2.5 px-3 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer active:scale-98"
            >
              <Check size={15} />
              Gunakan Foto Ini
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 sm:gap-4 w-full">
            {/* Mirror Toggle Button (Default Off) */}
            <button
              type="button"
              onClick={() => setIsMirrored((prev) => !prev)}
              aria-label="Toggle Mirror"
              title="Atur Mirror Kamera (Default Off)"
              className={`min-w-[100px] sm:min-w-[120px] py-2.5 sm:py-3 px-4 sm:px-5 rounded-full font-bold text-xs sm:text-sm border shadow-xs transition-all cursor-pointer active:scale-95 ${
                isMirrored
                  ? 'bg-rose-50 text-rose-600 border-rose-300'
                  : 'bg-white text-slate-700 hover:text-slate-900 border-rose-200 hover:border-rose-300'
              }`}
            >
              <span>Mirror: {isMirrored ? 'On' : 'Off'}</span>
            </button>

            {/* START Button */}
            <button
              type="button"
              disabled={countdown !== null}
              onClick={triggerCaptureSequence}
              aria-label="Mulai Pengambilan Foto"
              className={`min-w-[110px] sm:min-w-[130px] py-2.5 sm:py-3 px-6 sm:px-7 rounded-full font-extrabold text-xs sm:text-sm tracking-wide shadow-md transition-all cursor-pointer active:scale-95 ${
                countdown !== null
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white shadow-pink-200'
              }`}
            >
              {countdown !== null ? `${countdown}s...` : 'START'}
            </button>

            {/* Flash Indicator / Toggle */}
            {isFlashSupported ? (
              <button
                type="button"
                onClick={toggleFlash}
                aria-label="Toggle Flash"
                title={isFlashEnabled ? "Flash Aktif" : "Flash Nonaktif"}
                className={`min-w-[100px] sm:min-w-[120px] py-2.5 sm:py-3 px-4 sm:px-5 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95 ${
                  isFlashEnabled
                    ? "bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white shadow-pink-200"
                    : "bg-white text-slate-700 hover:text-slate-900 border border-slate-200"
                }`}
              >
                <Zap size={14} className={isFlashEnabled ? "text-white" : "text-slate-500"} />
                <span>Flash: {isFlashEnabled ? "On" : "Off"}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                aria-label="Flash Disabled"
                title="Flash kamera tidak didukung pada perangkat ini"
                className="min-w-[100px] sm:min-w-[120px] py-2.5 sm:py-3 px-4 sm:px-5 rounded-full font-bold text-xs sm:text-sm bg-slate-200 text-slate-400 border border-slate-300 shadow-none flex items-center justify-center gap-1.5 cursor-not-allowed opacity-80"
              >
                <ZapOff size={14} className="text-slate-400" />
                <span>Flash: Off</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
