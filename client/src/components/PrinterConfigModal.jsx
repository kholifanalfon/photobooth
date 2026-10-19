import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  HelpCircle,
  FileText
} from 'lucide-react';
import { bluetoothPrinter, formatCanvasForThermalLabel, ditherCanvasThermal } from '../utils/bluetoothPrinter.js';

export default function PrinterConfigModal({
  isOpen,
  onClose,
  config,
  onUpdateConfig
}) {
  // Local state for printer pairing & actions
  const [isBtConnecting, setIsBtConnecting] = useState(false);
  const [isTestingBtPrint, setIsTestingBtPrint] = useState(false);
  const [btStatus, setBtStatus] = useState(null);

  // Preview & Zoom controls
  const [zoomLevel, setZoomLevel] = useState(100);
  const MIN_ZOOM = 60;
  const MAX_ZOOM = 250;
  const [previewPhotoType, setPreviewPhotoType] = useState('portrait'); // 'portrait' | 'landscape' | 'square'
  const [showDitherPreview, setShowDitherPreview] = useState(true);

  // Canvas refs
  const previewCanvasRef = useRef(null);

  // Current config values with fallbacks
  const labelSize = config.bluetoothLabelSize || '50x30';
  const labelWidthMm = Number(config.bluetoothLabelWidthMm ?? 50);
  const labelHeightMm = labelSize === 'continuous' ? 0 : Number(config.bluetoothLabelHeightMm ?? 30);
  const marginMm = Number(config.bluetoothMarginMm ?? 1.5);
  const fitMode = config.bluetoothFitMode || 'fit';
  const autoRotate = config.bluetoothAutoRotate !== false;
  const density = Number(config.bluetoothDensity ?? 2);
  const brightnessPreset = config.bluetoothBrightnessPreset || 'terang';
  const brightness = Number(config.bluetoothBrightness ?? 22);
  const contrast = Number(config.bluetoothContrast ?? 1.15);
  const gamma = Number(config.bluetoothGamma ?? 1.75);
  const ditherMethod = config.bluetoothDither || 'atkinson';
  const sharpen = config.bluetoothSharpen !== false;

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

    // Format canvas to exact thermal label dimensions & margins
    const formatted = formatCanvasForThermalLabel(mockCanvas, {
      labelWidthMm,
      labelHeightMm,
      marginMm,
      fitMode,
      autoRotate,
      maxPrintheadPixels: 384
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
    density,
    brightness,
    contrast,
    gamma,
    ditherMethod,
    sharpen
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

      const testCanvas = document.createElement('canvas');
      testCanvas.width = bluetoothPrinter.printheadPixels || 384;
      testCanvas.height = 240;
      const tCtx = testCanvas.getContext('2d');
      tCtx.fillStyle = '#ffffff';
      tCtx.fillRect(0, 0, testCanvas.width, testCanvas.height);
      tCtx.fillStyle = '#000000';
      tCtx.font = 'bold 22px sans-serif';
      tCtx.textAlign = 'center';
      tCtx.fillText('PHOTOBOOTH TEST', testCanvas.width / 2, 55);
      tCtx.font = '15px sans-serif';
      tCtx.fillText(`Printer: ${bluetoothPrinter.printerName || 'Niimbot'}`, testCanvas.width / 2, 95);
      tCtx.fillText(`Mode: ${bluetoothPrinter.isNiimbot ? 'Niimbot Protocol' : 'ESC/POS'}`, testCanvas.width / 2, 130);
      tCtx.font = '13px monospace';
      tCtx.fillText(new Date().toLocaleTimeString(), testCanvas.width / 2, 170);
      tCtx.lineWidth = 2;
      tCtx.strokeRect(8, 8, testCanvas.width - 16, testCanvas.height - 16);

      await bluetoothPrinter.printImage(testCanvas, {
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
        onProgress: (msg) => setBtStatus({ type: 'info', message: msg })
      });
      setBtStatus({ type: 'success', message: 'Test cetak berhasil dikirim ke printer!' });
    } catch (err) {
      setBtStatus({ type: 'error', message: `Gagal test print: ${err.message}` });
    } finally {
      setIsTestingBtPrint(false);
    }
  };

  if (!isOpen) return null;

  // Calculate pixel bounds & display dimensions
  const dotsPerMm = 8;
  const canvasWidthPx = Math.min(384, Math.round(labelWidthMm * dotsPerMm));
  const canvasHeightPx = labelHeightMm > 0 ? Math.round(labelHeightMm * dotsPerMm) : Math.round(canvasWidthPx * 1.5);
  const marginPx = Math.round(marginMm * dotsPerMm);

  // Scaled dimensions for on-screen preview viewport
  const displayW = Math.round((canvasWidthPx * zoomLevel) / 100);
  const displayH = Math.round((canvasHeightPx * zoomLevel) / 100);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex flex-col select-none overflow-hidden animate-fade-in overscroll-none"
        style={{ overscrollBehavior: 'none', marginTop: 0 }}
      >
        {/* Top Header Bar */}
        <div className="h-14 sm:h-16 bg-slate-900 border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between shrink-0 text-white gap-3 z-50">
          <div className="flex items-center gap-2.5 min-w-0 shrink">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 shadow-xs">
              <Printer size={17} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                <h2 className="text-xs sm:text-sm md:text-base font-extrabold text-white truncate">
                  Konfigurasi Printer & Label Stiker
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0 whitespace-nowrap">
                  {labelSize === 'continuous' ? 'Continuous Roll' : `${labelWidthMm} × ${labelHeightMm} mm`} (203 DPI)
                </span>
                {config.bluetoothDeviceName && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 hidden sm:inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{config.bluetoothDeviceName}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(MIN_ZOOM, z - 25))}
                disabled={zoomLevel <= MIN_ZOOM}
                className="p-1.5 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-300 cursor-pointer transition-colors"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <span className="text-xs font-bold text-slate-200 px-2 min-w-[48px] text-center select-none font-mono">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(MAX_ZOOM, z + 25))}
                disabled={zoomLevel >= MAX_ZOOM}
                className="p-1.5 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-300 cursor-pointer transition-colors"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
            </div>

            {/* Dither Mode Simulation Toggle */}
            <button
              type="button"
              onClick={() => setShowDitherPreview(!showDitherPreview)}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                showDitherPreview
                  ? 'bg-purple-600 border-purple-500 text-white shadow-xs'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Simulasi Hasil Cetak Thermal (Halftone Dots)"
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline">{showDitherPreview ? 'Simulasi Cetak: Aktif' : 'Simulasi: Asli'}</span>
            </button>

            {/* Save & Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-98"
              title="Simpan dan tutup"
            >
              <Check size={15} />
              <span>Selesai & Simpan</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
              title="Tutup Modal"
              aria-label="Tutup Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main Content Area (Split Pane: Interactive Preview on Left, Settings Panel on Right) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden custom-scrollbar">
          {/* Left / Center: Interactive Live Print Preview Canvas */}
          <div className="flex-1 min-h-[440px] lg:min-h-0 bg-slate-950 p-6 sm:p-10 overflow-auto custom-scrollbar flex flex-col items-center justify-center relative select-none">
            {/* Aspect / Orientation Simulator Tabs */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-md">
              <span className="text-[10px] font-bold text-slate-400 px-2">Format Foto:</span>
              {[
                { id: 'portrait', label: 'Portrait (2:3)' },
                { id: 'landscape', label: 'Landscape (3:2)' },
                { id: 'square', label: 'Kotak (1:1)' }
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setPreviewPhotoType(fmt.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    previewPhotoType === fmt.id
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>

            {/* Sticker Paper Card Container */}
            <div className="relative flex flex-col items-center">
              <div
                style={{
                  width: `${displayW}px`,
                  minWidth: `${displayW}px`,
                  height: `${displayH}px`,
                  minHeight: `${displayH}px`
                }}
                className="relative bg-white rounded-2xl shadow-2xl border-4 border-slate-400/80 overflow-hidden flex items-center justify-center transition-all duration-150"
              >
                {/* Visible Canvas */}
                <canvas
                  ref={previewCanvasRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    imageRendering: 'pixelated'
                  }}
                  className="block w-full h-full"
                />

                {/* Safe Margin Guide Overlay (Dashed Red Border) */}
                {marginMm > 0 && (
                  <div
                    style={{
                      inset: `${Math.round((marginPx / canvasWidthPx) * displayW)}px`
                    }}
                    className="absolute pointer-events-none border-2 border-dashed border-rose-500/70 rounded-lg flex items-start justify-end p-1"
                  >
                    <span className="text-[9px] font-bold font-mono bg-rose-600 text-white px-1 rounded shadow-xs opacity-80">
                      Batas Aman {marginMm} mm
                    </span>
                  </div>
                )}
              </div>

              {/* Dimension details footer */}
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-400 font-mono bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Kertas: {labelWidthMm}×{labelHeightMm || 'auto'} mm ({canvasWidthPx}×{canvasHeightPx} px)</span>
                </span>
                <span>•</span>
                <span>Margin: {marginMm} mm ({marginPx} px)</span>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Comprehensive Printer Settings */}
          <div className="w-full lg:w-[460px] xl:w-[500px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800/80 p-4 sm:p-5 overflow-y-auto custom-scrollbar shrink-0 flex flex-col gap-4 text-white">
            {/* 1. Pairing & Test Print Card */}
            <div className="p-3.5 bg-slate-800/50 rounded-2xl border border-purple-500/30 flex flex-col gap-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles size={13} className="text-purple-400" />
                    <span>Pairing Bluetooth Niimbot / Thermal</span>
                  </div>
                  <div className="text-[10px] text-purple-200/80 mt-0.5">
                    {config.bluetoothDeviceName ? `Terhubung ke: ${config.bluetoothDeviceName}` : 'Pastikan Bluetooth perangkat & printer menyala'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isBtConnecting || isTestingBtPrint}
                    onClick={handleConnect}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    {isBtConnecting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    <span>{isBtConnecting ? 'Mencari...' : (config.bluetoothDeviceName ? 'Hubungkan Ulang' : 'Hubungkan')}</span>
                  </button>
                  {config.bluetoothDeviceName && (
                    <button
                      type="button"
                      disabled={isBtConnecting || isTestingBtPrint}
                      onClick={handleTestPrint}
                      className="px-2.5 py-1.5 bg-white hover:bg-purple-50 text-purple-700 border border-purple-300 rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      title="Kirim slip tes cetak ke printer Bluetooth"
                    >
                      {isTestingBtPrint ? <Loader2 size={12} className="animate-spin text-purple-600" /> : <Printer size={12} className="text-purple-600" />}
                      <span>{isTestingBtPrint ? 'Mencetak...' : 'Test Cetak'}</span>
                    </button>
                  )}
                </div>
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
            </div>

            {/* 2. Ukuran Label Stiker & Margin Aman (Anti-Terpotong) */}
            <div className="p-3.5 bg-slate-800/40 rounded-2xl border border-slate-700/80 flex flex-col gap-3">
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
                  Ukuran Kertas / Stiker Roll (Niimbot B21/B21S):
                </label>
                <div className="grid grid-cols-4 gap-1.5">
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
            <div className="p-3.5 bg-slate-800/40 rounded-2xl border border-slate-700/80 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-400" />
                  <span>Kualitas Foto Thermal (Anti-Gelap)</span>
                </span>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Atkinson Tone Mapping
                </span>
              </div>

              {/* Kecerahan & Kontras Preset */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="font-semibold text-slate-300">Kecerahan Wajah & Kontras:</span>
                  <span className="text-amber-300 font-bold font-mono">
                    {brightnessPreset === 'ekstra_terang'
                      ? 'Sangat Cerah (+35)'
                      : brightnessPreset === 'terang'
                      ? 'Cerah / Kiosk ✨ (+22)'
                      : brightnessPreset === 'seimbang'
                      ? 'Normal (+12)'
                      : 'Asli (0)'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'ekstra_terang', label: 'Maksimal', b: 35, g: 1.9 },
                    { id: 'terang', label: 'Cerah ✨', b: 22, g: 1.75 },
                    { id: 'seimbang', label: 'Normal', b: 12, g: 1.5 },
                    { id: 'asli', label: 'Asli', b: 0, g: 1.1 }
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
                    {density === 1 ? '1 - Halus (Bebas Luntur)' : density === 2 ? '2 - Sedang ✨ (Rekomendasi)' : '3 - Pekat (Lebih Gelap)'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { val: 1, label: '1 - Halus (Foto)' },
                    { val: 2, label: '2 - Sedang ✨' },
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
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
}
