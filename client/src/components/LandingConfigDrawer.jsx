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
  Database
} from 'lucide-react';
import { preloadAndCacheVideo } from '../utils/videoCache.js';
import { sliceAndStoreInIndexedDB, uploadChunksWithProgress } from '../utils/chunkUploader.js';

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

export default function LandingConfigDrawer({
  isOpen,
  onClose,
  config,
  onUpdateConfig
}) {
  const [activeTab, setActiveTab] = useState('content'); // 'content' | 'video' | 'theme'
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [chunkDetail, setChunkDetail] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState(null);

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
      // Determine correct API endpoint base for dev vs production
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
      isSubtitleCustom: false
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
                    Pengaturan Halaman Depan
                  </h2>
                  <p className="text-xs text-slate-500">
                    Kustomisasi judul, video pengantar, dan tema
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50/50 px-3 pt-2 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('content')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                    activeTab === 'content'
                      ? 'border-rose-500 text-rose-600 bg-white shadow-2xs'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Type size={14} />
                  <span>Konten & Teks</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('video')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                    activeTab === 'video'
                      ? 'border-rose-500 text-rose-600 bg-white shadow-2xs'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Video size={14} />
                  <span>Media Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('theme')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                    activeTab === 'theme'
                      ? 'border-rose-500 text-rose-600 bg-white shadow-2xs'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Palette size={14} />
                  <span>Tema Visual</span>
                </button>
              </div>

              {/* Drawer Body Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
                {/* TAB 1: CONTENT SETTINGS */}
                {activeTab === 'content' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Judul Utama (Headline)
                      </label>
                      <input
                        type="text"
                        value={config.title}
                        onChange={(e) => {
                          onUpdateConfig({ isTitleCustom: true });
                          handleTitleChange(e);
                        }}
                        placeholder="Contoh: Capture The Magic! ✨"
                        className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Teks utama yang tampil di atas video / kotak hadiah.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Sub-Judul (Instruksi)
                      </label>
                      <textarea
                        rows={2}
                        value={config.subtitle}
                        onChange={(e) => {
                          onUpdateConfig({ isSubtitleCustom: true });
                          handleSubtitleChange(e);
                        }}
                        placeholder="Contoh: Sentuh tombol untuk membuka kotak hadiah..."
                        className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-none"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Petunjuk singkat untuk tamu undangan / pengguna booth.
                      </p>
                    </div>

                    {/* Frame Detail Fields */}
                    <div className="p-3 bg-rose-50/50 border border-rose-200/70 rounded-xl space-y-3">
                      <div className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                        <Sparkles size={13} className="text-rose-500" />
                        <span>Teks Bingkai Video (Frame Accent)</span>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Tanggal Acara (Tampil di Frame Atas):
                        </label>
                        <input
                          type="text"
                          value={config.eventDate ?? 'Saturday, 17 October 2026'}
                          onChange={(e) => onUpdateConfig({ eventDate: e.target.value })}
                          placeholder="Contoh: 17 . 10 . 2026"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-rose-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Nama Pengantin / Acara (Tampil di Frame Bawah, 1 Line):
                        </label>
                        <input
                          type="text"
                          value={config.coupleNames ?? 'The Wedding Celebration'}
                          onChange={(e) => onUpdateConfig({ coupleNames: e.target.value })}
                          placeholder="Contoh: Vanessa & Moynihan"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: VIDEO SETTINGS - PURE UPLOAD & INDEXEDDB CHUNKING */}
                {activeTab === 'video' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div>
                        <div className="text-xs font-bold text-slate-800">Tampilkan Video di Layar Utama</div>
                        <div className="text-[11px] text-slate-500">Gantikan kotak hadiah dengan pemutar video</div>
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
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        Ukuran & Aspek Rasio Video:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: 'auto', label: 'Otomatis', desc: 'Deteksi Otomatis' },
                          { id: 'portrait-photo', label: 'Portrait 3:4', desc: 'Kamera HP Standar' },
                          { id: 'portrait', label: 'Portrait 9:16', desc: 'Reels / Shorts' },
                          { id: 'landscape', label: 'Landscape 16:9', desc: 'Layar Lebar' }
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onUpdateConfig({ videoRatio: item.id })}
                            className={`p-2 rounded-xl text-center border text-xs transition-all cursor-pointer ${
                              (config.videoRatio || 'auto') === item.id
                                ? 'border-rose-500 bg-rose-50/80 text-rose-700 shadow-2xs font-bold'
                                : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-600 font-medium'
                            }`}
                          >
                            <div>{item.label}</div>
                            <div className="text-[10px] opacity-75 mt-0.5">{item.desc}</div>
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Pilih <em>Portrait 3:4</em> jika video kamera HP Anda memiliki sedikit blank space di mode 9:16.
                      </p>
                    </div>

                    {/* Server Upload & Browser Caching Section with IndexedDB Chunking */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <HardDrive size={14} className="text-rose-500" />
                          <span>Unggah File Video</span>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Database size={10} /> Chunking IndexedDB
                        </span>
                      </div>

                      {/* Video Status Card if video already exists */}
                      {config.videoUrl && !isUploading && (
                        <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                              <Check size={14} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-emerald-950">Video Aktif Tersimpan</div>
                              <div className="text-[10px] text-emerald-700">Tersimpan di server & cache browser</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveVideo}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Video"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}

                      {/* Dropzone Upload Button */}
                      <label className="flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-rose-400 hover:bg-rose-50/40 transition-colors">
                        {isUploading ? (
                          <Loader2 size={16} className="text-rose-500 animate-spin" />
                        ) : (
                          <Upload size={16} className="text-slate-500" />
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

                      {/* Real-time Progress Bar & Chunk Details */}
                      {isUploading && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                            <span>{uploadStatus}</span>
                            <span className="text-rose-600 font-bold">{uploadPercent}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <motion.div
                              className="bg-gradient-to-r from-rose-500 to-pink-500 h-2 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${uploadPercent}%` }}
                              transition={{ duration: 0.2 }}
                            />
                          </div>
                          {chunkDetail && (
                            <div className="text-[10px] text-slate-400 text-right">
                              {chunkDetail}
                            </div>
                          )}
                        </div>
                      )}

                      {!isUploading && uploadStatus && (
                        <p className={`text-[11px] font-medium flex items-center gap-1 ${
                          uploadError ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          {uploadError ? <X size={12} /> : <Check size={12} />}
                          <span>{uploadStatus}</span>
                        </p>
                      )}

                      {uploadError && (
                        <p className="text-[11px] text-rose-500 font-medium">
                          {uploadError}
                        </p>
                      )}

                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Format yang didukung: <strong>MP4, WebM, MOV</strong>. File otomatis dipecah per 1.5MB via IndexedDB agar bebas hambatan timeout jaringan.
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 3: THEME PRESETS */}
                {activeTab === 'theme' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">Pilih tema visual yang sesuai dengan konsep acara:</p>
                    {Object.values(THEME_PRESETS).map((preset) => {
                      const isSelected = (config.theme || 'general') === preset.id;
                      return (
                        <div
                          key={preset.id}
                          onClick={() => handleSelectTheme(preset.id)}
                          className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'border-rose-500 bg-rose-50/40 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div>
                            <div className="text-xs sm:text-sm font-bold text-slate-800">
                              {preset.name}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {preset.description}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                              <Check size={14} />
                            </div>
                          )}
                        </div>
                      );
                    })}
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
