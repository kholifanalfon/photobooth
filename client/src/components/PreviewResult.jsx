import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Printer, QrCode, RefreshCcw, CheckCircle2, AlertCircle, Loader2, Layers, Image as ImageIcon, Check } from 'lucide-react';
import { composePhotosToFrame, renderPhotoToPaper } from '../utils/canvasCompositor.js';
import QrModal from './QrModal.jsx';
import ResetConfirmModal from './ResetConfirmModal.jsx';
import { bluetoothPrinter } from '../utils/bluetoothPrinter.js';

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
  // Existing 8 useState hooks preserved in exact order for test harness index stability
  const [compositeUrl, setCompositeUrl] = useState(initialCompositeUrl);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [qrCodeDataUri, setQrCodeDataUri] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [printStatus, setPrintStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // States for Full Frame vs Foto Saja (Raw Photo) printing
  const [printMode, setPrintMode] = useState('frame'); // 'frame' | 'raw'
  const [selectedPoseIndices, setSelectedPoseIndices] = useState(() =>
    Array.isArray(photos) && photos.length > 0 ? photos.map((_, idx) => idx) : []
  );
  const [activePreviewPoseIndex, setActivePreviewPoseIndex] = useState(0);
  const [rawPhotoUrls, setRawPhotoUrls] = useState({});
  const [isPrintChoiceOpen, setIsPrintChoiceOpen] = useState(false);

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

  // Sync selected poses when photos change (default: all photos selected)
  useEffect(() => {
    if (Array.isArray(photos) && photos.length > 0) {
      setSelectedPoseIndices((prev) => {
        if (!prev || prev.length === 0 || prev.some((idx) => idx >= photos.length)) {
          return photos.map((_, idx) => idx);
        }
        return prev;
      });
    }
  }, [photos]);

  // Handle escape key to dismiss Print Choice modal
  useEffect(() => {
    if (!isPrintChoiceOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsPrintChoiceOpen(false);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isPrintChoiceOpen]);

  // Compose Full Frame composite
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
      handlePrint('frame');
    }
  }, [compositeUrl]);

  const handleDownloadQr = async () => {
    const targetUrl = compositeUrl;
    if (!targetUrl) return;

    setIsQrOpen(true);
    if (!qrCodeDataUri) {
      setIsUploading(true);
      try {
        const uploadEndpoint = resolveApiUrl('/api/photos/upload', apiBaseUrl);
        const res = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: targetUrl,
            sessionId: sessionId || undefined
          })
        });

        if (!res.ok) {
          throw new Error(`Upload returned status ${res.status}`);
        }

        const data = await res.json();
        setQrCodeDataUri(data.qrCodeDataUri || null);
        setDownloadUrl(data.downloadUrl || targetUrl);
      } catch (err) {
        setDownloadUrl(targetUrl);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handlePrint = async (overrideMode, overrideIndices) => {
    const activeMode = overrideMode || printMode;
    const activeIndices = overrideIndices !== undefined ? overrideIndices : selectedPoseIndices;

    if (activeMode === 'frame') {
      if (!compositeUrl) return;
    } else {
      if (activeIndices.length === 0) return;
    }

    let printerConfig = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        printerConfig = JSON.parse(window.localStorage.getItem('photobooth_landing_config') || '{}');
      } catch (e) {}
    }

    const printMethod = printerConfig.printMethod || 'kiosk';
    const copies = Number(printerConfig.printCopies) || 1;
    const printerName = printerConfig.printerName || 'Default System Printer';

    setIsPrinting(true);
    const imagesToPrint = [];

    if (activeMode === 'frame') {
      imagesToPrint.push(compositeUrl);
    } else {
      setPrintStatus('Menyiapkan lembar foto...');
      const targetIndices = activeIndices.length > 0 ? activeIndices : [0];
      for (const idx of targetIndices) {
        if (rawPhotoUrls[idx]) {
          imagesToPrint.push(rawPhotoUrls[idx]);
        } else if (photos[idx]) {
          try {
            const res = await renderPhotoToPaper(photos[idx], {
              paperSize: layoutConfig?.customFrame?.paperSize || '4R',
              orientation: layoutConfig?.customFrame?.orientation || 'portrait',
              customFrame: layoutConfig?.customFrame
            });
            if (res?.dataUrl) {
              setRawPhotoUrls((prev) => ({ ...prev, [idx]: res.dataUrl }));
              imagesToPrint.push(res.dataUrl);
            } else {
              imagesToPrint.push(photos[idx]);
            }
          } catch (err) {
            imagesToPrint.push(photos[idx]);
          }
        }
      }
    }

    if (imagesToPrint.length === 0) {
      setIsPrinting(false);
      return;
    }

    if (printMethod === 'bluetooth') {
      setPrintStatus(`Menghubungkan Bluetooth (${imagesToPrint.length} lembar)...`);
      try {
        if (typeof bluetoothPrinter !== 'undefined' && bluetoothPrinter.printImage) {
          if (!bluetoothPrinter.isConnected && typeof navigator !== 'undefined' && navigator.bluetooth) {
            setPrintStatus('Menyambungkan printer Bluetooth...');
            await bluetoothPrinter.connect();
          }

          const btDensity = Number(printerConfig.bluetoothDensity ?? 2);
          const btBrightness = Number(printerConfig.bluetoothBrightness ?? 22);
          const btContrast = Number(printerConfig.bluetoothContrast ?? 1.15);
          const btGamma = Number(printerConfig.bluetoothGamma ?? 1.75);
          const btDither = printerConfig.bluetoothDither || 'atkinson';
          const btSharpen = printerConfig.bluetoothSharpen !== false;
          const btLabelSize = printerConfig.bluetoothLabelSize || '50x30';
          const btLabelWidthMm = Number(printerConfig.bluetoothLabelWidthMm ?? 50);
          const btLabelHeightMm = btLabelSize === 'continuous' ? 0 : Number(printerConfig.bluetoothLabelHeightMm ?? 30);
          const btMarginMm = Number(printerConfig.bluetoothMarginMm ?? 1.5);
          const btFitMode = printerConfig.bluetoothFitMode || 'fit';
          const btAutoRotate = printerConfig.bluetoothAutoRotate !== false;

          for (let i = 0; i < imagesToPrint.length; i++) {
            setPrintStatus(`Mencetak lembar ${i + 1} dari ${imagesToPrint.length}...`);
            await bluetoothPrinter.printImage(imagesToPrint[i], {
              density: btDensity,
              brightness: btBrightness,
              contrast: btContrast,
              gamma: btGamma,
              ditherMethod: btDither,
              sharpen: btSharpen,
              labelWidthMm: btLabelWidthMm,
              labelHeightMm: btLabelHeightMm,
              marginMm: btMarginMm,
              fitMode: btFitMode,
              autoRotate: btAutoRotate,
              onProgress: (statusMsg) => {
                setPrintStatus(`Lembar ${i + 1}/${imagesToPrint.length}: ${statusMsg}`);
              }
            });
            if (i < imagesToPrint.length - 1) {
              await new Promise((r) => setTimeout(r, 600));
            }
          }
        }
        setPrintStatus('Cetak Bluetooth Berhasil!');
        if (printTimerRef.current) clearTimeout(printTimerRef.current);
        printTimerRef.current = setTimeout(() => {
          setPrintStatus(null);
          printTimerRef.current = null;
        }, 3000);
      } catch (btErr) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Bluetooth print error:', btErr);
        }
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
      setIsPrinting(false);
      return;
    }

    // Kiosk Server API Print
    setPrintStatus(
      imagesToPrint.length > 1
        ? `Mengirim ${imagesToPrint.length} lembar ke printer...`
        : 'Mengirim ke printer...'
    );

    try {
      const printEndpoint = resolveApiUrl('/api/print', apiBaseUrl);
      for (let i = 0; i < imagesToPrint.length; i++) {
        const res = await fetch(printEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            copies,
            printerName,
            sessionId: sessionId || undefined,
            sheetIndex: i,
            totalSheets: imagesToPrint.length,
            imageBase64: imagesToPrint[i]
          })
        });

        if (!res.ok) {
          throw new Error(`Print server returned status ${res.status}`);
        }
      }

      setPrintStatus(
        imagesToPrint.length > 1
          ? `${imagesToPrint.length} lembar terkirim ke antrean cetak!`
          : 'Terkirim ke antrean cetak!'
      );

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

  const handlePrintButtonClick = () => {
    if (Array.isArray(photos) && photos.length > 0) {
      setIsPrintChoiceOpen(true);
    } else {
      handlePrint('frame');
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

  const isPrintDisabled = isPrinting || !compositeUrl;

  return (
    <div className="flex flex-col items-center justify-between h-full h-[100dvh] max-h-[100dvh] w-full bg-slate-50 text-slate-800 p-2.5 sm:p-4 md:p-6 select-none overflow-hidden">
      {/* 0: Compact Header without mode switcher tab */}
      <div className="text-center pt-0.5 pb-1 shrink-0 flex flex-col items-center">
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mb-0.5">Hasil Fotomu Siap! 🎉</h2>
        <p className="text-slate-500 text-xs">
          Cetak langsung atau scan QR code untuk menyimpan di ponsel.
        </p>
      </div>

      {/* 1: Frame Preview (Full frame composite) */}
      <div className="h-[66vh] sm:h-[72vh] md:h-[75vh] w-full flex flex-col items-center justify-center my-auto shrink overflow-hidden">
        <div className="flex-1 flex items-center justify-center w-full min-h-0 overflow-hidden">
          {compositeUrl ? (
            <img
              src={compositeUrl}
              alt="Composited Result"
              className="max-h-full w-auto max-w-[94vw] object-contain rounded-2xl shadow-xl border border-slate-200/80"
            />
          ) : (
            <div className="text-slate-400 text-xs sm:text-sm">Merender komposit...</div>
          )}
        </div>
      </div>

      {/* 2: printStatus Message */}
      {printStatus && (
        <div className={`mt-1 flex items-center gap-1.5 font-semibold text-xs px-3 py-1 rounded-lg border animate-fade-in text-center shrink-0 ${
          printStatus.toLowerCase().includes('error') || printStatus.toLowerCase().includes('gagal')
            ? 'text-rose-700 bg-rose-50 border-rose-200'
            : printStatus.includes('...') || printStatus.toLowerCase().includes('proses') || printStatus.toLowerCase().includes('mengirim')
            ? 'text-purple-700 bg-purple-50 border-purple-200'
            : 'text-emerald-700 bg-emerald-50 border-emerald-200'
        }`}>
          {printStatus.toLowerCase().includes('error') || printStatus.toLowerCase().includes('gagal') ? (
            <AlertCircle size={14} className="shrink-0 text-rose-600" />
          ) : printStatus.includes('...') || printStatus.toLowerCase().includes('proses') || printStatus.toLowerCase().includes('mengirim') ? (
            <Loader2 size={14} className="shrink-0 animate-spin text-purple-600" />
          ) : (
            <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
          )}
          <span>{printStatus}</span>
        </div>
      )}

      {/* 3: Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-1 sm:mt-2 w-full max-w-xl shrink-0">
        <button
          onClick={handlePrintButtonClick}
          disabled={isPrintDisabled}
          type="button"
          className="flex-1 min-w-[140px] whitespace-nowrap py-2 sm:py-2.5 px-3 sm:px-4 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-colors cursor-pointer active:scale-98"
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

      {/* 4: QrModal */}
      <QrModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        qrCodeDataUri={qrCodeDataUri}
        downloadUrl={downloadUrl}
        isUploading={isUploading}
      />

      {/* 5: ResetConfirmModal */}
      <ResetConfirmModal
        isOpen={isResetOpen}
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetOpen(false)}
      />

      {/* 6: Print Choice Modal (Full Frame vs Foto Saja) */}
      {isPrintChoiceOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pilihan Cetak Foto"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 animate-fade-in"
          onClick={() => setIsPrintChoiceOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                  <Printer size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                    Pilihan Cetak Foto
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    Pilih format lembar yang ingin dicetak:
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintChoiceOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                title="Tutup dialog"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 custom-scrollbar">
              {/* Opsi Kartu Mode Cetak */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Mode: Full Frame */}
                <button
                  type="button"
                  onClick={() => setPrintMode('frame')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                    printMode === 'frame'
                      ? 'border-rose-500 bg-rose-50/70 shadow-sm ring-2 ring-rose-400/30'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      printMode === 'frame' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <Layers size={16} />
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      printMode === 'frame' ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-300'
                    }`}>
                      {printMode === 'frame' && <Check size={11} strokeWidth={3} />}
                    </div>
                  </div>
                  <div>
                    <div className="font-extrabold text-xs sm:text-sm text-slate-900">Full Frame</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Cetak lengkap desain frame, dekorasi & teks
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-slate-500">Jumlah cetak:</span>
                    <span className="font-extrabold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full">1 Lembar</span>
                  </div>
                </button>

                {/* Mode: Foto Saja */}
                <button
                  type="button"
                  onClick={() => setPrintMode('raw')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                    printMode === 'raw'
                      ? 'border-rose-500 bg-rose-50/70 shadow-sm ring-2 ring-rose-400/30'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      printMode === 'raw' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <ImageIcon size={16} />
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      printMode === 'raw' ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-300'
                    }`}>
                      {printMode === 'raw' && <Check size={11} strokeWidth={3} />}
                    </div>
                  </div>
                  <div>
                    <div className="font-extrabold text-xs sm:text-sm text-slate-900">Foto Saja</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Cetak lembar foto asli per pose tanpa bingkai
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-slate-500">Terpilih:</span>
                    <span className="font-extrabold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full">
                      {selectedPoseIndices.length} Pose
                    </span>
                  </div>
                </button>
              </div>

              {/* Sub-section: Daftar Foto untuk Foto Saja */}
              {printMode === 'raw' && Array.isArray(photos) && photos.length > 0 && (
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">
                      Pilih Foto ({selectedPoseIndices.length} dari {photos.length} terpilih):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPoseIndices.length === photos.length) {
                          setSelectedPoseIndices([]);
                        } else {
                          setSelectedPoseIndices(photos.map((_, i) => i));
                        }
                      }}
                      className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                    >
                      {selectedPoseIndices.length === photos.length ? 'Hapus Pilihan' : 'Pilih Semua'}
                    </button>
                  </div>

                  {/* Thumbnail grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[32vh] overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200/80 custom-scrollbar">
                    {photos.map((photo, idx) => {
                      const isChecked = selectedPoseIndices.includes(idx);
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedPoseIndices((prev) =>
                              prev.includes(idx)
                                ? prev.filter((i) => i !== idx)
                                : [...prev, idx].sort((a, b) => a - b)
                            );
                          }}
                          className={`group relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all flex flex-col items-center bg-white shadow-2xs ${
                            isChecked
                              ? 'border-rose-500 ring-2 ring-rose-400/40'
                              : 'border-slate-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <div className="w-full aspect-[3/4] relative overflow-hidden bg-slate-100">
                            <img
                              src={photo}
                              alt={`Foto ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {/* Checkbox badge */}
                            <div className={`absolute top-1 right-1 w-5 h-5 rounded-md flex items-center justify-center transition-colors shadow-xs ${
                              isChecked ? 'bg-rose-500 text-white' : 'bg-slate-900/50 text-white/40 border border-white/60'
                            }`}>
                              {isChecked ? <Check size={13} strokeWidth={3} /> : null}
                            </div>
                          </div>
                          <div className="py-1 px-1.5 w-full text-center bg-white">
                            <span className={`text-[10px] font-extrabold ${isChecked ? 'text-rose-600' : 'text-slate-500'}`}>
                              Foto #{idx + 1}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedPoseIndices.length === 0 && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-xl font-medium text-center">
                      ⚠️ Pilih minimal 1 foto di atas untuk melanjutkan cetak.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsPrintChoiceOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={printMode === 'raw' && selectedPoseIndices.length === 0}
                onClick={() => {
                  setIsPrintChoiceOpen(false);
                  handlePrint(printMode, selectedPoseIndices);
                }}
                className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-black disabled:opacity-40 text-white font-extrabold rounded-xl shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm transition-all cursor-pointer active:scale-98"
              >
                <Printer size={15} />
                <span>
                  {printMode === 'frame'
                    ? 'Cetak Full Frame (1 Lembar)'
                    : selectedPoseIndices.length > 0
                    ? `Cetak Foto (${selectedPoseIndices.length} Lembar)`
                    : 'Pilih Foto Terlebih Dahulu'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
