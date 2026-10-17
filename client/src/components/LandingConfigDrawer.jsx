import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
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
  FileText,
  Copy,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { preloadAndCacheVideo } from '../utils/videoCache.js';
import { sliceAndStoreInIndexedDB, uploadChunksWithProgress } from '../utils/chunkUploader.js';
import { resolveApiUrl } from '../utils/apiConfig.js';

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
  { id: 'Default System Printer', name: 'Default System Printer', desc: 'Printer bawaan sistem operasi' },
  { id: 'DNP DS620 / RX1HS', name: 'DNP DS620 / RX1HS', desc: 'Dye-sublimation kiosk cepat' },
  { id: 'Citizen CY-02', name: 'Citizen CY-02', desc: 'Printer foto kiosk profesional' },
  { id: 'Canon Selphy CP1300 / CP1500', name: 'Canon Selphy CP1300 / CP1500', desc: 'Printer foto dye-sub kompak' },
  { id: 'Epson L805 / L8050', name: 'Epson L805 / L8050', desc: 'Inkjet foto 6-warna beresolusi tinggi' }
];

export default function LandingConfigDrawer({
  isOpen,
  onClose,
  config,
  onUpdateConfig
}) {
  // Hanya 2 Tab: 'media_theme' (Media & Tema) dan 'printer' (Konfigurasi Printer)
  const [activeTab, setActiveTab] = useState('media_theme'); // 'media_theme' | 'printer'

  // Video Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [chunkDetail, setChunkDetail] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState(null);

  // Printer Test States
  const [isTestingPrint, setIsTestingPrint] = useState(false);
  const [testPrintStatus, setTestPrintStatus] = useState(null);

  const handleTitleChange = (e) => {
    onUpdateConfig({ title: e.target.value });
  };

  const handleSubtitleChange = (e) => {
    onUpdateConfig({ subtitle: e.target.value });
  };

  const handleToggleVideo = () => {
    onUpdateConfig({ enableVideo: !config.enableVideo });
  };

  const handleRemoveVideo = () => {
    onUpdateConfig({ videoUrl: '', enableVideo: false });
    setUploadStatus('');
    setUploadError(null);
  };

  const handleVideoFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadPercent(0);
    setChunkDetail('Memulai...');
    setUploadStatus('Menyimpan chunk ke IndexedDB...');

    // Fast local preview while uploading in background
    const tempBlobUrl = URL.createObjectURL(file);
    onUpdateConfig({ videoUrl: tempBlobUrl, enableVideo: true });

    try {
      let apiBase = '';
      if (typeof window !== 'undefined') {
        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalHost && window.location.port !== '5000') {
          apiBase = 'http://localhost:5000';
        }
      }

      // Step 1: Chunk file and store temporarily in IndexedDB
      setUploadStatus('Memecah file & mengamankan ke IndexedDB...');
      const { uploadId, totalChunks } = await sliceAndStoreInIndexedDB(file);
      setChunkDetail(`0 / ${totalChunks} chunk`);

      // Step 2: Upload chunks sequentially with real-time progress
      setUploadStatus('Mengunggah chunk ke server...');
      const mergeData = await uploadChunksWithProgress(uploadId, file, totalChunks, {
        apiBase,
        onProgress: (percent, currentChunk, total) => {
          setUploadPercent(percent);
          setChunkDetail(`Chunk ${currentChunk} dari ${total} (${percent}%)`);
          if (percent === 100) {
            setUploadStatus('Menggabungkan chunk di server...');
          } else {
            setUploadStatus(`Mengunggah ke server (${percent}%)...`);
          }
        }
      });

      const serverVideoUrl = mergeData.videoUrl || mergeData.relativeUrl;

      // Step 3: Warm browser CacheStorage for zero-latency instant replay
      setUploadStatus('Menyimpan ke cache browser...');
      await preloadAndCacheVideo(serverVideoUrl);

      // Persist server video URL in landing config
      onUpdateConfig({ videoUrl: serverVideoUrl, enableVideo: true });
      setUploadPercent(100);
      setChunkDetail('Selesai 100%');
      setUploadStatus('✓ Video berhasil diunggah ke server & browser cache!');
    } catch (err) {
      console.error('Failed chunked video upload:', err);
      setUploadError(err.message || 'Gagal mengunggah video ke server');
    } finally {
      setIsUploading(false);
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
      isTitleCustom: false,
      isSubtitleCustom: false,
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
                    Konfigurasi tampilan acara dan perangkat printer
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
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
                {/* TAB 1: MEDIA & TEMA (Menggabungkan Tema, Teks Konten & Media Video) */}
                {activeTab === 'media_theme' && (
                  <div className="space-y-5">
                    {/* Seksi A: Pilihan Tema Visual */}
                    <div className="space-y-2.5">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Palette size={14} className="text-rose-500" />
                        <span>Pilihan Tema Visual</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.values(THEME_PRESETS).map((preset) => {
                          const isSelected = (config.theme || 'general') === preset.id;
                          return (
                            <div
                              key={preset.id}
                              onClick={() => handleSelectTheme(preset.id)}
                              className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'border-rose-500 bg-rose-50/50 shadow-2xs'
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <div>
                                <div className="text-xs font-bold text-slate-800">
                                  {preset.name}
                                </div>
                                <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                                  {preset.id === 'wedding' ? 'Nuansa cinta & pernikahan' : 'Ceria & universal'}
                                </div>
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                                  <Check size={12} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Seksi B: Teks & Informasi Acara */}
                    <div className="space-y-3 pt-1 border-t border-slate-100">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Type size={14} className="text-rose-500" />
                        <span>Teks & Informasi Acara</span>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Judul Utama (Headline)
                        </label>
                        <input
                          type="text"
                          value={config.title}
                          onChange={(e) => {
                            onUpdateConfig({ isTitleCustom: true });
                            handleTitleChange(e);
                          }}
                          placeholder="Contoh: The Wedding Celebration 💍"
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Sub-Judul (Instruksi)
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
                            Nama Pasangan / Acara (Frame Bawah, 1 Baris):
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

                    {/* Seksi C: Media Video Pengantar & Upload */}
                    <div className="space-y-3 pt-1 border-t border-slate-100">
                      <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-2">
                          <Video size={16} className="text-rose-500" />
                          <div>
                            <div className="text-xs font-bold text-slate-800">Tampilkan Video Pengantar</div>
                            <div className="text-[10px] text-slate-500">Gantikan kotak hadiah dengan video berbingkai</div>
                          </div>
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

                      {/* Orientasi Video / Aspect Ratio Selector */}
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Ukuran & Aspek Rasio Video:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {[
                            { id: 'auto', label: 'Otomatis' },
                            { id: 'portrait-photo', label: 'Portrait 3:4' },
                            { id: 'portrait', label: 'Portrait 9:16' },
                            { id: 'landscape', label: 'Landscape 16:9' }
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

                      {/* Server Upload Section with IndexedDB Chunking */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <HardDrive size={13} className="text-rose-500" />
                            <span>Unggah File Video</span>
                          </div>
                          <span className="text-[9px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Database size={9} /> Chunking 1.5MB
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
                              ? 'Pilih File untuk Mengganti Video'
                              : 'Pilih & Unggah File Video (MP4/WebM)'}
                          </span>
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/ogg,video/quicktime"
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

                        {!isUploading && uploadStatus && (
                          <p className={`text-[10px] font-medium flex items-center gap-1 ${
                            uploadError ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {uploadError ? <X size={11} /> : <Check size={11} />}
                            <span>{uploadStatus}</span>
                          </p>
                        )}

                        {uploadError && (
                          <p className="text-[10px] text-rose-500 font-medium">
                            {uploadError}
                          </p>
                        )}
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
                          <div className="text-[10px] text-emerald-700">Status: Siap Mencetak (/api/print)</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Online
                      </span>
                    </div>

                    {/* Perangkat Printer Target */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Printer size={13} className="text-rose-500" />
                        <span>Nama Perangkat Printer</span>
                      </label>
                      <div className="space-y-1.5">
                        {PRINTER_PRESETS.map((preset) => {
                          const isSelected = (config.printerName || 'Default System Printer') === preset.id;
                          return (
                            <div
                              key={preset.id}
                              onClick={() => onUpdateConfig({ printerName: preset.id })}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'border-rose-500 bg-rose-50/50 shadow-2xs font-semibold'
                                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                              }`}
                            >
                              <div>
                                <div className="text-xs font-bold text-slate-800">{preset.name}</div>
                                <div className="text-[10px] text-slate-400">{preset.desc}</div>
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                                  <Check size={12} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Custom Printer Input */}
                      <div className="pt-1">
                        <label className="text-[10px] font-medium text-slate-500 block mb-1">
                          Atau gunakan nama printer kustom lainnya:
                        </label>
                        <input
                          type="text"
                          value={config.printerName || 'Default System Printer'}
                          onChange={(e) => onUpdateConfig({ printerName: e.target.value })}
                          placeholder="Ketik nama printer..."
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    {/* Ukuran Kertas Cetak */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText size={13} className="text-rose-500" />
                        <span>Ukuran Kertas Foto</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: '4R', label: '4R (4x6")', desc: '10 x 15 cm' },
                          { id: '2x6', label: '2x6" Strip', desc: 'Photo Strip' },
                          { id: 'A4', label: 'A4', desc: 'Album Cetak' }
                        ].map((paper) => (
                          <button
                            key={paper.id}
                            type="button"
                            onClick={() => onUpdateConfig({ paperSize: paper.id })}
                            className={`p-2 rounded-xl text-center border text-xs transition-all cursor-pointer ${
                              (config.paperSize || '4R') === paper.id
                                ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold shadow-2xs'
                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium'
                            }`}
                          >
                            <div>{paper.label}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5">{paper.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Jumlah Salinan Cetak (Copies) */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Copy size={13} className="text-rose-500" />
                        <span>Jumlah Salinan per Sesi (Copies)</span>
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => onUpdateConfig({ printCopies: num })}
                            className={`p-2 rounded-xl text-center border text-xs transition-all cursor-pointer ${
                              (Number(config.printCopies) || 1) === num
                                ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold shadow-2xs'
                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                            }`}
                          >
                            <div className="text-sm font-bold">{num}x</div>
                            <div className="text-[9px] text-slate-400">
                              {num === 1 ? '1 Lembar' : num === 2 ? 'Tamu + Buku' : `${num} Lembar`}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Mode Cetak & Auto-Print */}
                    <div className="space-y-2.5 pt-1 border-t border-slate-100">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <SlidersHorizontal size={13} className="text-rose-500" />
                        <span>Metode & Otomatisasi Cetak</span>
                      </label>

                      {/* Mode Kiosk Silent vs Native Browser */}
                      <div className="grid grid-cols-2 gap-2">
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
                            Cetak otomatis di latar belakang tanpa pop-up
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
                            Buka pop-up jendela cetak browser bawaan
                          </div>
                        </button>
                      </div>

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
                    </div>

                    {/* Tombol Uji Coba Cetak (Test Print) */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 pt-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Uji Koneksi Printer</span>
                        <button
                          type="button"
                          disabled={isTestingPrint}
                          onClick={handleTestPrint}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isTestingPrint ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Printer size={13} />
                          )}
                          <span>{isTestingPrint ? 'Mengirim...' : 'Kirim Uji Cetak'}</span>
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
