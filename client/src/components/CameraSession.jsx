import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Loader2, RotateCcw, Check, RefreshCw, X } from 'lucide-react';
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

  const totalPhotos =
    layoutConfig?.photoCount ||
    (layoutConfig?.layoutType && FRAME_CONFIGS[layoutConfig.layoutType]?.photoCount) ||
    3;

  const totalCountdownSeconds =
    layoutConfig?.countdownDuration ?? countdownDuration ?? 3;

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
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facingMode,
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
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
  }, [facingMode]);

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

    // Explicit ephemeral security purge of volatile captured image memory
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

  const executeShutter = () => {
    setIsFlashing(true);
    audioFx.playShutterSound();

    const video = videoRef.current;
    let photoData = '';

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = (video && video.videoWidth) || 1280;
      canvas.height = (video && video.videoHeight) || 720;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        if (facingMode === 'user') {
          // Mirror horizontally for front selfie camera
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        if (video) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      }

      photoData = canvas.toDataURL ? canvas.toDataURL('image/jpeg', 0.95) : 'data:image/jpeg;base64,mock';
    } else {
      photoData = 'data:image/jpeg;base64,mock';
    }

    timeoutRef.current = setTimeout(() => {
      setIsFlashing(false);
      setCountdown(null);
      // Put captured photo into review state instead of jumping directly to next pose
      setPoseReviewPhoto(photoData);
    }, 300);
  };

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

  const isMirrored = facingMode === 'user';

  return (
    <div className="relative flex flex-col items-center justify-between h-full h-[100dvh] max-h-[100dvh] w-full bg-slate-100 text-slate-800 overflow-hidden select-none p-2.5 sm:p-4">
      {/* Screen Flash Overlay */}
      {isFlashing && <div className="absolute inset-0 bg-white z-50 pointer-events-none" />}

      {/* Header Info (Grid 3-columns with true center pose badge) */}
      <div className="z-10 grid grid-cols-3 items-center w-full max-w-2xl shrink-0 mb-1">
        <div className="flex justify-start">
          <button
            onClick={handleCancel}
            aria-label="Batalkan Sesi"
            title="Batalkan Sesi"
            className="p-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex justify-center">
          <div className="bg-white px-3 py-0.5 rounded-full border border-slate-200 shadow-xs font-bold text-xs text-slate-700 whitespace-nowrap">
            Pose ke <span className="text-rose-600 font-extrabold text-sm">{currentPose + 1}</span> dari {totalPhotos}
          </div>
        </div>

        {/* Switch Camera Button for mobile / tablet devices */}
        <div className="flex justify-end">
          <button
            onClick={toggleCamera}
            aria-label="Ganti Kamera"
            title="Ganti Kamera (Depan / Belakang)"
            disabled={countdown !== null || Boolean(poseReviewPhoto)}
            className="p-1 sm:px-2.5 sm:py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-1 text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw size={13} />
            <span className="hidden sm:inline">{facingMode === 'user' ? 'Kamera Belakang' : 'Kamera Depan'}</span>
          </button>
        </div>
      </div>

      {/* Main Viewfinder / Pose Review Card */}
      <div className="relative z-10 w-full max-w-xl aspect-[3/4] sm:aspect-[4/3] max-h-[54vh] sm:max-h-[60vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-300 shadow-sm flex items-center justify-center my-auto shrink">
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

        {/* Pose Review Overlay */}
        {poseReviewPhoto && (
          <div className="absolute inset-0 z-30 bg-slate-900 flex flex-col items-center justify-center">
            <img
              src={poseReviewPhoto}
              alt={`Review Pose ${currentPose + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2.5 bg-white/90 backdrop-blur-xs px-3 py-0.5 rounded-full border border-slate-200 text-slate-800 font-bold text-[11px] shadow-xs">
              ✨ Review Pose {currentPose + 1}
            </div>
          </div>
        )}

        {/* Large Countdown Overlay */}
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

      {/* Bottom Controls */}
      <div className="z-10 flex flex-col items-center gap-2 w-full max-w-sm pt-1 shrink-0">
        {poseReviewPhoto ? (
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
            <button
              onClick={handleRetake}
              className="w-full sm:flex-1 py-2 sm:py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer active:scale-98"
            >
              <RotateCcw size={15} className="text-slate-500" />
              Foto Ulang (Retake)
            </button>
            <button
              onClick={handleAcceptPhoto}
              className="w-full sm:flex-1 py-2 sm:py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer active:scale-98"
            >
              <Check size={15} />
              Gunakan Foto Ini
            </button>
          </div>
        ) : (
          <button
            disabled={countdown !== null}
            onClick={triggerCaptureSequence}
            className={`w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer ${
              countdown !== null
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white'
            }`}
          >
            <Camera size={18} className="sm:w-5 sm:h-5" />
            {countdown !== null ? 'Bersiap...' : 'Ambil Gambar'}
          </button>
        )}
      </div>
    </div>
  );
}
