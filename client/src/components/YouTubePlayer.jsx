import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';

export function extractYoutubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match && match[1] ? match[1] : null;
}

export default function YouTubePlayer({ videoUrl, onOpenDrawer }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const videoId = extractYoutubeVideoId(videoUrl);

  useEffect(() => {
    setErrorMsg(null);
    if (!videoId) return;

    let isSubscribed = true;

    const initPlayer = () => {
      if (!isSubscribed || !containerRef.current) return;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) {}
      }

      try {
        playerRef.current = new window.YT.Player(containerRef.current, {
          width: '100%',
          height: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            mute: 1,
            playsinline: 1,
            controls: 1,
            rel: 0,
            origin: typeof window !== 'undefined' && window.location ? window.location.origin : undefined
          },
          events: {
            onReady: (event) => {
              if (!isSubscribed) return;
              try {
                event.target.mute();
                event.target.playVideo();
              } catch (e) {}
            },
            onStateChange: (event) => {
              if (!isSubscribed) return;
              if (window.YT && event.data === window.YT.PlayerState.ENDED) {
                try {
                  event.target.playVideo();
                } catch (e) {}
              }
            },
            onError: (event) => {
              if (!isSubscribed) return;
              if (event.data === 150 || event.data === 101) {
                setErrorMsg('Pemilik video YouTube ini membatasi pemutaran di situs eksternal (Error 150 / Hak Cipta). Silakan gunakan video YouTube lain yang mengizinkan embed atau unggah MP4 langsung.');
              } else if (event.data === 100 || event.data === 2) {
                setErrorMsg('Video YouTube tidak ditemukan atau link tidak valid.');
              }
            }
          }
        });
      } catch (err) {
        console.warn('Failed to initialize YouTube player', err);
      }
    };

    if (typeof window !== 'undefined') {
      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        const prevHandler = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (typeof prevHandler === 'function') prevHandler();
          initPlayer();
        };

        if (!document.getElementById('yt-iframe-api-script')) {
          const script = document.createElement('script');
          script.id = 'yt-iframe-api-script';
          script.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(script);
        }
      }
    }

    return () => {
      isSubscribed = false;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
    };
  }, [videoId]);

  if (!videoId) return null;

  return (
    <div className="relative w-full h-full bg-black">
      <div ref={containerRef} className="w-full h-full" />
      {errorMsg && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-10 animate-fade-in">
          <AlertCircle className="w-7 h-7 text-amber-400 mb-1.5 shrink-0" />
          <p className="text-xs text-slate-100 leading-relaxed font-medium max-w-xs">
            {errorMsg}
          </p>
          {onOpenDrawer && (
            <button
              type="button"
              onClick={onOpenDrawer}
              className="mt-2.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Buka Pengaturan Video
            </button>
          )}
        </div>
      )}
    </div>
  );
}
