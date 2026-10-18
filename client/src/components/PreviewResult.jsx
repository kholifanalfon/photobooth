import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Printer, QrCode, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { composePhotosToFrame } from '../utils/canvasCompositor.js';
import QrModal from './QrModal.jsx';
import ResetConfirmModal from './ResetConfirmModal.jsx';

import { resolveApiUrl } from '../utils/apiConfig.js';
export { resolveApiUrl };

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
          textColor: layoutConfig?.palette?.text || layoutConfig?.textColor || '#1e293b',
          customFrame: layoutConfig?.customFrame
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

  // Read autoPrint config from localStorage once composite is ready
  useEffect(() => {
    if (!compositeUrl) return;

    let printerConfig = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        printerConfig = JSON.parse(window.localStorage.getItem('photobooth_landing_config') || '{}');
      } catch (e) {}
    }

    if (printerConfig.autoPrint) {
      handlePrint();
    }
  }, [compositeUrl]);

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

    let printerConfig = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        printerConfig = JSON.parse(window.localStorage.getItem('photobooth_landing_config') || '{}');
      } catch (e) {}
    }

    const printMethod = printerConfig.printMethod || 'kiosk';
    const copies = Number(printerConfig.printCopies) || 1;
    const printerName = printerConfig.printerName || 'Default System Printer';

    if (printMethod === 'bluetooth') {
      setIsPrinting(true);
      setPrintStatus('Menghubungkan ke Bluetooth Printer...');
      try {
        await bluetoothPrinter.printImage(compositeUrl);
        setPrintStatus('Cetak Bluetooth Berhasil!');
        if (printTimerRef.current) clearTimeout(printTimerRef.current);
        printTimerRef.current = setTimeout(() => {
          setPrintStatus(null);
          printTimerRef.current = null;
        }, 3000);
      } catch (btErr) {
        console.warn('Bluetooth print error:', btErr);
        setPrintStatus(`Bluetooth Error: ${btErr.message || 'Gagal cetak'}`);
        if (printTimerRef.current) clearTimeout(printTimerRef.current);
        printTimerRef.current = setTimeout(() => {
          setPrintStatus(null);
          printTimerRef.current = null;
        }, 4000);
      } finally {
        setIsPrinting(false);
      }
      return;
    }

    if (printMethod === 'browser') {
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      }
      return;
    }

    setIsPrinting(true);
    setPrintStatus('Mengirim ke printer...');

    try {
      const printEndpoint = resolveApiUrl('/api/print', apiBaseUrl);
      const res = await fetch(printEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copies,
          printerName,
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
    <div className="flex flex-col items-center justify-between h-full h-[100dvh] max-h-[100dvh] w-full bg-slate-50 text-slate-800 p-2.5 sm:p-4 md:p-6 select-none overflow-hidden">
      {/* Compact Header */}
      <div className="text-center pt-0.5 pb-1 shrink-0">
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mb-0.5">Hasil Fotomu Siap! 🎉</h2>
        <p className="text-slate-500 text-xs">
          Cetak langsung atau scan QR code untuk menyimpan di ponsel.
        </p>
      </div>

      {/* Frame Preview: Mengambil 70-80% Layar Kiosk */}
      <div className="h-[70vh] sm:h-[75vh] md:h-[78vh] w-full flex items-center justify-center my-auto shrink overflow-hidden">
        {compositeUrl ? (
          <img
            src={compositeUrl}
            alt="Composited Result"
            className="max-h-[68vh] sm:max-h-[73vh] md:max-h-[76vh] w-auto max-w-[94vw] object-contain rounded-2xl shadow-xl border border-slate-200/80"
          />
        ) : (
          <div className="text-slate-400 text-xs sm:text-sm">Merender komposit...</div>
        )}
      </div>

      {printStatus && (
        <div className="mt-1 flex items-center gap-1.5 text-emerald-700 font-semibold text-xs bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 animate-fade-in text-center shrink-0">
          <CheckCircle2 size={14} className="shrink-0" /> {printStatus}
        </div>
      )}

      {/* Action Buttons (Compact Flat Solid Design with single-line text) */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-1 sm:mt-2 w-full max-w-xl shrink-0">
        <button
          onClick={handlePrint}
          disabled={isPrinting || !compositeUrl}
          type="button"
          className="flex-1 min-w-[130px] whitespace-nowrap py-2 sm:py-2.5 px-3 sm:px-4 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-colors cursor-pointer active:scale-98"
        >
          <Printer size={15} className="shrink-0" />
          <span>Print Foto</span>
        </button>

        <button
          onClick={handleDownloadQr}
          disabled={isUploading || !compositeUrl}
          type="button"
          className="flex-1 min-w-[145px] whitespace-nowrap py-2 sm:py-2.5 px-3 sm:px-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-colors cursor-pointer active:scale-98"
        >
          <QrCode size={15} className="shrink-0" />
          <span>Download (QR)</span>
        </button>

        <button
          onClick={() => setIsResetOpen(true)}
          type="button"
          className="w-full sm:w-auto min-w-[130px] whitespace-nowrap py-2 sm:py-2.5 px-3 sm:px-4 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-xs flex items-center justify-center gap-1 text-xs sm:text-sm transition-colors cursor-pointer active:scale-98"
        >
          <RefreshCcw size={14} className="text-slate-500 shrink-0" />
          <span>Mulai Sesi Baru</span>
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
