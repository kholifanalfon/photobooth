import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera } from 'lucide-react';
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

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'user'
          },
          audio: false
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          if (typeof videoRef.current.play === 'function') {
            videoRef.current.play().catch(() => {
              // Ignore browser autoplay/user gesture rejections safely
            });
          }
        }
      } catch (err) {
        if (mounted) {
          setCameraError('Gagal mengakses kamera. Pastikan izin kamera telah diberikan.');
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
  }, []);

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
      capturedPhotosRef.current.length > 0 &&
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
        // Mirror horizontally to match viewfinder preview
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        if (video) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      }

      photoData = canvas.toDataURL ? canvas.toDataURL('image/jpeg', 0.95) : 'data:image/jpeg;base64,mock';
    } else {
      photoData = 'data:image/jpeg;base64,mock';
    }

    const nextPhotos = [...capturedPhotosRef.current, photoData];
    capturedPhotosRef.current = nextPhotos;
    setCapturedPhotos(nextPhotos);

    timeoutRef.current = setTimeout(() => {
      setIsFlashing(false);
      setCountdown(null);

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
    }, 300);
  };

  const triggerCaptureSequence = () => {
    if (countdown !== null) return;

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
        <p className="text-rose-400 font-bold text-xl mb-4">{cameraError}</p>
        <button
          onClick={handleCancel}
          className="px-6 py-3 bg-white text-slate-900 rounded-full font-bold hover:bg-slate-100 transition-colors"
        >
          Kembali ke Menu
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-between min-h-screen w-full bg-slate-950 overflow-hidden select-none p-6">
      {/* Screen Flash Overlay */}
      {isFlashing && <div className="absolute inset-0 bg-white z-50 pointer-events-none" />}

      {/* Header Info */}
      <div className="z-10 flex items-center justify-between w-full max-w-4xl text-white">
        <button
          onClick={handleCancel}
          aria-label="Batalkan Sesi"
          className="text-slate-400 hover:text-white font-medium transition-colors"
        >
          Batalkan Sesi
        </button>
        <div className="bg-slate-800/80 backdrop-blur px-6 py-2 rounded-full border border-slate-700 font-bold text-sm">
          Pose ke <span className="text-pink-400 text-base">{currentPose + 1}</span> dari {totalPhotos}
        </div>
        <div className="w-20" />
      </div>

      {/* Main Viewfinder */}
      <div className="relative z-10 w-full max-w-3xl aspect-[4/3] bg-black rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />

        {/* Large Countdown Overlay */}
        <AnimatePresence>
          {countdown !== null && countdown > 0 && (
            <motion.div
              key={countdown}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-xs pointer-events-none"
            >
              <span className="text-9xl font-black text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
                {countdown}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <div className="z-10 flex flex-col items-center gap-4">
        <button
          disabled={countdown !== null}
          onClick={triggerCaptureSequence}
          aria-label={countdown !== null ? 'Bersiap...' : 'Ambil Gambar'}
          className={`px-10 py-5 rounded-full font-black text-2xl flex items-center gap-3 shadow-2xl transition-all ${
            countdown !== null
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-pink-600 to-rose-500 hover:scale-105 text-white shadow-pink-500/30'
          }`}
        >
          <Camera size={28} />
          {countdown !== null ? 'Bersiap...' : 'Ambil Gambar'}
        </button>
      </div>
    </div>
  );
}
