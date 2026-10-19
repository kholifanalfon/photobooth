import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import {
  X,
  Check,
  Printer,
  Sparkles,
  SlidersHorizontal,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  RotateCw,
  Crop,
  ShieldCheck,
  RefreshCw,
  RotateCcw,
  HelpCircle,
  FileText,
  Compass,
  Layers,
  Target
} from 'lucide-react';
import {
  bluetoothPrinter,
  formatCanvasForThermalLabel,
  ditherCanvasThermal,
  PRINTER_MODEL_OPTIONS,
  getPrinterProfile
} from '../utils/bluetoothPrinter.js';

export default function PrinterConfigModal({
  isOpen,
  onClose,
  config = {},
  onUpdateConfig
}) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Bluetooth connection states
  const [isBtConnecting, setIsBtConnecting] = useState(false);
  const [isTestingBtPrint, setIsTestingBtPrint] = useState(false);
  const [isCalibratingGap, setIsCalibratingGap] = useState(false);
  const [btStatus, setBtStatus] = useState(null);

  // Preview & Zoom controls
  const [zoomLevel, setZoomLevel] = useState(100);
  const MIN_ZOOM = 60;
  const MAX_ZOOM = 200;
  const [previewPhotoType, setPreviewPhotoType] = useState('portrait'); // 'portrait' | 'landscape' | 'square'
  const [showDitherPreview, setShowDitherPreview] = useState(true);

  // Canvas refs
  const previewCanvasRef = useRef(null);

  // Current config values with fallbacks
  const labelSize = config.bluetoothLabelSize || '50x30';
  const labelWidthMm = Number(config.bluetoothLabelWidthMm ?? 50);
  const labelHeightMm = labelSize === 'continuous' ? 0 : Number(config.bluetoothLabelHeightMm ?? 30);
  const labelType = Number(config.bluetoothLabelType ?? (labelHeightMm <= 0 ? 3 : 1));
  const marginMm = Number(config.bluetoothMarginMm ?? 1.5);
  const fitMode = config.bluetoothFitMode || 'fit';
  const autoRotate = config.bluetoothAutoRotate !== false;
  const printOrientation = config.printOrientation || 'auto'; // 'auto' | 'portrait' | 'landscape'
  const density = Number(config.bluetoothDensity ?? 2);
  const brightnessPreset = config.bluetoothBrightnessPreset || 'terang';
  const brightness = Number(config.bluetoothBrightness ?? 22);
  const contrast = Number(config.bluetoothContrast ?? 1.15);
  const gamma = Number(config.bluetoothGamma ?? 1.75);
  const ditherMethod = config.bluetoothDither || 'atkinson';
  const sharpen = config.bluetoothSharpen !== false;
  const activeModelPreset = config.printerModelPreset || (() => {
    const dev = (config.bluetoothDeviceName || '').toUpperCase();
    if (dev.includes('B1 PRO') || dev.includes('B1PRO')) return 'b1_pro';
    if (dev.includes('B21 PRO') || dev.includes('B21PRO')) return 'b21_pro';
    if (dev.includes('B21S')) return 'b21s';
    if (dev.includes('B21')) return 'b21';
    if (dev.includes('B1')) return 'b1';
    if (dev.includes('D110') || dev.includes('D11')) return 'd110';
    return dev.includes('PRO') ? 'b1_pro' : 'b1';
  })();
  const activeProfile = getPrinterProfile(activeModelPreset, config.bluetoothDeviceName);
  const effectiveDpi = activeProfile.dpi;

  // Render preview canvas whenever options change
  useEffect(() => {
    if (!isOpen) return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    // Create a mock photo canvas according to previewPhotoType
    const mockCanvas = document.createElement('canvas');
    if (previewPhotoType === 'portrait') {
      mockCanvas.width = 1200;
      mockCanvas.height = 1800;
    } else if (previewPhotoType === 'landscape') {
      mockCanvas.width = 1800;
      mockCanvas.height = 1200;
    } else {
      mockCanvas.width = 1200;
      mockCanvas.height = 1200;
    }

    const mCtx = mockCanvas.getContext('2d');
    // Draw realistic mockup photo: background gradient, face silhouette, and text
    const grad = mCtx.createLinearGradient(0, 0, 0, mockCanvas.height);
    grad.addColorStop(0, '#e2e8f0');
    grad.addColorStop(1, '#94a3b8');
    mCtx.fillStyle = grad;
    mCtx.fillRect(0, 0, mockCanvas.width, mockCanvas.height);

    // Mock head & shoulders silhouette
    const cx = mockCanvas.width / 2;
    const cy = mockCanvas.height * 0.45;
    const headR = Math.min(mockCanvas.width, mockCanvas.height) * 0.22;

    mCtx.fillStyle = '#334155';
    mCtx.beginPath();
    mCtx.arc(cx, cy, headR, 0, Math.PI * 2);
    mCtx.fill();

    // Body
    mCtx.beginPath();
    mCtx.ellipse(cx, mockCanvas.height * 0.95, headR * 1.8, headR * 1.4, 0, 0, Math.PI * 2);
    mCtx.fill();

    // Eyes
    mCtx.fillStyle = '#ffffff';
    mCtx.beginPath();
    mCtx.arc(cx - headR * 0.35, cy - headR * 0.1, headR * 0.1, 0, Math.PI * 2);
    mCtx.arc(cx + headR * 0.35, cy - headR * 0.1, headR * 0.1, 0, Math.PI * 2);
    mCtx.fill();

    // Pupils
    mCtx.fillStyle = '#0f172a';
    mCtx.beginPath();
    mCtx.arc(cx - headR * 0.35, cy - headR * 0.1, headR * 0.05, 0, Math.PI * 2);
    mCtx.arc(cx + headR * 0.35, cy - headR * 0.1, headR * 0.05, 0, Math.PI * 2);
    mCtx.fill();

    // Smile
    mCtx.strokeStyle = '#ffffff';
    mCtx.lineWidth = headR * 0.05;
    mCtx.beginPath();
    mCtx.arc(cx, cy + headR * 0.1, headR * 0.4, 0.2 * Math.PI, 0.8 * Math.PI);
    mCtx.stroke();

    // Mock text watermark
    mCtx.fillStyle = '#0f172a';
    mCtx.font = `bold ${Math.round(mockCanvas.width * 0.06)}px sans-serif`;
    mCtx.textAlign = 'center';
    mCtx.fillText('PHOTOBOOTH PREVIEW', cx, mockCanvas.height * 0.85);

    // Format canvas to exact thermal label dimensions, orientation & margins
    const targetPixels = activeProfile.printheadPixels;
    const dotsPerMm = effectiveDpi / 25.4;
    const formatted = formatCanvasForThermalLabel(mockCanvas, {
      labelWidthMm,
      labelHeightMm,
      marginMm,
      fitMode,
      autoRotate,
      orientation: printOrientation,
      maxPrintheadPixels: targetPixels,
      dotsPerMm
    });

    let displayCanvas = formatted;
    if (showDitherPreview) {
      displayCanvas = ditherCanvasThermal(formatted, formatted.width, {
        algorithm: ditherMethod,
        brightness,
        contrast,
        gamma,
        sharpen
      });
    }

    // Set dimensions on visible canvas
    canvas.width = displayCanvas.width;
    canvas.height = displayCanvas.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(displayCanvas, 0, 0);
  }, [
    isOpen,
    previewPhotoType,
    showDitherPreview,
    labelSize,
    labelWidthMm,
    labelHeightMm,
    marginMm,
    fitMode,
    autoRotate,
    printOrientation,
    density,
    brightness,
    contrast,
    gamma,
    ditherMethod,
    sharpen,
    activeModelPreset
  ]);

  // Connect to bluetooth printer
  const handleConnect = async () => {
    setIsBtConnecting(true);
    setBtStatus(null);
    try {
      await bluetoothPrinter.connect();
      onUpdateConfig({
        bluetoothDeviceName: bluetoothPrinter.printerName,
        printMethod: 'bluetooth'
      });
      setBtStatus({
        type: 'success',
        message: `Terhubung ke ${bluetoothPrinter.printerName || 'Printer Bluetooth'}!`
      });
    } catch (err) {
      setBtStatus({
        type: 'error',
        message: err.message || 'Gagal menyambungkan Bluetooth.'
      });
    } finally {
      setIsBtConnecting(false);
    }
  };

  // Calibrate paper to gap
  const handleCalibrateGap = async () => {
    setIsCalibratingGap(true);
    setBtStatus({ type: 'info', message: 'Memposisikan kertas ke batas garis potong (gap)...' });
    try {
      if (!bluetoothPrinter.isConnected) {
        await bluetoothPrinter.connect();
        onUpdateConfig({ bluetoothDeviceName: bluetoothPrinter.printerName });
      }
      const res = await bluetoothPrinter.calibrateGap();
      setBtStatus({ type: 'success', message: res.message || 'Kertas berhasil diposisikan ke celah gap!' });
    } catch (err) {
      setBtStatus({ type: 'error', message: `Gagal kalibrasi gap: ${err.message}` });
    } finally {
      setIsCalibratingGap(false);
    }
  };

  // Test print
  const handleTestPrint = async () => {
    setIsTestingBtPrint(true);
    setBtStatus({ type: 'info', message: 'Menyiapkan slip tes cetak...' });
    try {
      if (!bluetoothPrinter.isConnected) {
        setBtStatus({ type: 'info', message: 'Menyambungkan printer Bluetooth...' });
        await bluetoothPrinter.connect();
        onUpdateConfig({ bluetoothDeviceName: bluetoothPrinter.printerName });
      }

      // Safe dimensions according to orientation:
      // For 50x30 mm die-cut sticker, keep canvas safely within label bounds
      // to never trigger the optical gap sensor prematurely!
      const testCanvas = document.createElement('canvas');
      const isPortrait = printOrientation === 'portrait' || (printOrientation === 'auto' && labelHeightMm > labelWidthMm);

      const testDpi = activeProfile.dpi;
      const testDotsPerMm = testDpi / 25.4;
      if (isPortrait) {
        testCanvas.width = Math.round(labelWidthMm * testDotsPerMm);
        testCanvas.height = Math.round(labelHeightMm * testDotsPerMm);
      } else {
        testCanvas.width = activeProfile.printheadPixels;
        testCanvas.height = Math.round(Math.max(10, (labelHeightMm - 2.5) * testDotsPerMm));
      }

      const tCtx = testCanvas.getContext('2d');
      tCtx.fillStyle = '#ffffff';
      tCtx.fillRect(0, 0, testCanvas.width, testCanvas.height);
      tCtx.fillStyle = '#000000';
      tCtx.font = 'bold 20px sans-serif';
      tCtx.textAlign = 'center';
      tCtx.fillText('PHOTOBOOTH TEST', testCanvas.width / 2, 45);
      tCtx.font = '14px sans-serif';
      tCtx.fillText(`Printer: ${bluetoothPrinter.printerName || 'Niimbot'}`, testCanvas.width / 2, 80);
      tCtx.fillText(`Mode: ${bluetoothPrinter.isNiimbot ? 'Niimbot Protocol' : 'ESC/POS'}`, testCanvas.width / 2, 110);
      tCtx.fillText(`Orientasi: ${printOrientation.toUpperCase()}`, testCanvas.width / 2, 140);
      tCtx.font = '12px monospace';
      tCtx.fillText(new Date().toLocaleTimeString(), testCanvas.width / 2, 175);
      tCtx.lineWidth = 2;
      tCtx.strokeRect(12, 12, testCanvas.width - 24, testCanvas.height - 24);

      await bluetoothPrinter.printImage(testCanvas, {
        printerModelPreset: activeModelPreset,
        labelType,
        density,
        ditherMethod,
        brightness,
        contrast,
        gamma,
        sharpen,
        labelWidthMm,
        labelHeightMm,
        marginMm,
        fitMode,
        autoRotate,
        orientation: printOrientation,
        onProgress: (msg) => setBtStatus({ type: 'info', message: msg })
      });
      setBtStatus({ type: 'success', message: 'Test cetak berhasil dikirim ke printer!' });
    } catch (err) {
      setBtStatus({ type: 'error', message: `Gagal test print: ${err.message}` });
    } finally {
      setIsTestingBtPrint(false);
    }
  };

  // Reset to optimal default settings (Balanced Natural / Hasil Kiri)
  const handleResetDefaults = () => {
    const payload = {
      printerModelPreset: 'b1_pro',
      bluetoothLabelSize: '50x50',
      bluetoothLabelWidthMm: 50,
      bluetoothLabelHeightMm: 50,
      bluetoothLabelType: 1,
      bluetoothMarginMm: 0,
      bluetoothFitMode: 'fit',
      bluetoothAutoRotate: true,
      printOrientation: 'portrait',
      bluetoothDensity: 1,
      bluetoothBrightnessPreset: 'asli',
      bluetoothBrightness: 0,
      bluetoothContrast: 1.10,
      bluetoothGamma: 1.15,
      bluetoothDither: 'atkinson',
      bluetoothSharpen: true
    };
    onUpdateConfig(payload);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const current = JSON.parse(window.localStorage.getItem('photobooth_landing_config') || '{}');
        window.localStorage.setItem('photobooth_landing_config', JSON.stringify({ ...current, ...payload }));
      } catch (_) {}
    }
    setZoomLevel(100);
    setShowDitherPreview(true);
    setBtStatus({ type: 'info', message: 'Pengaturan dikembalikan ke konfigurasi natural (Tonal Halus - Hasil Kiri).' });
  };

  // Explicitly persist all configuration states when closing
  const handleSaveAndClose = () => {
    const payload = {
      printerModelPreset: activeModelPreset,
      bluetoothLabelSize: labelSize,
      bluetoothLabelWidthMm: labelWidthMm,
      bluetoothLabelHeightMm: labelHeightMm,
      bluetoothLabelType: labelType,
      bluetoothMarginMm: marginMm,
      bluetoothFitMode: fitMode,
      bluetoothAutoRotate: autoRotate,
      printOrientation,
      bluetoothDensity: density,
      bluetoothBrightnessPreset: brightnessPreset,
      bluetoothBrightness: brightness,
      bluetoothContrast: contrast,
      bluetoothGamma: gamma,
      bluetoothDither: ditherMethod,
      bluetoothSharpen: sharpen
    };
    onUpdateConfig(payload);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const current = JSON.parse(window.localStorage.getItem('photobooth_landing_config') || '{}');
        window.localStorage.setItem('photobooth_landing_config', JSON.stringify({ ...current, ...payload }));
      } catch (_) {}
    }
    onClose();
  };

  if (!isOpen) return null;

  // Calculate pixel bounds & display dimensions
  const dotsPerMm = 8;
  const canvasWidthPx = Math.min(384, Math.round(labelWidthMm * dotsPerMm));
  const canvasHeightPx = labelHeightMm > 0 ? Math.round(labelHeightMm * dotsPerMm) : 'Auto (Roll)';

  const modalMarkup = (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="printer-modal-title"
      >
        {/* Modal Window Container */}
        <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl w-full max-w-5xl h-[94vh] max-h-[820px] flex flex-col overflow-hidden text-slate-100">

          {/* Modal Header */}
          <header className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-xl shadow-md">
                <Printer size={18} />
              </div>
              <div>
                <h2 id="printer-modal-title" className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>Konfigurasi Printer & Label Stiker</span>
                  <span className="text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                    {effectiveDpi} DPI
                  </span>
                </h2>
                <p className="text-xs text-slate-400 hidden sm:block">
                  Atur ukuran stiker, orientasi cetak, margin aman anti-terpotong, dan rasterisasi foto thermal.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Dither Simulation Toggle */}
              <button
                type="button"
                onClick={() => setShowDitherPreview(!showDitherPreview)}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  showDitherPreview
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
                title="Simulasi Hasil Cetak Thermal (Halftone Dots)"
              >
                <Sparkles size={13} />
                <span className="hidden md:inline">{showDitherPreview ? 'Simulasi Cetak: Aktif' : 'Simulasi: Asli'}</span>
              </button>

              {/* Save & Close Button */}
              <button
                type="button"
                onClick={handleSaveAndClose}
                className="py-1.5 px-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-98"
                title="Selesai dan terapkan pengaturan"
              >
                <Check size={14} />
                <span className="hidden sm:inline">Selesai & Simpan</span>
                <span className="sm:hidden">Simpan</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Tutup Modal"
                aria-label="Tutup Modal"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {/* Main Content Area (Responsive Split Pane) */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
            {/* Left / Top: Interactive Live Print Preview Canvas */}
            <div className="h-[260px] sm:h-[320px] lg:h-full lg:flex-1 bg-slate-950/80 p-3 sm:p-5 flex flex-col items-center justify-between shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800 relative select-none overflow-hidden">
              {/* Dedicated Preview Toolbar */}
              <div className="w-full max-w-md flex items-center justify-between gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-md shrink-0">
                {/* Photo Format Selector */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 mr-1 hidden sm:inline">Format Foto:</span>
                  {[
                    { id: 'portrait', label: 'Portrait' },
                    { id: 'landscape', label: 'Landscape' },
                    { id: 'square', label: '1:1' }
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setPreviewPhotoType(fmt.id)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        previewPhotoType === fmt.id
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>

                {/* Live Zoom Controls */}
                <div className="flex items-center gap-1 border-l border-slate-700/60 pl-2">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(MIN_ZOOM, z - 20))}
                    disabled={zoomLevel <= MIN_ZOOM}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut size={13} />
                  </button>
                  <span className="text-[10px] font-mono font-bold text-purple-300 w-9 text-center">
                    {zoomLevel}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(MAX_ZOOM, z + 20))}
                    disabled={zoomLevel >= MAX_ZOOM}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn size={13} />
                  </button>
                </div>
              </div>

              {/* Centered Canvas Container */}
              <div className="flex-1 w-full flex items-center justify-center p-2 overflow-auto">
                <div
                  className="relative p-2.5 bg-slate-900/90 rounded-2xl border-2 border-dashed border-slate-700/80 shadow-2xl transition-transform duration-150 ease-out"
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
                >
                  {/* Outer Sticker Badge */}
                  <div className="absolute -top-3 left-3 bg-purple-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                    <Maximize2 size={10} />
                    <span>{labelSize === 'continuous' ? 'Continuous Roll' : `${labelWidthMm}×${labelHeightMm} mm`}</span>
                  </div>

                  {/* Safe margin guides badge */}
                  {marginMm > 0 && (
                    <div className="absolute -top-3 right-3 bg-emerald-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                      <ShieldCheck size={10} />
                      <span>Batas Aman {marginMm} mm</span>
                    </div>
                  )}

                  {/* Physical Canvas Output */}
                  <canvas
                    ref={previewCanvasRef}
                    className="rounded-lg shadow-inner bg-white block max-w-[280px] sm:max-w-[340px] max-h-[220px] sm:max-h-[260px] object-contain border border-slate-600"
                  />
                </div>
              </div>

              {/* Preview Footer / Status */}
              <div className="w-full flex items-center justify-between text-[10px] text-slate-400 px-2 shrink-0">
                <span className="font-mono">
                  Dimensi Output: {canvasWidthPx}×{canvasHeightPx} px ({ditherMethod === 'atkinson' ? 'Atkinson Tone' : 'Floyd-Steinberg'})
                </span>
                <span className="text-purple-300 font-semibold">
                  {marginMm > 0 ? `Margin aman aktif (${marginMm} mm)` : 'Tanpa margin (0 mm)'}
                </span>
              </div>
            </div>

            {/* Right / Bottom: Configuration Settings Controls */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 bg-slate-900/50">

              {/* 1. Printer Connection Status */}
              <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/80 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${bluetoothPrinter.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    <span className="text-xs font-bold text-white">Printer Bluetooth</span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                    {bluetoothPrinter.isConnected ? (bluetoothPrinter.printerName || 'Niimbot B21S') : (config.bluetoothDeviceName || 'Belum Terhubung')}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={isBtConnecting}
                    className="flex-1 py-1.5 px-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    {isBtConnecting ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    <span>{isBtConnecting ? 'Menyambungkan...' : bluetoothPrinter.isConnected ? 'Sambungkan Ulang' : 'Pilih & Hubungkan Printer'}</span>
                  </button>

                  {bluetoothPrinter.isConnected && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCalibrateGap}
                        disabled={isCalibratingGap}
                        className="py-1.5 px-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                        title="Posisikan kertas tepat di batas pemisah stiker (gap)"
                      >
                        {isCalibratingGap ? <Loader2 size={12} className="animate-spin text-amber-400" /> : <Target size={12} className="text-amber-400" />}
                        <span>{isCalibratingGap ? 'Mengatur...' : 'Posisikan Gap'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTestPrint}
                        disabled={isTestingBtPrint}
                        className="py-1.5 px-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                        title="Kirim 1 lembar slip tes cetak ke printer"
                      >
                        {isTestingBtPrint ? <Loader2 size={12} className="animate-spin text-purple-600" /> : <Printer size={12} className="text-purple-600" />}
                        <span>{isTestingBtPrint ? 'Mencetak...' : 'Test Cetak'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {btStatus && (
                  <div className={`p-2.5 rounded-xl text-[11px] font-medium flex items-center gap-2 ${
                    btStatus.type === 'success'
                      ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                      : btStatus.type === 'info'
                      ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30'
                      : 'bg-rose-500/20 text-rose-200 border border-rose-500/30'
                  }`}>
                    <span>{btStatus.message}</span>
                  </div>
                )}

                {/* Pilihan Model / Tipe Printer */}
                <div className="pt-2 border-t border-slate-700/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                      <Printer size={12} className="text-purple-400" />
                      <span>Model & Tipe Printer:</span>
                    </span>
                    <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full font-mono">
                      {activeProfile.label} ({activeProfile.dpi} DPI)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {PRINTER_MODEL_OPTIONS.map((opt) => {
                      const isSel = activeModelPreset === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            onUpdateConfig({
                              printerModelPreset: opt.id,
                              ...(opt.defaultLabelWidthMm && !config.bluetoothLabelWidthMm ? { bluetoothLabelWidthMm: opt.defaultLabelWidthMm } : {}),
                              ...(opt.defaultLabelHeightMm !== undefined && !config.bluetoothLabelHeightMm ? { bluetoothLabelHeightMm: opt.defaultLabelHeightMm } : {})
                            });
                            bluetoothPrinter.setPrinterModel(opt.id);
                          }}
                          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                            isSel
                              ? 'border-purple-500 bg-purple-600 text-white font-extrabold shadow-sm ring-1 ring-purple-400/50'
                              : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          <div className="text-xs font-bold truncate flex items-center justify-between">
                            <span>{opt.label}</span>
                            {isSel && <Check size={11} className="text-white shrink-0 ml-1" />}
                          </div>
                          <div className="text-[9px] opacity-75 mt-0.5 truncate">{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. Ukuran Label Stiker & Margin Aman (Anti-Terpotong) */}
              <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/80 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <SlidersHorizontal size={13} className="text-purple-400" />
                    <span>Ukuran Label Stiker & Margin Aman</span>
                  </span>
                  <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                    {labelSize === 'continuous' ? 'Continuous Roll' : `${labelWidthMm}×${labelHeightMm} mm`}
                  </span>
                </div>

                {/* Label Preset Buttons */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Ukuran Kertas / Stiker Roll ({activeProfile.label}):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { id: '50x30', label: '50 × 30 mm ✨', w: 50, h: 30, desc: 'Standar B21' },
                      { id: '50x50', label: '50 × 50 mm', w: 50, h: 50, desc: 'Kotak' },
                      { id: '50x80', label: '50 × 80 mm', w: 50, h: 80, desc: 'Strip Panjang' },
                      { id: 'continuous', label: 'Struk Roll', w: 50, h: 0, desc: 'Continuous' }
                    ].map((lbl) => {
                      const isSel = labelSize === lbl.id;
                      return (
                        <button
                          key={lbl.id}
                          type="button"
                          onClick={() => onUpdateConfig({
                            bluetoothLabelSize: lbl.id,
                            bluetoothLabelWidthMm: lbl.w,
                            bluetoothLabelHeightMm: lbl.h
                          })}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                            isSel
                              ? 'border-purple-500 bg-purple-600 text-white font-extrabold shadow-sm ring-1 ring-purple-400/50'
                              : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          <div className="text-xs font-bold">{lbl.label}</div>
                          <div className="text-[9px] opacity-75 mt-0.5">{lbl.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Jenis Kertas & Sensor Gap */}
                <div className="pt-2 border-t border-slate-700/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                      <Layers size={12} className="text-purple-400" />
                      <span>Sensor & Jenis Kertas:</span>
                    </span>
                    <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full font-mono">
                      {labelType === 5 ? 'Stiker Transparan ✨' : labelType === 2 ? 'Black Mark' : labelType === 3 ? 'Continuous Roll' : 'Gap Standar (Putih)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { id: 1, label: 'Gap Putih', desc: 'Stiker Standar' },
                      { id: 5, label: 'Transparan ✨', desc: 'Stiker Bening' },
                      { id: 2, label: 'Black Mark', desc: 'Garis Hitam' },
                      { id: 3, label: 'Continuous', desc: 'Struk Roll' }
                    ].map((t) => {
                      const isSel = labelType === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onUpdateConfig({ bluetoothLabelType: t.id })}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                            isSel
                              ? 'border-purple-500 bg-purple-600 text-white font-extrabold shadow-sm ring-1 ring-purple-400/50'
                              : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          <div className="text-xs font-bold">{t.label}</div>
                          <div className="text-[9px] opacity-75 mt-0.5">{t.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                  {labelType === 5 && (
                    <div className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mt-2 flex items-start gap-1.5">
                      <Sparkles size={12} className="text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Mode Stiker Transparan Aktif:</strong> Mengaktifkan deteksi sensor stiker bening dan boost pemanas thermal agar hasil cetak pekat (tidak transparan/pudar) dan kertas berhenti tepat di celah potong (gap).
                      </span>
                    </div>
                  )}
                </div>

                {/* Safe Margin Selection */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="font-semibold text-slate-300">Margin Aman (Safe Margin):</span>
                    <span className="text-purple-300 font-bold font-mono">
                      {marginMm === 0 ? '0 mm (Tanpa Margin)' : `${marginMm} mm`}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { val: 0, label: '0 mm' },
                      { val: 1.0, label: '1.0 mm' },
                      { val: 1.5, label: '1.5 mm ✨' },
                      { val: 2.0, label: '2.0 mm' },
                      { val: 3.0, label: '3.0 mm' }
                    ].map((m) => {
                      const isSel = marginMm === m.val;
                      return (
                        <button
                          key={m.val}
                          type="button"
                          onClick={() => onUpdateConfig({ bluetoothMarginMm: m.val })}
                          className={`py-1.5 px-1 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                            isSel
                              ? 'border-purple-500 bg-purple-600 text-white shadow-2xs ring-1 ring-purple-400/50'
                              : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                    <span>Mencegah gambar terpotong lekukan sudut die-cut dan sensor celah printer.</span>
                  </div>
                </div>

                {/* Orientasi Cetak Stiker */}
                <div className="pt-2 border-t border-slate-700/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                      <Compass size={12} className="text-purple-400" />
                      <span>Orientasi Cetak Stiker:</span>
                    </span>
                    <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full font-mono">
                      {printOrientation === 'portrait' ? 'Portrait (Tegak)' : printOrientation === 'landscape' ? 'Landscape (Mendatar)' : 'Otomatis ✨'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'auto', label: 'Otomatis ✨', desc: 'Sesuai Rasio' },
                      { id: 'portrait', label: 'Portrait', desc: 'Tegak' },
                      { id: 'landscape', label: 'Landscape', desc: 'Mendatar' }
                    ].map((o) => {
                      const isSel = printOrientation === o.id;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => onUpdateConfig({ printOrientation: o.id })}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                            isSel
                              ? 'border-purple-500 bg-purple-600 text-white font-extrabold shadow-sm ring-1 ring-purple-400/50'
                              : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          <div className="text-xs font-bold">{o.label}</div>
                          <div className="text-[9px] opacity-75 mt-0.5">{o.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fit Mode & Auto-Rotate */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/60">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Penyesuaian Stiker:
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => onUpdateConfig({ bluetoothFitMode: 'fit' })}
                        className={`py-1.5 px-1 rounded-lg border text-[10px] font-bold text-center transition-all cursor-pointer ${
                          fitMode === 'fit'
                            ? 'border-purple-500 bg-purple-600 text-white'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                        title="Muat Utuh: 100% foto tampil utuh tanpa terpotong"
                      >
                        Muat Utuh ✨
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateConfig({ bluetoothFitMode: 'cover' })}
                        className={`py-1.5 px-1 rounded-lg border text-[10px] font-bold text-center transition-all cursor-pointer ${
                          fitMode === 'cover'
                            ? 'border-purple-500 bg-purple-600 text-white'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                        title="Penuh: Mengisi stiker sampai tepi batas aman"
                      >
                        Penuh (Crop)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Rotasi Otomatis (90°):
                    </label>
                    <button
                      type="button"
                      onClick={() => onUpdateConfig({ bluetoothAutoRotate: !autoRotate })}
                      className={`w-full py-1.5 px-2 rounded-lg border text-[10px] font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        autoRotate
                          ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                      title="Otomatis merotasi foto agar memaksimalkan bidang stiker"
                    >
                      <RotateCw size={12} className={autoRotate ? 'text-purple-400' : 'text-slate-500'} />
                      <span>{autoRotate ? 'Aktif (Maksimal ✨)' : 'Nonaktif'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Kualitas Cetak & Kecerahan Foto Thermal */}
              <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/80 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" />
                    <span>Kualitas Foto Thermal (Anti-Gelap)</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                    Atkinson Tone Mapping
                  </span>
                </div>

                {/* Kecerahan & Kontras Preset */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="font-semibold text-slate-300">Kecerahan Wajah & Kontras:</span>
                    <span className="text-amber-300 font-bold font-mono">
                      {brightnessPreset === 'asli'
                        ? 'Asli / Alami (0, G1.15) ✨ [Hasil Kiri]'
                        : brightnessPreset === 'seimbang'
                        ? 'Normal (+15, G1.5)'
                        : brightnessPreset === 'terang'
                        ? 'Cerah (+22, G1.75) [Hasil Kanan]'
                        : 'Maksimal (+35, G1.9)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { id: 'asli', label: 'Asli ✨ (Kiri)', b: 0, g: 1.15 },
                      { id: 'seimbang', label: 'Normal (+15)', b: 15, g: 1.5 },
                      { id: 'terang', label: 'Cerah / Kiosk ✨ (+22)', b: 22, g: 1.75 },
                      { id: 'ekstra_terang', label: 'Maksimal (+35)', b: 35, g: 1.9 }
                    ].map((p) => {
                      const isSel = brightnessPreset === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onUpdateConfig({
                            bluetoothBrightnessPreset: p.id,
                            bluetoothBrightness: p.b,
                            bluetoothGamma: p.g
                          })}
                          className={`py-1.5 px-1 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                            isSel
                              ? 'border-amber-500 bg-amber-600 text-white shadow-2xs ring-1 ring-amber-400/50'
                              : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tingkat Panas Head Printer (Density) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="font-semibold text-slate-300">Panas Head Printer (Density):</span>
                    <span className="text-amber-300 font-bold font-mono">
                      {density === 1 ? '1 - Halus (Foto)' : density === 2 ? '2 - Sedang ✨ (Rekomendasi)' : '3 - Pekat (Teks)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { val: 1, label: '1 - Halus (Foto)' },
                      { val: 2, label: '2 - Sedang ✨ (Rekomendasi)' },
                      { val: 3, label: '3 - Pekat (Teks)' }
                    ].map((d) => {
                      const isSel = density === d.val;
                      return (
                        <button
                          key={d.val}
                          type="button"
                          onClick={() => onUpdateConfig({ bluetoothDensity: d.val })}
                          className={`py-1.5 px-1.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                            isSel
                              ? 'border-amber-500 bg-amber-600 text-white shadow-2xs ring-1 ring-amber-400/50'
                              : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dithering & Penajaman Tepi */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/60">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Dithering:
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => onUpdateConfig({ bluetoothDither: 'atkinson' })}
                        className={`py-1.5 px-1 rounded-lg border text-[10px] font-bold text-center transition-all cursor-pointer ${
                          ditherMethod === 'atkinson'
                            ? 'border-amber-500 bg-amber-600 text-white'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                        title="Atkinson Halftone: Tajam dan bersih untuk foto wajah"
                      >
                        Atkinson ✨
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateConfig({ bluetoothDither: 'floyd_steinberg' })}
                        className={`py-1.5 px-1 rounded-lg border text-[10px] font-bold text-center transition-all cursor-pointer ${
                          ditherMethod === 'floyd_steinberg'
                            ? 'border-amber-500 bg-amber-600 text-white'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                        title="Floyd-Steinberg: Gradasi lembut"
                      >
                        Floyd-St.
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Penajaman Tepi:
                    </label>
                    <button
                      type="button"
                      onClick={() => onUpdateConfig({ bluetoothSharpen: !sharpen })}
                      className={`w-full py-1.5 px-2 rounded-lg border text-[10px] font-bold text-center transition-all cursor-pointer ${
                        sharpen
                          ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {sharpen ? 'Aktif (Mata & Garis Tajam)' : 'Nonaktif'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Actions in Sidebar */}
              <div className="pt-2 flex items-center justify-between gap-2 mt-auto">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Kembalikan semua nilai ke pengaturan awal optimal"
                >
                  <RotateCcw size={13} />
                  <span>Reset Default</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAndClose}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-colors cursor-pointer active:scale-98"
                >
                  <Check size={14} />
                  <span>Tutup & Terapkan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatePresence>
  );

  if (!isMounted || typeof document === 'undefined' || !document.body) {
    return modalMarkup;
  }

  return createPortal(modalMarkup, document.body);
}
