import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Printer, QrCode, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { composePhotosToFrame } from '../utils/canvasCompositor.js';
import QrModal from './QrModal.jsx';
import ResetConfirmModal from './ResetConfirmModal.jsx';

/**
 * Resolves the target API URL based on configuration or environment.
 * Supports standalone (e.g. http://localhost:5000) or proxied setups (e.g. relative /api).
 */
export function resolveApiUrl(path, customBaseUrl) {
  let base = customBaseUrl;
  if (base === undefined) {
    if (
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_API_BASE_URL !== undefined
    ) {
      base = import.meta.env.VITE_API_BASE_URL;
    } else {
      // In browser Vite dev or production SPA, empty base allows relative path through Vite proxy / Express router
      base = typeof window !== 'undefined' ? '' : 'http://localhost:5000';
    }
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) {
    return normalizedPath;
  }

  const cleanBase = String(base).replace(/\/+$/, '');
  return `${cleanBase}${normalizedPath}`;
}

export default function PreviewResult({
  photos = [],
  layoutConfig = {},
  onResetSession,
  sessionId,
  apiBaseUrl,
  initialCompositeUrl = null
}) {
  const [compositeUrl, setCompositeUrl] = useState(initialCompositeUrl);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [qrCodeDataUri, setQrCodeDataUri] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [printStatus, setPrintStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const printTimerRef = useRef(null);

  // Clear print timer on unmount
  useEffect(() => {
    return () => {
      if (printTimerRef.current) {
        clearTimeout(printTimerRef.current);
        printTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let isSubscribed = true;

    async function renderFrame() {
      if (!photos || photos.length === 0) return;

      try {
        const res = await composePhotosToFrame(photos, {
          layoutType: layoutConfig?.layoutType || 'STRIP_3',
          frameColor: layoutConfig?.palette?.hex || layoutConfig?.frameColor || '#FFFFFF',
          textColor: layoutConfig?.palette?.text || layoutConfig?.textColor || '#1e293b'
        });

        if (isSubscribed && res?.dataUrl) {
          setCompositeUrl(res.dataUrl);
        }
      } catch (err) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('Failed to compose photo frame:', err);
        }
      }
    }

    renderFrame();

    return () => {
      isSubscribed = false;
    };
  }, [photos, layoutConfig]);

  const handleDownloadQr = async () => {
    if (!compositeUrl) return;

    setIsQrOpen(true);
    if (!qrCodeDataUri) {
      setIsUploading(true);
      try {
        const uploadEndpoint = resolveApiUrl('/api/photos/upload', apiBaseUrl);
        const res = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: compositeUrl,
            sessionId: sessionId || undefined
          })
        });

        if (!res.ok) {
          throw new Error(`Upload returned status ${res.status}`);
        }

        const data = await res.json();
        setQrCodeDataUri(data.qrCodeDataUri || null);
        setDownloadUrl(data.downloadUrl || compositeUrl);
      } catch (err) {
        // Fallback: make compositeUrl available for direct viewing/download
        setDownloadUrl(compositeUrl);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handlePrint = async () => {
    if (!compositeUrl) return;

    setIsPrinting(true);
    setPrintStatus('Mengirim ke printer...');

    try {
      const printEndpoint = resolveApiUrl('/api/print', apiBaseUrl);
      const res = await fetch(printEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copies: 1,
          sessionId: sessionId || undefined
        })
      });

      if (!res.ok) {
        throw new Error(`Print server returned status ${res.status}`);
      }

      setPrintStatus('Terkirim ke antrean cetak!');
      if (printTimerRef.current) {
        clearTimeout(printTimerRef.current);
      }
      printTimerRef.current = setTimeout(() => {
        setPrintStatus(null);
        printTimerRef.current = null;
      }, 3000);
    } catch (err) {
      // Fallback: trigger native browser window print dialog
      setPrintStatus(null);
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handleConfirmReset = async () => {
    setIsResetOpen(false);

    if (sessionId) {
      try {
        const deleteEndpoint = resolveApiUrl(`/api/sessions/${sessionId}`, apiBaseUrl);
        await fetch(deleteEndpoint, { method: 'DELETE' });
      } catch (err) {
        // Ephemeral session cleanup is best-effort
      }
    }

    // Purge volatile client memory
    setCompositeUrl(null);
    setQrCodeDataUri(null);
    setDownloadUrl(null);

    if (onResetSession) {
      onResetSession();
    }
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-screen w-full bg-slate-100 text-slate-800 p-4 sm:p-6 md:p-10 select-none">
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1">Hasil Fotomu Siap! 🎉</h2>
        <p className="text-slate-500 text-xs sm:text-sm">
          Cetak langsung atau scan QR code untuk menyimpan di ponsel.
        </p>
      </div>

      {/* Frame Preview Card (Flat Container) */}
      <div className="max-h-[52vh] sm:max-h-[60vh] flex items-center justify-center p-3 bg-white rounded-2xl border border-slate-200 shadow-sm my-auto">
        {compositeUrl ? (
          <img
            src={compositeUrl}
            alt="Composited Result"
            className="max-h-[48vh] sm:max-h-[56vh] object-contain rounded-lg border border-slate-100"
          />
        ) : (
          <div className="text-slate-400 text-sm">Merender komposit...</div>
        )}
      </div>

      {printStatus && (
        <div className="mt-3 flex items-center gap-2 text-emerald-700 font-semibold text-xs sm:text-sm bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200 animate-fade-in text-center">
          <CheckCircle2 size={16} className="shrink-0" /> {printStatus}
        </div>
      )}

      {/* Action Buttons (Flat Solid Design) */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-4 sm:mt-6 w-full max-w-xl">
        <button
          onClick={handlePrint}
          disabled={isPrinting || !compositeUrl}
          type="button"
          className="flex-1 min-w-[140px] py-3.5 sm:py-4 px-4 sm:px-6 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 text-sm sm:text-base transition-colors cursor-pointer active:scale-98"
        >
          <Printer size={18} className="sm:w-5 sm:h-5" /> Print Foto
        </button>

        <button
          onClick={handleDownloadQr}
          disabled={isUploading || !compositeUrl}
          type="button"
          className="flex-1 min-w-[140px] py-3.5 sm:py-4 px-4 sm:px-6 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 text-sm sm:text-base transition-colors cursor-pointer active:scale-98"
        >
          <QrCode size={18} className="sm:w-5 sm:h-5" /> Download (QR)
        </button>

        <button
          onClick={() => setIsResetOpen(true)}
          type="button"
          className="w-full md:w-auto py-3.5 sm:py-4 px-5 sm:px-6 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl border border-slate-200 shadow-xs flex items-center justify-center gap-2 text-sm sm:text-base transition-colors cursor-pointer active:scale-98"
        >
          <RefreshCcw size={16} className="sm:w-[18px] sm:h-[18px] text-slate-500" /> Mulai Sesi Baru
        </button>
      </div>

      {/* Modals */}
      <QrModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        qrCodeDataUri={qrCodeDataUri}
        downloadUrl={downloadUrl}
        isLoading={isUploading}
      />
      <ResetConfirmModal
        isOpen={isResetOpen}
        onCancel={() => setIsResetOpen(false)}
        onConfirm={handleConfirmReset}
      />
    </div>
  );
}
