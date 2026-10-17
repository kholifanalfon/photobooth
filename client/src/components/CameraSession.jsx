import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Loader2, RotateCcw, Check, RefreshCw } from 'lucide-react';
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
        <p className="text-rose-400 font-bold text-lg sm:text-xl mb-4 text-center">{cameraError}</p>
        <button
          onClick={handleCancel}
          className="px-6 py-3 bg-white text-slate-900 rounded-full font-bold hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Kembali ke Menu
        </button>
      </div>
    );
  }

  const isMirrored = facingMode === 'user';

  return (
    <div className="relative flex flex-col items-center justify-between min-h-screen w-full bg-slate-950 overflow-hidden select-none p-3 sm:p-6">
      {/* Screen Flash Overlay */}
      {isFlashing && <div className="absolute inset-0 bg-white z-50 pointer-events-none" />}

      {/* Header Info */}
      <div className="z-10 flex items-center justify-between w-full max-w-4xl text-white mb-2 sm:mb-4">
        <button
          onClick={handleCancel}
          aria-label="Batalkan Sesi"
          className="text-slate-400 hover:text-white font-medium text-xs sm:text-sm transition-colors cursor-pointer"
        >
          Batalkan Sesi
        </button>

        <div className="bg-slate-800/80 backdrop-blur px-3.5 sm:px-6 py-1.5 sm:py-2 rounded-full border border-slate-700 font-bold text-xs sm:text-sm">
          Pose ke <span className="text-pink-400 text-sm sm:text-base">{currentPose + 1}</span> dari {totalPhotos}
        </div>

        {/* Switch Camera Button for mobile / tablet devices */}
        <button
          onClick={toggleCamera}
          aria-label="Ganti Kamera"
          title="Ganti Kamera (Depan / Belakang)"
          disabled={countdown !== null || Boolean(poseReviewPhoto)}
          className="p-2 sm:px-3 sm:py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white flex items-center gap-1.5 text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer"
        >
          <RefreshCw size={15} />
          <span className="hidden sm:inline">{facingMode === 'user' ? 'Kamera Belakang' : 'Kamera Depan'}</span>
        </button>
      </div>

      {/* Main Viewfinder / Pose Review */}
      <div className="relative z-10 w-full max-w-3xl aspect-[3/4] sm:aspect-[4/3] max-h-[62vh] sm:max-h-[68vh] bg-black rounded-2xl sm:rounded-3xl overflow-hidden border-2 sm:border-4 border-slate-800 shadow-2xl flex items-center justify-center my-auto">
        {/* Loading Spinner until video stream is actively playing */}
        {!isVideoReady && !poseReviewPhoto && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3 bg-slate-900/90 z-20">
            <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-pink-500" />
            <span className="text-xs sm:text-sm font-medium">Menghubungkan kamera...</span>
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
          <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center">
            <img
              src={poseReviewPhoto}
              alt={`Review Pose ${currentPose + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 text-white font-bold text-xs sm:text-sm shadow-md">
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
              className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-xs pointer-events-none z-30"
            >
              <span className="text-8xl sm:text-9xl font-black text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
                {countdown}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <div className="z-10 flex flex-col items-center gap-3 w-full max-w-md pt-2 sm:pt-4">
        {poseReviewPhoto ? (
          <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-4 w-full">
            <button
              onClick={handleRetake}
              className="w-full sm:flex-1 py-3.5 sm:py-4 px-4 rounded-full font-bold text-sm sm:text-base flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-all cursor-pointer active:scale-98"
            >
              <RotateCcw size={18} className="sm:w-5 sm:h-5" />
              Foto Ulang (Retake)
            </button>
            <button
              onClick={handleAcceptPhoto}
              className="w-full sm:flex-1 py-3.5 sm:py-4 px-4 rounded-full font-bold text-sm sm:text-base flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white shadow-lg shadow-teal-500/25 transition-all cursor-pointer active:scale-98"
            >
              <Check size={18} className="sm:w-5 sm:h-5" />
              Gunakan Foto Ini
            </button>
          </div>
        ) : (
          <button
            disabled={countdown !== null}
            onClick={triggerCaptureSequence}
            className={`w-full sm:w-auto px-8 sm:px-10 py-3.5 sm:py-5 rounded-full font-black text-lg sm:text-2xl flex items-center justify-center gap-2.5 sm:gap-3 shadow-2xl transition-all cursor-pointer ${
              countdown !== null
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-pink-600 to-rose-500 hover:scale-105 active:scale-95 text-white shadow-pink-500/30'
            }`}
          >
            <Camera size={24} className="sm:w-7 sm:h-7" />
            {countdown !== null ? 'Bersiap...' : 'Ambil Gambar'}
          </button>
        )}
      </div>
    </div>
  );
}
