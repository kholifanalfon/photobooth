import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Maximize2,
  RotateCcw,
  Video,
  Type,
  Palette,
  Check,
  Upload,
  Trash2,
  Sparkles,
  Loader2,
  HardDrive,
  Database,
  Printer,
  SlidersHorizontal,
  Lock,
  FileText,
  Copy,
  Zap,
  CheckCircle2,
  AlertCircle,
  Play,
  KeyRound,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Download,
  Layers,
  Image as ImageIcon,
  Plus,
  FolderArchive,
  Move,
  Eye,
  EyeOff
} from 'lucide-react';
import { preloadAndCacheVideo, seedLocalVideoCache, clearVideoCache } from '../utils/videoCache.js';
import { sliceAndStoreInIndexedDB, uploadChunksWithProgress, uploadDirectMedia } from '../utils/chunkUploader.js';
import { resolveApiUrl } from '../utils/apiConfig.js';
import { bluetoothPrinter, PRINTER_MODEL_OPTIONS, getPrinterProfile } from '../utils/bluetoothPrinter.js';

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const THEME_PRESETS = {
  general: {
    id: 'general',
    name: 'Umum & Ceria',
    description: 'Tema ceria, universal dan menyenangkan dengan nuansa rose & amber.',
    defaultTitle: 'Capture The Magic! ✨',
    defaultSubtitle: 'Sentuh tombol untuk membuka kotak hadiah dan memulai sesi fotomu.',
    bgClass: 'bg-slate-50',
    headingClass: 'text-slate-800',
    subheadingClass: 'text-slate-600',
    btnClass: 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200'
  },
  wedding: {
    id: 'wedding',
    name: 'Pernikahan Romantis',
    description: 'Nuansa romantis, elegan dan mewah untuk pesta pernikahan dan tunangan.',
    defaultTitle: 'The Wedding Celebration 💍',
    defaultSubtitle: 'Abadikan momen bahagia dan penuh cinta di hari istimewa ini.',
    bgClass: 'bg-slate-50',
    headingClass: 'text-rose-950 font-serif',
    subheadingClass: 'text-rose-800/80 font-serif',
    btnClass: 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-rose-300'
  }
};

export const PRINTER_PRESETS = [
  { id: 'Niimbot 4R Photo Printer', name: 'Niimbot 4R Photo Printer', desc: 'Printer foto portabel Niimbot 4R (USB/Bluetooth Kiosk)' }
];

export { SAMPLE_PLACEHOLDER_PHOTOS, SLOT_PRESETS, PAPER_PRESETS } from '../constants/framePresets.js';
import { SAMPLE_PLACEHOLDER_PHOTOS, SLOT_PRESETS, PAPER_PRESETS } from '../constants/framePresets.js';

