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
      base = 'http://localhost:5000';
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
      // Fallback: native browser printing for kiosks without print agent
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      }
      setPrintStatus(null);
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
    <div className="flex flex-col items-center justify-between min-h-screen w-full bg-slate-900 text-white p-6 md:p-10 select-none">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-black mb-1">Hasil Fotomu Siap! 🎉</h2>
        <p className="text-slate-400 text-sm">
          Cetak langsung atau scan QR code untuk menyimpan di ponsel.
        </p>
      </div>

      {/* Frame Preview Card */}
      <div className="max-h-[60vh] flex items-center justify-center p-2 bg-slate-800/60 rounded-2xl border border-slate-700 shadow-2xl">
        {compositeUrl ? (
          <img
            src={compositeUrl}
            alt="Composited Result"
            className="max-h-[58vh] object-contain rounded-lg shadow-lg"
          />
        ) : (
          <div className="text-slate-400">Merender komposit...</div>
        )}
      </div>

      {printStatus && (
        <div className="mt-4 flex items-center gap-2 text-emerald-400 font-bold bg-emerald-950/80 px-4 py-2 rounded-full border border-emerald-800 animate-fade-in">
          <CheckCircle2 size={18} /> {printStatus}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6 w-full max-w-xl">
        <button
          onClick={handlePrint}
          disabled={isPrinting || !compositeUrl}
          type="button"
          className="flex-1 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 text-lg transition-colors cursor-pointer"
        >
          <Printer size={22} /> Print Foto
        </button>

        <button
          onClick={handleDownloadQr}
          disabled={isUploading || !compositeUrl}
          type="button"
          className="flex-1 py-4 px-6 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 text-lg transition-colors cursor-pointer"
        >
          <QrCode size={22} /> Download (QR)
        </button>

        <button
          onClick={() => setIsResetOpen(true)}
          type="button"
          className="w-full md:w-auto py-4 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <RefreshCcw size={18} /> Mulai Sesi Baru
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

export { PreviewResult };
