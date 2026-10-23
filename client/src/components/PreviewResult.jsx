import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Printer, QrCode, RefreshCcw, CheckCircle2, AlertCircle, Loader2, Layers, Image as ImageIcon, Check, SlidersHorizontal } from 'lucide-react';
import { composePhotosToFrame, renderPhotoToPaper } from '../utils/canvasCompositor.js';
import QrModal from './QrModal.jsx';
import ResetConfirmModal from './ResetConfirmModal.jsx';
import PrintProgressModal from './PrintProgressModal.jsx';
import { bluetoothPrinter } from '../utils/bluetoothPrinter.js';

import { resolveApiUrl } from '../utils/apiConfig.js';
export { resolveApiUrl };

export default function PreviewResult({
  photos = [],
  layoutConfig = {},
  onResetSession,
  sessionId,
  apiBaseUrl,
  initialCompositeUrl = null,
  printerConfig: propPrinterConfig = null
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
  const [selectedPoseIndices, setSelectedPoseIndices] = useState(() => {
    const total = (initialCompositeUrl ? 1 : 0) + (Array.isArray(photos) ? photos.length : 0);
    return Array.from({ length: total }, (_, idx) => idx);
  });
  const [activePreviewPoseIndex, setActivePreviewPoseIndex] = useState(0);
  const [rawPhotoUrls, setRawPhotoUrls] = useState({});
  const [isPrintChoiceOpen, setIsPrintChoiceOpen] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [fullFrameCopies, setFullFrameCopies] = useState(1);
  const [itemCopies, setItemCopies] = useState({});

  const printTimerRef = useRef(null);
  const isPrintingRef = useRef(false);
  const hasAutoPrintedRef = useRef(false);
  const hasAutoSavedRef = useRef(false);
  const isMountedRef = useRef(true);
  const printCancelRef = useRef(false);
  const printProgressInfoRef = useRef({ currentSheet: 1, totalSheets: 1 });

  // Choice items for print selection: Full Frame composite + all pose photos
  const choiceItems = [];
  if (compositeUrl) {
    choiceItems.push({
      id: 'composite',
      type: 'composite',
      label: 'Full Frame',
      url: compositeUrl,
      isComposite: true
    });
  }
  if (Array.isArray(photos)) {
    photos.forEach((photo, idx) => {
      if (!photo) return;
      choiceItems.push({
        id: `pose_${idx}`,
        poseIndex: idx,
        type: 'pose',
        label: `Foto #${idx + 1}`,
        url: rawPhotoUrls[idx] || photo,
        isComposite: false
      });
    });
  }

  // Track component mounted status across async operations & clear print timer on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (printTimerRef.current) {
        clearTimeout(printTimerRef.current);
        printTimerRef.current = null;
      }
    };
  }, []);

  // Sync selected poses when choice items change (default: all available choices selected by default)
  useEffect(() => {
    if (choiceItems.length > 0) {
      setSelectedPoseIndices(choiceItems.map((_, idx) => idx));
    }
  }, [compositeUrl, Array.isArray(photos) ? photos.length : 0]);

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

  // Compose Full Frame composite locally in canvas for instant preview
  useEffect(() => {
    let isSubscribed = true;

    async function renderComposite() {
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
          setUploadError(false);
        }
      } catch (err) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('Failed to compose photo frame:', err);
        }
        if (isSubscribed) {
          setUploadError(true);
        }
      }
    }

    renderComposite();

    return () => {
      isSubscribed = false;
    };
  }, [photos, layoutConfig]);

  // Auto-save session results (composite full frame + individual poses) to backend & database
  useEffect(() => {
    if (!compositeUrl || !photos || photos.length === 0 || hasAutoSavedRef.current) return;
    hasAutoSavedRef.current = true;

    setIsUploading(true);

    async function autoSaveSession() {
      const activeSessionId = sessionId || `session_${Date.now()}`;
      const uploadEndpoint = resolveApiUrl('/api/photos/upload', apiBaseUrl);

      try {
        // 1. Upload composite full frame
        const compRes = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: compositeUrl,
            sessionId: activeSessionId,
            isComposite: true
          })
        });

        if (compRes.ok) {
          const compData = await compRes.json();
          if (isMountedRef.current) {
            if (compData.qrCodeDataUri) setQrCodeDataUri(compData.qrCodeDataUri);
            if (compData.downloadUrl) setDownloadUrl(compData.downloadUrl);
          }
        }

        // 2. Upload pose photos to server & database in parallel for optimal speed
        const uploadedPoseUrls = {};
        await Promise.all(
          photos.map(async (poseImg, i) => {
            if (!poseImg) return;
            try {
              const poseRes = await fetch(uploadEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageBase64: typeof poseImg === 'string' ? poseImg : (poseImg.url || poseImg.dataUrl || ''),
                  sessionId: activeSessionId,
                  poseIndex: i + 1,
                  isComposite: false
                })
              });
              if (poseRes.ok) {
                const poseData = await poseRes.json();
                if (poseData?.rawUrl || poseData?.relativeUrl) {
                  uploadedPoseUrls[i] = resolveApiUrl(poseData.relativeUrl || poseData.rawUrl, apiBaseUrl);
                }
              }
            } catch (pErr) {
              if (typeof console !== 'undefined' && console.warn) {
                console.warn(`Failed to upload pose ${i + 1}:`, pErr);
              }
            }
          })
        );

        if (isMountedRef.current) {
          setRawPhotoUrls(uploadedPoseUrls);
        }
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Failed to auto-save session to backend:', err);
        }
      } finally {
        if (isMountedRef.current) {
          setIsUploading(false);
        }
      }
    }

    autoSaveSession();
  }, [compositeUrl, photos, sessionId, apiBaseUrl]);

  // Read autoPrint config from localStorage or prop once composite is ready and upload has finished
  useEffect(() => {
    if (!compositeUrl || isUploading || hasAutoPrintedRef.current) return;

    let printerConfig = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        printerConfig = JSON.parse(window.localStorage.getItem('photobooth_landing_config') || '{}');
      } catch (e) {}
    }

    const effectiveConfig = {
      ...(propPrinterConfig || {}),
      ...printerConfig
    };

    if (effectiveConfig.autoPrint) {
      hasAutoPrintedRef.current = true;
      handlePrint('frame');
    }
  }, [compositeUrl, isUploading]);

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

  const handlePrint = async (overrideMode, overrideIndices, overrideCopies) => {
    // Concurrency guard: ignore duplicate triggers while active print job is running
    if (isPrintingRef.current) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Proses cetak sedang berlangsung, mengabaikan panggilan ganda.');
      }
      return;
    }

    const activeMode = overrideMode || printMode;
    const activeIndices = overrideIndices !== undefined ? overrideIndices : selectedPoseIndices;

    if (activeMode === 'frame') {
      if (!compositeUrl || isUploading) return;
    } else {
      if (activeIndices.length === 0 || isUploading) return;
    }

    try {
      isPrintingRef.current = true;
      printCancelRef.current = false;
      printProgressInfoRef.current = { currentSheet: 1, totalSheets: 1 };
      setIsPrinting(true);

      // 1. Live server fetch to ensure latest printer configuration is always applied
      let freshServerConfig = null;
      if (typeof window !== 'undefined' && window.location && window.location.host) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1200);
          const res = await fetch(`/api/config/landing?t=${Date.now()}`, {
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache' }
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            freshServerConfig = data?.config || data;
            if (freshServerConfig && typeof window !== 'undefined' && window.localStorage) {
              try {
                window.localStorage.setItem('photobooth_landing_config', JSON.stringify(freshServerConfig));
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      // 2. Read local storage cache
      let storedConfig = {};
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          storedConfig = JSON.parse(window.localStorage.getItem('photobooth_landing_config') || '{}');
        } catch (e) {}
      }

      // Priority: freshServerConfig > storedConfig > propPrinterConfig
      const printerConfig = {
        ...(propPrinterConfig || {}),
        ...storedConfig,
        ...(freshServerConfig || {})
      };

      const printMethod = printerConfig.printMethod || 'kiosk';
      // Safety clamp: copies can only be between 1 and 3 to prevent runaway print loops
      const copies = Math.min(Math.max(1, Number(printerConfig.printCopies) || 1), 3);
      const printerName = printerConfig.printerName || 'Default System Printer';

      const printJobs = [];

      if (activeMode === 'frame') {
        const frameCopies = overrideCopies !== undefined ? overrideCopies : fullFrameCopies;
        printJobs.push({ url: compositeUrl, copies: frameCopies });
      } else {
        setPrintStatus('Menyiapkan lembar foto...');
        const targetIndices = activeIndices.length > 0 ? activeIndices : choiceItems.map((_, i) => i);
        for (const idx of targetIndices) {
          const item = choiceItems[idx];
          if (!item) continue;
          const copiesForThisItem = itemCopies[idx] || 1;
          if (item.isComposite) {
            printJobs.push({ url: item.url, copies: copiesForThisItem });
          } else {
            const poseIdx = item.poseIndex !== undefined ? item.poseIndex : idx;
            if (rawPhotoUrls[poseIdx]) {
              printJobs.push({ url: rawPhotoUrls[poseIdx], copies: copiesForThisItem });
            } else if (photos[poseIdx]) {
              try {
                const res = await renderPhotoToPaper(photos[poseIdx], {
                  paperSize: layoutConfig?.customFrame?.paperSize || '4R',
                  orientation: layoutConfig?.customFrame?.orientation || 'portrait',
                  customFrame: layoutConfig?.customFrame
                });
                if (res?.dataUrl) {
                  setRawPhotoUrls((prev) => ({ ...prev, [poseIdx]: res.dataUrl }));
                  printJobs.push({ url: res.dataUrl, copies: copiesForThisItem });
                } else {
                  printJobs.push({ url: photos[poseIdx], copies: copiesForThisItem });
                }
              } catch (err) {
                printJobs.push({ url: photos[poseIdx], copies: copiesForThisItem });
              }
            }
          }
        }
      }

      if (printJobs.length === 0) {
        isPrintingRef.current = false;
        setIsPrinting(false);
        return;
      }

      const totalSheetsToPrint = printJobs.reduce((sum, job) => sum + job.copies, 0);

      if (printMethod === 'bluetooth') {
        printProgressInfoRef.current = { currentSheet: 1, totalSheets: totalSheetsToPrint };
        setPrintStatus(`Menghubungkan Bluetooth (${totalSheetsToPrint} lembar)...`);
        try {
          if (typeof bluetoothPrinter !== 'undefined' && bluetoothPrinter.printImage) {
            if (!bluetoothPrinter.isConnected && typeof navigator !== 'undefined' && navigator.bluetooth) {
              setPrintStatus('Menyambungkan printer Bluetooth...');
              await bluetoothPrinter.connect();
            }

            const btDensity = Number(printerConfig.bluetoothDensity ?? 1);
            const btBrightness = Number(printerConfig.bluetoothBrightness ?? 0);
            const btContrast = Number(printerConfig.bluetoothContrast ?? 1.10);
            const btGamma = Number(printerConfig.bluetoothGamma ?? 1.15);
            const btDither = printerConfig.bluetoothDither || 'atkinson';
            const btSharpen = printerConfig.bluetoothSharpen !== false;
            const btLabelSize = printerConfig.bluetoothLabelSize || '50x50';
            const btLabelWidthMm = Number(printerConfig.bluetoothLabelWidthMm ?? 50);
            const btLabelHeightMm = btLabelSize === 'continuous' ? 0 : Number(printerConfig.bluetoothLabelHeightMm ?? 50);
            const btMarginMm = Number(printerConfig.bluetoothMarginMm ?? 0);
            const btFitMode = printerConfig.bluetoothFitMode || 'fit';
            const btAutoRotate = printerConfig.bluetoothAutoRotate !== false;
            const btOrientation = printerConfig.printOrientation || 'portrait';

            let sheetCounter = 0;
            for (let i = 0; i < printJobs.length; i++) {
              if (printCancelRef.current) break;
              const job = printJobs[i];
              for (let c = 0; c < job.copies; c++) {
                if (printCancelRef.current) break;
                sheetCounter++;
                printProgressInfoRef.current = { currentSheet: sheetCounter, totalSheets: totalSheetsToPrint };
                setPrintStatus(`Mencetak lembar ${sheetCounter} dari ${totalSheetsToPrint}...`);
                await bluetoothPrinter.printImage(job.url, {
                  printerModelPreset: printerConfig.printerModelPreset || 'b1_pro',
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
                  orientation: btOrientation,
                  onProgress: (statusMsg) => {
                    setPrintStatus(`Lembar ${sheetCounter}/${totalSheetsToPrint}: ${statusMsg}`);
                  }
                });
                if (sheetCounter < totalSheetsToPrint && !printCancelRef.current) {
                  await new Promise((r) => setTimeout(r, 600));
                }
              }
            }
          }
          if (!printCancelRef.current) {
            setPrintStatus('Cetak Bluetooth Berhasil!');
            if (printTimerRef.current) clearTimeout(printTimerRef.current);
            printTimerRef.current = setTimeout(() => {
              setPrintStatus(null);
              printTimerRef.current = null;
            }, 3000);
          }
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
          isPrintingRef.current = false;
          setIsPrinting(false);
        }
        return;
      }

      if (printMethod === 'browser') {
        if (typeof window !== 'undefined' && typeof window.print === 'function') {
          window.print();
        }
        isPrintingRef.current = false;
        setIsPrinting(false);
        return;
      }

      // Kiosk Server API Print
      setPrintStatus(
        printJobs.length > 1 || totalSheetsToPrint > 1
          ? `Mengirim ${totalSheetsToPrint} lembar ke printer...`
          : 'Mengirim ke printer...'
      );

      const printEndpoint = resolveApiUrl('/api/print', apiBaseUrl);
      printProgressInfoRef.current = { currentSheet: 1, totalSheets: printJobs.length };
      for (let i = 0; i < printJobs.length; i++) {
        if (printCancelRef.current) {
          throw new Error('Pencetakan dibatalkan oleh pengguna.');
        }
        const job = printJobs[i];
        printProgressInfoRef.current = { currentSheet: i + 1, totalSheets: printJobs.length };
        const res = await fetch(printEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            copies: job.copies,
            printerName,
            paperSize: printerConfig.paperSize || layoutConfig?.customFrame?.paperSize || '4R',
            orientation: printerConfig.printOrientation || layoutConfig?.customFrame?.orientation || 'portrait',
            sessionId: sessionId || undefined,
            sheetIndex: i,
            totalSheets: printJobs.length,
            imageUrl: job.url,
            imageBase64: job.url
          })
        });

        if (!res.ok) {
          throw new Error(`Print server returned status ${res.status}`);
        }
      }

      setPrintStatus(
        totalSheetsToPrint > 1
          ? `${totalSheetsToPrint} lembar terkirim ke antrean cetak!`
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
      if (printCancelRef.current || err?.message?.includes('dibatalkan')) {
        setPrintStatus('Pencetakan dibatalkan.');
        if (printTimerRef.current) clearTimeout(printTimerRef.current);
        printTimerRef.current = setTimeout(() => {
          setPrintStatus(null);
          printTimerRef.current = null;
        }, 2000);
      } else {
        // Fallback: trigger native browser window print dialog
        setPrintStatus(null);
        if (typeof window !== 'undefined' && typeof window.print === 'function') {
          window.print();
        }
      }
    } finally {
      isPrintingRef.current = false;
      setIsPrinting(false);
    }
  };

  const handleCancelPrint = () => {
    printCancelRef.current = true;
    setPrintStatus('Pencetakan dibatalkan.');
    isPrintingRef.current = false;
    setIsPrinting(false);
    if (printTimerRef.current) {
      clearTimeout(printTimerRef.current);
      printTimerRef.current = null;
    }
    setTimeout(() => {
      setPrintStatus(null);
    }, 2000);
  };

  const handlePrintButtonClick = () => {
    if (isUploading) return;
    if (Array.isArray(photos) && photos.length > 0) {
      if (choiceItems.length > 0) {
        setSelectedPoseIndices(choiceItems.map((_, i) => i));
      }
      setFullFrameCopies(1);
      setItemCopies({});
      setIsPrintChoiceOpen(true);
    } else {
      return handlePrint('frame');
    }
  };

  const handleConfirmReset = async () => {
    setIsResetOpen(false);

    // Retain photos and session on the server/store so admin and users can revisit/download anytime.
    // Purge only volatile local client display state.
    setCompositeUrl(null);
    setQrCodeDataUri(null);
    setDownloadUrl(null);
    setRawPhotoUrls({});
    setFullFrameCopies(1);
    setItemCopies({});
    hasAutoSavedRef.current = false;
    hasAutoPrintedRef.current = false;

    if (onResetSession) {
      onResetSession();
    }
  };

  // Preview items for 1:1 view with SessionManagerModal (Full Frame + Raw Poses)
  const previewItems = [];
  if (compositeUrl) {
    previewItems.push({
      type: 'composite',
      label: 'Full Frame',
      url: compositeUrl,
      isComposite: true
    });
  }
  if (Array.isArray(photos)) {
    photos.forEach((photo, idx) => {
      if (!photo) return;
      previewItems.push({
        type: 'pose',
        label: `Pose ${idx + 1}`,
        url: rawPhotoUrls[idx] || photo,
        isPose: true,
        photoIndex: idx
      });
    });
  }

  const activePreviewItem = previewItems[activePreviewPoseIndex] || previewItems[0];
  const activeImageUrl = activePreviewItem?.url || compositeUrl;

  // Print button is strictly disabled while background upload to server is ongoing
  const isPrintDisabled = isPrinting || isUploading || !compositeUrl;

  return (
    <div className="flex flex-col items-center justify-between h-full h-[100dvh] max-h-[100dvh] w-full bg-slate-50 text-slate-800 p-2.5 sm:p-4 md:p-6 select-none overflow-hidden">
      {/* 0: Compact Header */}
      <div className="text-center pt-0.5 pb-1 shrink-0 flex flex-col items-center">
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mb-0.5">Hasil Fotomu Siap! 🎉</h2>
        <p className="text-slate-500 text-xs">
          Cetak langsung atau scan QR code untuk menyimpan di ponsel.
        </p>
      </div>

      {/* 1: Frame Preview (Full frame composite by default, switchable to raw poses 1:1 with Kelola Sesi) */}
      <div className="h-[66vh] sm:h-[72vh] md:h-[75vh] w-full flex flex-col items-center justify-center my-auto shrink overflow-hidden">
        <div className="flex-1 flex items-center justify-center w-full min-h-0 overflow-hidden">
          {activeImageUrl ? (
            <img
              src={activeImageUrl}
              alt={activePreviewItem?.label || "Hasil Fotomu Siap!"}
              className="max-h-full w-auto max-w-[94vw] object-contain rounded-2xl shadow-xl border border-slate-200/80"
            />
          ) : uploadError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center animate-fade-in bg-rose-50/70 border border-rose-200 rounded-2xl max-w-sm">
              <AlertCircle size={36} className="text-rose-600 mb-2" />
              <div className="font-bold text-slate-800 text-sm sm:text-base">Gagal Merender Komposit</div>
              <div className="text-slate-500 text-xs mt-1">
                Gagal memproses foto ke dalam frame. Silakan coba lagi.
              </div>
              <button
                type="button"
                onClick={() => {
                  setUploadError(false);
                  setCompositeUrl(null);
                }}
                className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <RefreshCcw size={14} />
                <span>Coba Lagi</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2.5 p-4 text-center animate-fade-in">
              <Loader2 size={32} className="text-rose-500 animate-spin" />
              <div className="text-slate-400 text-xs sm:text-sm">
                Merender komposit...
              </div>
            </div>
          )}
        </div>

        {/* Pose switcher tabs if session has multiple items (matching Kelola Sesi 1:1) */}
        {previewItems.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-2 overflow-x-auto max-w-full px-2 py-1 shrink-0">
            {previewItems.map((item, idx) => {
              const isSelected = (activePreviewPoseIndex === idx) || (!previewItems[activePreviewPoseIndex] && idx === 0);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePreviewPoseIndex(idx)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {item.type === 'composite' ? <Layers size={13} /> : <ImageIcon size={13} />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
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
          className="flex-1 sm:flex-none min-w-[130px] whitespace-nowrap py-2 sm:py-2.5 px-3 sm:px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold rounded-xl shadow-xs flex items-center justify-center gap-1 text-xs sm:text-sm transition-all cursor-pointer disabled:cursor-not-allowed active:scale-98"
        >
          {isPrinting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : isUploading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Printer size={14} />
          )}
          <span>{isPrinting ? 'Mencetak...' : isUploading ? 'Menyimpan...' : 'Print Foto'}</span>
        </button>

        <button
          onClick={handleDownloadQr}
          disabled={isPrintDisabled}
          type="button"
          className="flex-1 sm:flex-none min-w-[130px] whitespace-nowrap py-2 sm:py-2.5 px-3 sm:px-4 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-semibold rounded-xl shadow-xs flex items-center justify-center gap-1 text-xs sm:text-sm transition-all cursor-pointer disabled:cursor-not-allowed active:scale-98"
        >
          {isUploading && !qrCodeDataUri ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
          <span>Download (QR)</span>
        </button>

        <button
          onClick={() => setIsResetOpen(true)}
          type="button"
          className="w-full sm:auto min-w-[130px] whitespace-nowrap py-2 sm:py-2.5 px-3 sm:px-4 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-xs flex items-center justify-center gap-1 text-xs sm:text-sm transition-colors cursor-pointer active:scale-98"
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
                  <div
                    className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="font-semibold text-slate-500">Salinan (Copies):</span>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullFrameCopies((prev) => Math.max(1, prev - 1));
                        }}
                        className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer active:scale-95 transition-all"
                        title="Kurangi lembar"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={fullFrameCopies}
                        onChange={(e) => {
                          e.stopPropagation();
                          const val = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1));
                          setFullFrameCopies(val);
                        }}
                        className="w-7 text-center text-xs sm:text-sm font-extrabold text-slate-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullFrameCopies((prev) => Math.min(10, prev + 1));
                        }}
                        className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer active:scale-95 transition-all"
                        title="Tambah lembar"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </button>

                {/* Mode: Custom (Pilih Lembar) */}
                <button
                  type="button"
                  onClick={() => {
                    setPrintMode('custom');
                    setSelectedPoseIndices(choiceItems.map((_, i) => i));
                  }}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                    printMode === 'custom' || printMode === 'raw'
                      ? 'border-rose-500 bg-rose-50/70 shadow-sm ring-2 ring-rose-400/30'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      printMode === 'custom' || printMode === 'raw' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <SlidersHorizontal size={16} />
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      printMode === 'custom' || printMode === 'raw' ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-300'
                    }`}>
                      {(printMode === 'custom' || printMode === 'raw') && <Check size={11} strokeWidth={3} />}
                    </div>
                  </div>
                  <div>
                    <div className="font-extrabold text-xs sm:text-sm text-slate-900">Custom (Pilih Lembar)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Pilih bebas cetak foto dengan frame atau foto saja
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-slate-500">Terpilih:</span>
                    <span className="font-extrabold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full">
                      {selectedPoseIndices.reduce((sum, idx) => sum + (itemCopies[idx] || 1), 0)} Lembar
                    </span>
                  </div>
                </button>
              </div>

              {/* Sub-section: Daftar Foto untuk Custom (Menampilkan foto dengan frame & pose foto kamera) */}
              {(printMode === 'custom' || printMode === 'raw') && choiceItems.length > 0 && (
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">
                      Pilih Lembar Cetak ({selectedPoseIndices.length} dari {choiceItems.length} terpilih):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPoseIndices.length === choiceItems.length) {
                          setSelectedPoseIndices([]);
                        } else {
                          setSelectedPoseIndices(choiceItems.map((_, i) => i));
                        }
                      }}
                      className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                    >
                      {selectedPoseIndices.length === choiceItems.length ? 'Hapus Pilihan' : 'Pilih Semua'}
                    </button>
                  </div>

                  {/* Thumbnail grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[32vh] overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200/80 custom-scrollbar">
                    {choiceItems.map((item, idx) => {
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
                              src={item.url}
                              alt={item.label}
                              className="w-full h-full object-cover"
                            />
                            {/* Checkbox badge */}
                            <div className={`absolute top-1 right-1 w-5 h-5 rounded-md flex items-center justify-center transition-colors shadow-xs ${
                              isChecked ? 'bg-rose-500 text-white' : 'bg-slate-900/50 text-white/40 border border-white/60'
                            }`}>
                              {isChecked ? <Check size={13} strokeWidth={3} /> : null}
                            </div>
                            {/* Frame badge if composite */}
                            {item.isComposite && (
                              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold text-white flex items-center gap-0.5">
                                <Layers size={9} className="text-rose-400" />
                                <span>Frame</span>
                              </div>
                            )}
                          </div>
                          <div className="py-1.5 px-1.5 w-full text-center bg-white flex flex-col items-center">
                            <span className={`text-[11px] font-extrabold ${isChecked ? 'text-rose-600' : 'text-slate-500'}`}>
                              {item.label}
                            </span>
                            {/* Copies stepper per checked photo: borderless & larger touch targets */}
                            {isChecked && (
                              <div
                                className="mt-1 flex items-center justify-center gap-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setItemCopies((prev) => ({
                                      ...prev,
                                      [idx]: Math.max(1, (prev[idx] || 1) - 1)
                                    }));
                                  }}
                                  className="w-6 h-6 rounded-full flex items-center justify-center bg-slate-100 hover:bg-rose-100 hover:text-rose-600 active:bg-rose-200 text-slate-700 font-bold text-xs cursor-pointer active:scale-90 transition-all select-none"
                                  title="Kurangi lembar"
                                >
                                  -
                                </button>
                                <span className="min-w-[18px] text-center text-xs font-black text-slate-800 select-none">
                                  {itemCopies[idx] || 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setItemCopies((prev) => ({
                                      ...prev,
                                      [idx]: Math.min(10, (prev[idx] || 1) + 1)
                                    }));
                                  }}
                                  className="w-6 h-6 rounded-full flex items-center justify-center bg-slate-100 hover:bg-rose-100 hover:text-rose-600 active:bg-rose-200 text-slate-700 font-bold text-xs cursor-pointer active:scale-90 transition-all select-none"
                                  title="Tambah lembar"
                                >
                                  +
                                </button>
                              </div>
                            )}
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
                disabled={isPrinting || isUploading || ((printMode === 'custom' || printMode === 'raw') && selectedPoseIndices.length === 0)}
                onClick={() => {
                  setIsPrintChoiceOpen(false);
                  handlePrint(printMode, selectedPoseIndices);
                }}
                className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-black disabled:opacity-40 text-white font-extrabold rounded-xl shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm transition-all cursor-pointer active:scale-98"
              >
                {isPrinting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : isUploading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Printer size={15} />
                )}
                <span>
                  {isPrinting
                    ? 'Sedang Mencetak...'
                    : printMode === 'frame'
                    ? `Cetak Full Frame (${fullFrameCopies} Lembar)`
                    : selectedPoseIndices.length > 0
                    ? `Cetak Foto (${selectedPoseIndices.reduce((sum, idx) => sum + (itemCopies[idx] || 1), 0)} Lembar)`
                    : 'Pilih Foto Terlebih Dahulu'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Progress Modal with Animation & Cancel CTA */}
      <PrintProgressModal
        isOpen={isPrinting}
        status={printStatus || 'Sedang memproses antrean cetak...'}
        currentSheet={printProgressInfoRef.current?.currentSheet || 1}
        totalSheets={printProgressInfoRef.current?.totalSheets || 1}
        onCancel={handleCancelPrint}
        isFinished={printStatus?.toLowerCase()?.includes('berhasil') || printStatus?.toLowerCase()?.includes('terkirim')}
        isError={printStatus?.toLowerCase()?.includes('error') || printStatus?.toLowerCase()?.includes('gagal')}
      />
    </div>
  );
}