export default function LandingConfigDrawer({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onGoLive,
  onOpenSessions,
  onOpenFrameManager,
  onOpenPrinterConfig,
  initialTab = 'media_theme'
}) {
  // Hanya 2 Tab: 'media_theme' (Media & Tema) dan 'printer' (Konfigurasi Printer)
  const [activeTab, setActiveTab] = useState(initialTab); // 'media_theme' | 'printer'

  // Video Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [chunkDetail, setChunkDetail] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState(null);

  // Printer Test States
  const [isTestingPrint, setIsTestingPrint] = useState(false);
  const [isBtConnecting, setIsBtConnecting] = useState(false);
  const [isTestingBtPrint, setIsTestingBtPrint] = useState(false);
  const [btStatus, setBtStatus] = useState(null);
  const [testPrintStatus, setTestPrintStatus] = useState(null);

  // Server Media States
  const [serverMediaFiles, setServerMediaFiles] = useState([]);
  const [isLoadingServerMedia, setIsLoadingServerMedia] = useState(false);
  const [isDeletingMedia, setIsDeletingMedia] = useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  // Custom Frame & Slot Mapping States
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [isPrecisionModalOpen, setIsPrecisionModalOpen] = useState(false);
  const [isUploadingFrame, setIsUploadingFrame] = useState(false);
  const [frameUploadError, setFrameUploadError] = useState(null);
  const [previewFrameOpacity, setPreviewFrameOpacity] = useState(70);
  const [showPhotoPlaceholders, setShowPhotoPlaceholders] = useState(true);
  const [placeholderLayerMode, setPlaceholderLayerMode] = useState("under");
  const frameInputRef = useRef(null);

  const getApiBase = () => {
    if (typeof window !== "undefined") {
      const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (isLocalHost && window.location.port && !["5000", "5025"].includes(window.location.port)) {
        return import.meta.env?.VITE_API_BASE_URL || "";
      }
    }
    return "";
  };

  const fetchServerMedia = async () => {
    setIsLoadingServerMedia(true);
    try {
      const endpoint = resolveApiUrl("/api/config/media", getApiBase());
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.files)) {
          const normalized = data.files.map((item) => {
            if (typeof item === 'string') {
              const isVideo = /\.(mp4|webm|mov|ogg)$/i.test(item);
              return {
                filename: item,
                size: 0,
                isVideo,
                url: `/uploads/${item}`
              };
            }
            return {
              ...item,
              url: item.url || `/uploads/${item.filename}`
            };
          });
          setServerMediaFiles(normalized);
        }
      }
    } catch (err) {
      console.warn("Gagal membaca daftar media server:", err);
    } finally {
      setIsLoadingServerMedia(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      fetchServerMedia();
    }
  }, [isOpen]);

  const handleLoadServerMedia = (fileItem) => {
    const targetUrl = fileItem.url || `/uploads/${fileItem.filename}`;
    onUpdateConfig({ videoUrl: targetUrl, enableVideo: true });
    setUploadStatus(`✓ Menggunakan media server: ${fileItem.filename}`);
    setUploadError(null);
  };

  const handleDeleteServerMedia = async (fileItem) => {
    setIsDeletingMedia(true);
    try {
      const endpoint = resolveApiUrl("/api/config/media", getApiBase());
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: fileItem.filename })
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      // If active video in config is the one deleted, clear it
      if (config.videoUrl && config.videoUrl.includes(fileItem.filename)) {
        onUpdateConfig({ videoUrl: "", enableVideo: false });
      }

      // Clear matching video from browser CacheStorage & memory store
      await clearVideoCache(fileItem.filename);
      await clearVideoCache(fileItem.url);

      setDeleteConfirmTarget(null);
      setUploadStatus(`✓ File "${fileItem.filename}" berhasil dihapus permanen dari server & cache store`);
      await fetchServerMedia();
    } catch (err) {
      setUploadError(`Gagal menghapus file dari server: ${err.message}`);
    } finally {
      setIsDeletingMedia(false);
    }
  };

  const handleTitleChange = (e) => {
    const val = (e.target.value || "").slice(0, 32);
    onUpdateConfig({ title: val });
  };

  const handleSubtitleChange = (e) => {
    onUpdateConfig({ subtitle: e.target.value });
  };

  const handleToggleVideo = () => {
    onUpdateConfig({ enableVideo: !config.enableVideo });
  };

  const handleRemoveVideo = async () => {
    const currentVideo = config.videoUrl;
    if (currentVideo) {
      clearVideoCache(currentVideo);
      const filename = currentVideo.split('?')[0].split('/').pop();
      if (filename && (currentVideo.includes('/uploads/') || filename.startsWith('video_') || filename.startsWith('media_'))) {
        try {
          const endpoint = resolveApiUrl('/api/config/media', getApiBase());
          await fetch(endpoint, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
          });
        } catch (_) {}
      }
    }
    onUpdateConfig({ videoUrl: '', enableVideo: false });
    setUploadStatus('');
    setUploadError(null);
    await fetchServerMedia();
  };

  const handleGenerateRandomCode = () => {
    const prefixes = ["VIP", "SESI", "WED", "BOOTH", "FOTO"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(10 + Math.random() * 90);
    const randomCode = `${prefix}${num}`;
    onUpdateConfig({ sessionCode: randomCode, requireSessionCode: true });
  };

  const handleVideoFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadPercent(0);
    setChunkDetail('Memulai...');

    // Fast local preview while uploading in background
    const tempBlobUrl = URL.createObjectURL(file);

    try {
      let apiBase = '';
      if (typeof window !== 'undefined') {
        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalHost && window.location.port && !['5000', '5025'].includes(window.location.port)) {
          apiBase = import.meta.env?.VITE_API_BASE_URL || '';
        }
      }

      let serverVideoUrl = '';

      // Fast-track: Single-request direct upload for files <= 4MB (photos / small media)
      if (file.size <= 4 * 1024 * 1024) {
        setUploadStatus('Mengunggah media langsung...');
        setChunkDetail(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
        const directData = await uploadDirectMedia(file, {
          apiBase,
          category: "media",
          onProgress: (percent) => {
            setUploadPercent(percent);
            setUploadStatus(`Mengunggah ke server (${percent}%)...`);
          }
        });
        serverVideoUrl = directData.videoUrl || directData.relativeUrl;
      } else {
        // Multi-stream chunked upload for larger videos
        setUploadStatus('Mempersiapkan chunking paralel...');
        const { uploadId, totalChunks } = await sliceAndStoreInIndexedDB(file);
        setChunkDetail(`0 / ${totalChunks} chunk`);

        setUploadStatus('Mengunggah chunk media...');
        const mergeData = await uploadChunksWithProgress(uploadId, file, totalChunks, {
          apiBase,
          category: "media",
          concurrency: 2,
          onProgress: (percent, currentChunk, total) => {
            setUploadPercent(percent);
            setChunkDetail(`Chunk ${currentChunk} dari ${total} (${percent}%)`);
            if (percent >= 98) {
              setUploadStatus('Menggabungkan chunk di server...');
            } else {
              setUploadStatus(`Mengunggah paralel (${percent}%)...`);
            }
          }
        });
        serverVideoUrl = mergeData.videoUrl || mergeData.relativeUrl;
      }

      // Step 3: Instant local cache seeding (0ms latency, zero re-download from server)
      setUploadStatus('Mengamankan ke cache lokal...');
      await seedLocalVideoCache(serverVideoUrl, file);

      // Persist server video URL in landing config
      onUpdateConfig({ videoUrl: serverVideoUrl, enableVideo: true });
      setUploadPercent(100);
      setChunkDetail('Selesai 100%');
      setUploadStatus('✓ Media berhasil diunggah & tersimpan instan!');
      await fetchServerMedia();
    } catch (err) {
      console.error('Failed media upload:', err);
      setUploadError(err.message || 'Gagal mengunggah media ke server');
    } finally {
      setIsUploading(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleSelectTheme = (themeId) => {
    const theme = THEME_PRESETS[themeId];
    if (theme) {
      onUpdateConfig({
        theme: themeId,
        title: config.isTitleCustom ? config.title : theme.defaultTitle,
        subtitle: config.isSubtitleCustom ? config.subtitle : theme.defaultSubtitle
      });
    }
  };

  const handleConnectBluetooth = async () => {
    setIsBtConnecting(true);
    setBtStatus(null);
    try {
      const res = await bluetoothPrinter.connect();
      setBtStatus({ type: 'success', message: `Terhubung: ${res.name} (${res.type === 'niimbot' ? 'Niimbot' : 'ESC/POS'})` });
      onUpdateConfig({ printMethod: 'bluetooth', bluetoothDeviceName: res.name });
    } catch (err) {
      setBtStatus({ type: 'error', message: err.message || 'Gagal menghubungkan Bluetooth' });
    } finally {
      setIsBtConnecting(false);
    }
  };

  const handleTestBluetoothPrint = async () => {
    setIsTestingBtPrint(true);
    setBtStatus(null);
    try {
      if (!bluetoothPrinter.isConnected) {
        setBtStatus({ type: 'info', message: 'Menyambungkan printer Bluetooth...' });
        await bluetoothPrinter.connect();
      }
      const printOrientation = config.printOrientation || 'auto';
      const labelHeightMm = config.bluetoothLabelSize === 'continuous' ? 0 : Number(config.bluetoothLabelHeightMm ?? 30);
      const labelWidthMm = Number(config.bluetoothLabelWidthMm ?? 50);

      const testCanvas = document.createElement('canvas');
      const isPortrait = printOrientation === 'portrait' || (printOrientation === 'auto' && labelHeightMm > labelWidthMm);

      if (isPortrait) {
        testCanvas.width = 240;
        testCanvas.height = 360;
      } else {
        testCanvas.width = bluetoothPrinter.printheadPixels || 384;
        testCanvas.height = 220;
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
        printerModelPreset: config.printerModelPreset || 'b1_pro',
        density: Number(config.bluetoothDensity ?? 2),
        ditherMethod: config.bluetoothDither || 'atkinson',
        brightness: Number(config.bluetoothBrightness ?? 22),
        contrast: Number(config.bluetoothContrast ?? 1.15),
        gamma: Number(config.bluetoothGamma ?? 1.75),
        sharpen: config.bluetoothSharpen !== false,
        labelWidthMm,
        labelHeightMm,
        marginMm: Number(config.bluetoothMarginMm ?? 1.5),
        fitMode: config.bluetoothFitMode || 'fit',
        autoRotate: config.bluetoothAutoRotate !== false,
        orientation: printOrientation,
        onProgress: (statusMsg) => setBtStatus({ type: 'info', message: statusMsg })
      });
      setBtStatus({ type: 'success', message: 'Test cetak berhasil dikirim ke printer!' });
    } catch (err) {
      setBtStatus({ type: 'error', message: `Gagal test print: ${err.message}` });
    } finally {
      setIsTestingBtPrint(false);
    }
  };

  const handleTestPrint = async () => {
    setIsTestingPrint(true);
    setTestPrintStatus(null);
    try {
      const endpoint = resolveApiUrl('/api/print');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copies: 1,
          printerName: config.printerName || 'Default System Printer',
          sessionId: 'test_kiosk_print'
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      setTestPrintStatus({
        type: 'success',
        message: '✓ Uji cetak berhasil terkirim ke antrean printer!'
      });
    } catch (err) {
      setTestPrintStatus({
        type: 'error',
        message: `Gagal mengirim uji cetak: ${err.message}`
      });
    } finally {
      setIsTestingPrint(false);
    }
  };

  const handleResetToDefault = () => {
    const currentTheme = THEME_PRESETS[config.theme] || THEME_PRESETS.general;
    onUpdateConfig({
      title: currentTheme.defaultTitle,
      subtitle: currentTheme.defaultSubtitle,
      eventDate: 'Saturday, 17 October 2026',
      coupleNames: 'The Wedding Celebration',
      videoUrl: '',
      enableVideo: false,
      videoRatio: 'auto',
      videoDisplayMode: 'both',
      isTitleCustom: false,
      isSubtitleCustom: false,
      requireSessionCode: false,
      sessionCode: '1234',
      printerName: 'Default System Printer',
      paperSize: '4R',
      printCopies: 1,
      printMethod: 'kiosk',
      autoPrint: false
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-2xs transition-opacity"
          />

          <div className="fixed inset-y-0 left-0 max-w-full flex">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-screen max-w-sm sm:max-w-md bg-white shadow-2xl flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-800">
                    Pengaturan Photobooth
                  </h2>
                  <p className="text-xs text-slate-500">
                    Konfigurasi tampilan acara, kode sesi & printer
                  </p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Tutup Pengaturan"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Quick Go Live Action Banner */}
              <div className="px-4 py-2.5 bg-gradient-to-r from-rose-500/10 via-pink-500/10 to-amber-500/10 border-b border-rose-100 flex items-center justify-between">
                {config.isLive ? (
                  <>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Mode Live Kiosk Aktif</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateConfig({ isLive: false })}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs shadow-2xs transition-all cursor-pointer"
                      title="Matikan Mode Live dan kembali ke mode normal"
                    >
                      <Lock size={11} className="text-rose-500" />
                      <span>Matikan Live</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-xs text-rose-950 font-medium">
                      <Play size={13} className="text-rose-500 fill-rose-500" />
                      <span>Siap mulai sesi photobooth?</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {onOpenSessions && (
                        <button
                          type="button"
                          onClick={onOpenSessions}
                          title="Buka Kelola Sesi Foto (Preview, Print, Download, QR, Hapus)"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white border border-rose-200 text-rose-700 hover:text-rose-800 font-bold text-xs shadow-2xs transition-all cursor-pointer"
                        >
                          <FolderArchive size={12} className="text-rose-500" />
                          <span>Kelola Sesi</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onGoLive}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                      >
                        <span>Go Live</span>
                        <Play size={11} className="fill-white" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Navigation: 2 Tabs Saja (Media & Tema vs Printer) */}
              <div className="flex border-b border-slate-200 bg-slate-50/50 px-3 pt-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('media_theme')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                    activeTab === 'media_theme'
                      ? 'border-rose-500 text-rose-600 bg-white shadow-2xs'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Sparkles size={14} className={activeTab === 'media_theme' ? 'text-rose-500' : 'text-slate-400'} />
                  <span>Media & Tema</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('printer')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                    activeTab === 'printer'
                      ? 'border-rose-500 text-rose-600 bg-white shadow-2xs'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Printer size={14} className={activeTab === 'printer' ? 'text-rose-500' : 'text-slate-400'} />
                  <span>Konfigurasi Printer</span>
                </button>
              </div>

              {/* Drawer Body Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
                {/* TAB 1: MEDIA & TEMA */}
                {activeTab === 'media_theme' && (
                  <div className="space-y-5">
                    {/* Seksi A: Pilihan Tema Visual (1 LINE SAJA) */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Palette size={13} className="text-rose-500" />
                        <span>Pilihan Tema Tampilan</span>
                      </div>
                      {/* Tepat 1 Baris (1 Line) */}
                      <div className="grid grid-cols-2 gap-2">
                        {Object.values(THEME_PRESETS).map((preset) => {
                          const isSelected = (config.theme || 'general') === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleSelectTheme(preset.id)}
                              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-2xs font-bold'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                              }`}
                            >
                              <span className="truncate">{preset.name}</span>
                              {isSelected && <Check size={14} className="text-rose-500 shrink-0 ml-1" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Seksi B: Teks Pengantar & Informasi Acara */}
                    <div className="space-y-3 pt-1 border-t border-slate-100">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Type size={13} className="text-rose-500" />
                        <span>Teks Pengantar & Informasi Acara</span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                            <span>Judul Utama (Headline)</span>
                            <span className="text-[10px] font-medium text-rose-500 bg-rose-50 border border-rose-200/60 px-1.5 py-0.2 rounded-md">
                              Maks 1 Baris
                            </span>
                          </label>
                          <span className="text-[10px] font-mono text-slate-400">
                            {(config.title || "").length}/32
                          </span>
                        </div>
                        <input
                          type="text"
                          maxLength={32}
                          value={config.title || ""}
                          onChange={(e) => {
                            onUpdateConfig({ isTitleCustom: true });
                            handleTitleChange(e);
                          }}
                          placeholder="Contoh: The Wedding Celebration 💍"
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-medium"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Sub-Judul (Teks Pengantar Tamu)
                        </label>
                        <textarea
                          rows={2}
                          value={config.subtitle}
                          onChange={(e) => {
                            onUpdateConfig({ isSubtitleCustom: true });
                            handleSubtitleChange(e);
                          }}
                          placeholder="Contoh: Abadikan momen bahagia dan penuh cinta..."
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-none"
                        />
                      </div>

                      {/* Frame Accent Details */}
                      <div className="p-3 bg-rose-50/50 border border-rose-200/70 rounded-xl space-y-2.5">
                        <div className="text-[11px] font-bold text-rose-950 flex items-center gap-1.5">
                          <Sparkles size={12} className="text-rose-500" />
                          <span>Teks Aksen Bingkai Video</span>
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-slate-600 block mb-0.5">
                            Tanggal Acara (Frame Atas):
                          </label>
                          <input
                            type="text"
                            value={config.eventDate ?? 'Saturday, 17 October 2026'}
                            onChange={(e) => onUpdateConfig({ eventDate: e.target.value })}
                            placeholder="Contoh: 17 . 10 . 2026"
                            className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-rose-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-slate-600 block mb-0.5">
                            Nama Pasangan / Acara (Frame Bawah):
                          </label>
                          <input
                            type="text"
                            value={config.coupleNames ?? 'The Wedding Celebration'}
                            onChange={(e) => onUpdateConfig({ coupleNames: e.target.value })}
                            placeholder="Contoh: Yusron & Diva"
                            className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Seksi C: Konfigurasi Media Video Pengantar */}
                    <div className="space-y-3 pt-1 border-t border-slate-100">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Video size={13} className="text-rose-500" />
                        <span>Konfigurasi Media Video</span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div>
                          <div className="text-xs font-bold text-slate-800">Tampilkan Video Pengantar</div>
                          <div className="text-[10px] text-slate-500">Gantikan kotak hadiah dengan video berbingkai</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(config.enableVideo)}
                            onChange={handleToggleVideo}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                        </label>
                      </div>

                      {/* Orientasi Video / Aspect Ratio Selector (1 Line) */}
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Aspek Rasio Bingkai Video:
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { id: 'auto', label: 'Otomatis' },
                            { id: 'portrait-photo', label: '3:4' },
                            { id: 'portrait', label: '9:16' },
                            { id: 'landscape', label: '16:9' }
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onUpdateConfig({ videoRatio: item.id })}
                              className={`p-1.5 rounded-lg text-center border text-[11px] transition-all cursor-pointer ${
                                (config.videoRatio || 'auto') === item.id
                                  ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Skala Ukuran Tampilan Video (Responsif iPad & Monitor) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                            <Maximize2 size={11} className="text-rose-500" />
                            <span>Skala Ukuran Video:</span>
                          </label>
                          <span className="text-[10px] text-rose-600 font-semibold bg-rose-50 px-1.5 py-0.5 rounded">
                            {(config.videoScale || 'auto') === 'auto' ? 'Adaptif iPad & HP' : (config.videoScale || 'auto')}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { id: 'auto', label: 'Otomatis' },
                            { id: 'compact', label: 'Kompak' },
                            { id: 'standard', label: 'Sedang' },
                            { id: 'large', label: 'Besar (iPad)' }
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onUpdateConfig({ videoScale: item.id })}
                              className={`p-1.5 rounded-lg text-center border text-[11px] transition-all cursor-pointer ${
                                (config.videoScale || 'auto') === item.id
                                  ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Mode Tampilan Video: Frame / Background / Keduanya */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                            <Layers size={11} className="text-rose-500" />
                            <span>Mode Tampilan Video:</span>
                          </label>
                          <span className="text-[10px] text-rose-600 font-semibold bg-rose-50 px-1.5 py-0.5 rounded">
                            {(config.videoDisplayMode || "both") === "both"
                              ? "Keduanya (Sinkron)"
                              : (config.videoDisplayMode === "background" ? "Background Layar" : "Bingkai Saja")}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { id: "both", label: "Keduanya (Sinkron)" },
                            { id: "frame", label: "Bingkai Saja" },
                            { id: "background", label: "Background Saja" }
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onUpdateConfig({ videoDisplayMode: item.id })}
                              className={`p-1.5 rounded-lg text-center border text-[11px] transition-all cursor-pointer ${
                                (config.videoDisplayMode || "both") === item.id
                                  ? "border-rose-500 bg-rose-50 text-rose-700 font-bold shadow-2xs"
                                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Server Upload Section with IndexedDB Chunking */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <HardDrive size={13} className="text-rose-500" />
                            <span>Unggah Video / Gambar</span>
                          </div>
                          <span className="text-[9px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Database size={9} /> Chunking 512KB
                          </span>
                        </div>

                        {/* Status Video Aktif Tersimpan */}
                        {config.videoUrl && !isUploading && (
                          <div className="p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                <Check size={12} />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-emerald-950">Video Aktif Tersimpan</div>
                                <div className="text-[10px] text-emerald-700">Tersimpan di server & cache browser</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleRemoveVideo}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Video"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}

                        {/* File Media di Server (Load & Delete) */}
                        <div className="pt-2 border-t border-slate-200/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                              <HardDrive size={12} className="text-slate-500" />
                              <span>Media di Server</span>
                              {serverMediaFiles.length > 0 && (
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
                                  {serverMediaFiles.length}
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={fetchServerMedia}
                              disabled={isLoadingServerMedia}
                              className="text-[10px] text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors"
                              title="Segarkan daftar file di server"
                            >
                              <RefreshCw size={11} className={isLoadingServerMedia ? "animate-spin" : ""} />
                              <span>Segarkan</span>
                            </button>
                          </div>

                          {isLoadingServerMedia && serverMediaFiles.length === 0 ? (
                            <div className="py-2 text-center text-[10px] text-slate-400">Memeriksa file di server...</div>
                          ) : serverMediaFiles.length === 0 ? (
                            <div className="p-2 rounded-lg bg-slate-100/70 border border-slate-200/60 text-center text-[10px] text-slate-500">
                              Belum ada file media tersimpan di server.
                            </div>
                          ) : (
                            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                              {serverMediaFiles.map((file) => {
                                const isActive = Boolean(config.videoUrl && config.videoUrl.includes(file.filename));
                                const isConfirmingDelete = deleteConfirmTarget === file.filename;

                                return (
                                  <div
                                    key={file.filename}
                                    className={`p-2 rounded-lg border transition-all text-xs flex flex-col gap-1 ${
                                      isActive
                                        ? "bg-rose-50/70 border-rose-300 shadow-xs"
                                        : "bg-white border-slate-200 hover:border-slate-300"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1.5">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <div className={`p-1 rounded-md shrink-0 ${isActive ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
                                          {file.isVideo ? <Video size={12} /> : <ImageIcon size={12} />}
                                        </div>
                                        <div className="truncate">
                                          <div className="text-[11px] font-semibold text-slate-800 truncate" title={file.filename}>
                                            {file.filename}
                                          </div>
                                          <div className="text-[9px] text-slate-400 font-mono">
                                            {formatBytes(file.size)} • {file.isVideo ? "Video" : "Gambar"}
                                            {isActive && <span className="text-emerald-600 font-bold ml-1.5">• Aktif</span>}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Action Buttons: Load & Delete */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        {!isActive ? (
                                          <button
                                            type="button"
                                            onClick={() => handleLoadServerMedia(file)}
                                            className="px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-semibold border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                                            title="Muat file ini ke konfigurasi landing"
                                          >
                                            <Download size={10} />
                                            <span>Muat</span>
                                          </button>
                                        ) : (
                                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                            Terpasang
                                          </span>
                                        )}

                                        {!isConfirmingDelete ? (
                                          <button
                                            type="button"
                                            onClick={() => setDeleteConfirmTarget(file.filename)}
                                            disabled={isDeletingMedia}
                                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                            title="Hapus file ini dari server"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        ) : (
                                          <div className="flex items-center gap-1 animate-fade-in">
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteServerMedia(file)}
                                              disabled={isDeletingMedia}
                                              className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-bold shadow-xs transition-colors cursor-pointer"
                                            >
                                              {isDeletingMedia ? "..." : "Hapus"}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setDeleteConfirmTarget(null)}
                                              className="px-1.5 py-0.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] transition-colors cursor-pointer"
                                            >
                                              Batal
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Dropzone Upload Button */}
                        <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-rose-400 hover:bg-rose-50/40 transition-colors">
                          {isUploading ? (
                            <Loader2 size={15} className="text-rose-500 animate-spin" />
                          ) : (
                            <Upload size={15} className="text-slate-500" />
                          )}
                          <span className="text-xs font-semibold text-slate-700">
                            {isUploading
                              ? 'Sedang Memproses Upload...'
                              : config.videoUrl
                              ? 'Ganti File Media (Video / Gambar)'
                              : 'Pilih & Unggah Media (Video MP4 atau Gambar JPG/PNG)'}
                          </span>
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/ogg,video/quicktime,video/mkv,image/jpeg,image/png,image/webp,image/gif"
                            disabled={isUploading}
                            onChange={handleVideoFileUpload}
                            className="hidden"
                          />
                        </label>

                        {/* Real-time Progress Bar */}
                        {isUploading && (
                          <div className="space-y-1 pt-1">
                            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-700">
                              <span>{uploadStatus}</span>
                              <span className="text-rose-600 font-bold">{uploadPercent}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <motion.div
                                className="bg-gradient-to-r from-rose-500 to-pink-500 h-1.5 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${uploadPercent}%` }}
                                transition={{ duration: 0.2 }}
                              />
                            </div>
                            {chunkDetail && (
                              <div className="text-[9px] text-slate-400 text-right">
                                {chunkDetail}
                              </div>
                            )}
                          </div>
                        )}

                        {!isUploading && (uploadStatus || uploadError) && (
                          <p className={`text-[10px] font-medium flex items-center gap-1 ${
                            uploadError ? 'text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200' : 'text-emerald-600'
                          }`}>
                            {uploadError ? <X size={11} className="shrink-0" /> : <Check size={11} className="shrink-0" />}
                            <span>{uploadError || uploadStatus}</span>
                          </p>
                        )}

                        {uploadError && (
                          <p className="text-[10px] text-rose-500 font-medium">
                            {uploadError}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Seksi D: Konfigurasi Kode Sesi (Access PIN) */}
                    <div className="space-y-3 pt-1 border-t border-slate-100">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <KeyRound size={13} className="text-rose-500" />
                        <span>Kode Sesi & Akses Photobooth</span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div>
                          <div className="text-xs font-bold text-slate-800">Wajibkan Kode Sesi untuk Mulai</div>
                          <div className="text-[10px] text-slate-500">
                            Tamu harus memasukkan PIN sebelum memilih frame foto
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(config.requireSessionCode)}
                            onChange={() => onUpdateConfig({ requireSessionCode: !config.requireSessionCode })}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                        </label>
                      </div>

                      {config.requireSessionCode && (
                        <div className="p-3 bg-rose-50/40 border border-rose-200/70 rounded-xl space-y-2">
                          <label className="text-[11px] font-semibold text-slate-700 block">
                            Kode Sesi Aktif (Passcode):
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={config.sessionCode ?? '1234'}
                              onChange={(e) => onUpdateConfig({ sessionCode: e.target.value.toUpperCase() })}
                              placeholder="Contoh: VIP1, WEDDING, atau 1234"
                              maxLength={16}
                              className="flex-1 px-3 py-1.5 text-sm font-mono font-bold uppercase rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-rose-500 text-slate-800"
                            />
                            <button
                              type="button"
                              onClick={handleGenerateRandomCode}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-300 bg-white hover:bg-rose-50 text-rose-600 font-semibold text-xs transition-colors cursor-pointer"
                              title="Acak Kode Alfanumerik (Huruf & Angka)"
                            >
                              <RefreshCw size={12} />
                              <span>Acak Kode</span>
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Bisa menggunakan huruf, angka, atau alfanumerik (misal: VIP1, WEDDING, atau 1234).
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Seksi E: Konfigurasi Kode Admin Exit (Mode Live Kiosk) */}
                    <div className="space-y-3 pt-1 border-t border-slate-100">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck size={13} className="text-rose-500" />
                        <span>Kode Admin Exit Kiosk</span>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <label className="text-[11px] font-semibold text-slate-700 block">
                          Kode Admin untuk Keluar dari Mode Live:
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={config.adminExitCode ?? "9999"}
                            onChange={(e) => onUpdateConfig({ adminExitCode: e.target.value })}
                            placeholder="Contoh: 9999"
                            maxLength={8}
                            className="flex-1 px-3 py-1.5 text-sm font-mono font-bold rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-rose-500 text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
                              onUpdateConfig({ adminExitCode: randomPin });
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                            title="Acak Kode Admin 4 Digit"
                          >
                            <RefreshCw size={12} />
                            <span>Acak PIN</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Kode rahasia ini diperlukan operator untuk keluar dari Mode Live Kiosk via tombol di pojok kanan atas.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: KONFIGURASI PRINTER */}
                {activeTab === 'printer' && (
                  <div className="space-y-5">
                    {/* Status Layanan Cetak */}
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                          <Printer size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                            <span>Layanan Cetak Photobooth</span>
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          </div>
                          <div className="text-[10px] text-emerald-700">
                            {config.printMethod === 'bluetooth'
                              ? (config.bluetoothDeviceName ? `Web Bluetooth (${config.bluetoothDeviceName})` : 'Web Bluetooth: Siap Dipasangkan')
                              : config.printMethod === 'browser'
                              ? 'Dialog Browser: window.print()'
                              : 'Kiosk Silent: Siap Mencetak (/api/print)'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Online
                      </span>
                    </div>

                    {/* Metode & Otomatisasi Cetak */}
                    <div className="space-y-2.5">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <SlidersHorizontal size={13} className="text-rose-500" />
                        <span>Metode & Otomatisasi Cetak</span>
                      </label>

                      {/* Mode Kiosk Silent vs Web Bluetooth vs Native Browser */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => onUpdateConfig({ printMethod: 'kiosk' })}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                            (config.printMethod || 'kiosk') === 'kiosk'
                              ? 'border-rose-500 bg-rose-50/60 text-rose-800 font-semibold shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1">
                            <Zap size={12} className="text-amber-500" /> Kiosk Silent
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Cetak background driver sistem
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => onUpdateConfig({ printMethod: 'bluetooth' })}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                            config.printMethod === 'bluetooth'
                              ? 'border-rose-500 bg-rose-50/60 text-rose-800 font-semibold shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1">
                            <Sparkles size={12} className="text-purple-500" /> Web Bluetooth
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Koneksi nirkabel langsung ke Niimbot
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => onUpdateConfig({ printMethod: 'browser' })}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                            config.printMethod === 'browser'
                              ? 'border-rose-500 bg-rose-50/60 text-rose-800 font-semibold shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1">
                            <FileText size={12} className="text-blue-500" /> Dialog Browser
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Buka jendela cetak browser
                          </div>
                        </button>
                      </div>

                      {/* Bluetooth Pairing & Printer Config Card */}
                      {config.printMethod === 'bluetooth' && (
                        <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-2.5 animate-fade-in">
                          <div className="flex flex-col items-start justify-between">
                            <div>
                              <div className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                                <Sparkles size={13} className="text-purple-600" />
                                <span>Printer Bluetooth & Thermal</span>
                              </div>
                              <div className="text-[10px] text-purple-700/80 mt-0.5">
                                {config.bluetoothDeviceName ? `Terhubung ke: ${config.bluetoothDeviceName}` : 'Niimbot B21/B21S / Printer Thermal Bluetooth'}
                              </div>
                            </div>
                          </div>

                          {btStatus && (
                            <div className={`p-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
                              btStatus.type === 'success'
                                ? 'bg-emerald-100 text-emerald-800'
                                : btStatus.type === 'info'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              <span>{btStatus.message}</span>
                            </div>
                          )}

                          {/* Quick Model Selector */}
                          <div className="pt-2 border-t border-purple-200/80">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                                <Printer size={12} className="text-purple-600" />
                                <span>Model Printer:</span>
                              </span>
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-mono border border-purple-200">
                                {getPrinterProfile(config.printerModelPreset || 'b1_pro', config.bluetoothDeviceName).label} ({getPrinterProfile(config.printerModelPreset || 'b1_pro', config.bluetoothDeviceName).dpi} DPI)
                              </span>
                            </div>
                            <select
                              value={config.printerModelPreset || 'b1_pro'}
                              onChange={(e) => {
                                onUpdateConfig({ printerModelPreset: e.target.value });
                                bluetoothPrinter.setPrinterModel(e.target.value);
                              }}
                              className="w-full text-xs font-semibold bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-purple-950 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                            >
                              {PRINTER_MODEL_OPTIONS.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.label} ({m.desc})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quick Specs & Tombol Konfigurasi Form Modal Lengkap */}
                          <div className="pt-2 border-t border-purple-200/80 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-[11px] text-purple-900 font-medium">
                              <span className="px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200 font-bold font-mono text-[10px]">
                                {config.bluetoothLabelSize === 'continuous' ? 'Continuous Roll' : `${config.bluetoothLabelWidthMm || 50}×${config.bluetoothLabelHeightMm || 30} mm`}
                              </span>
                              <span>•</span>
                              <span className="text-purple-800 font-semibold">
                                Margin: {config.bluetoothMarginMm ?? 1.5} mm
                              </span>
                              <span>•</span>
                              <span className="text-purple-800 font-semibold">
                                Atkinson Halftone
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (typeof onOpenPrinterConfig === 'function') {
                                  onOpenPrinterConfig();
                                }
                              }}
                              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all hover:shadow-md active:scale-98"
                              title="Buka form modal konfigurasi printer dan label stiker lengkap"
                            >
                              <Maximize2 size={13} />
                              <span>Konfigurasi Ukuran & Kualitas Printer</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Auto-Print on Session Completion */}
                      <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div>
                          <div className="text-xs font-bold text-slate-800">Cetak Otomatis (Auto-Print)</div>
                          <div className="text-[10px] text-slate-500">
                            Langsung cetak lembar foto saat tamu tiba di halaman hasil
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(config.autoPrint)}
                            onChange={() => onUpdateConfig({ autoPrint: !config.autoPrint })}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                        </label>
                      </div>

                      {/* Tombol Uji Coba Cetak (Test Print) */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 pt-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">Uji Koneksi Printer</span>
                          <button
                            type="button"
                            disabled={isTestingPrint || isTestingBtPrint}
                            onClick={config.printMethod === 'bluetooth' ? handleTestBluetoothPrint : handleTestPrint}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {(isTestingPrint || isTestingBtPrint) ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Printer size={13} />
                            )}
                            <span>{(isTestingPrint || isTestingBtPrint) ? 'Mengirim...' : 'Kirim Uji Cetak'}</span>
                          </button>
                        </div>

                        {testPrintStatus && (
                          <div className={`p-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
                            testPrintStatus.type === 'success'
                              ? 'bg-emerald-100/70 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100/70 text-rose-800 border border-rose-200'
                          }`}>
                            {testPrintStatus.type === 'success' ? (
                              <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                            ) : (
                              <AlertCircle size={13} className="shrink-0 text-rose-600" />
                            )}
                            <span>{testPrintStatus.message}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Desain Frame & Mapping Slot Foto */}
                    {(() => {
                      const rawFrames = Array.isArray(config.customFrames) && config.customFrames.length > 0
                        ? config.customFrames
                        : [
                            config.customFrame || {
                              id: "frame-1",
                              name: "Frame 1",
                              enabled: true,
                              imageUrl: "",
                              orientation: "portrait",
                              paperSize: "4R",
                              width: 1200,
                              height: 1800,
                              slots: (SLOT_PRESETS[4]?.portrait || []).map((s) => ({ ...s }))
                            }
                          ];

                      const safeFrameIndex = Math.min(
                        Math.max(0, selectedFrameIndex),
                        Math.max(0, rawFrames.length - 1)
                      );
                      const currentCustomFrame = rawFrames[safeFrameIndex] || rawFrames[0];
                      const currentPaperPreset = PAPER_PRESETS[currentCustomFrame?.paperSize || '4R'] || PAPER_PRESETS['4R'];

                      return (
                        <div className="space-y-3 pt-1 border-t border-slate-100">

                          {/* Kelola Desain Frame Card (Ringkas, Terarah & Tidak Redundan) */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center shadow-xs">
                                  <Layers size={16} />
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-900">
                                    Kelola Desain Frame
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {rawFrames.filter((f) => f.enabled).length} dari {rawFrames.length} frame aktif untuk tamu
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                {rawFrames.length} Desain
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              Atur seluruh desain frame, ukuran kertas, posisi slot foto, upload gambar transparan, dan duplikasi frame melalui modal tampilan luas.
                            </p>

                            <button
                              type="button"
                              onClick={() => {
                                if (typeof onOpenFrameManager === 'function') {
                                  onOpenFrameManager();
                                }
                              }}
                              className="w-full py-2.5 px-3.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                            >
                              <Layers size={14} />
                              <span>Buka Kelola Frame (Tampilan Luas)</span>
                              <ExternalLink size={13} />
                            </button>
                          </div>


                        </div>
                      );
                    })()}

                  </div>
                )}
              </div>

                            {/* Drawer Footer Actions */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Reset Default</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Tutup & Terapkan
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
