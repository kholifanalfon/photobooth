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
  Clipboard,
  ExternalLink,
  Sparkles,
  Heart
} from 'lucide-react';

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

  const handleTitleChange = (e) => {
    onUpdateConfig({ title: e.target.value });
  };

  const handleSubtitleChange = (e) => {
    onUpdateConfig({ subtitle: e.target.value });
  };

  const handleToggleVideo = () => {
    onUpdateConfig({ enableVideo: !config.enableVideo });
  };

  const handleVideoUrlChange = (e) => {
    onUpdateConfig({ videoUrl: e.target.value });
  };

  const handlePasteVideoUrl = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          onUpdateConfig({ videoUrl: text.trim(), enableVideo: true });
          return;
        }
      }
    } catch (err) {
      console.warn('Clipboard readText failed or not permitted', err);
    }
    if (typeof window !== 'undefined') {
      const promptVal = window.prompt('Tempel link video YouTube / Google Drive / MP4 di sini:', '');
      if (promptVal && promptVal.trim()) {
        onUpdateConfig({ videoUrl: promptVal.trim(), enableVideo: true });
      }
    }
  };

  const handleClearVideoUrl = () => {
    onUpdateConfig({ videoUrl: '' });
  };

  const handleVideoFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const videoBlobUrl = URL.createObjectURL(file);
      onUpdateConfig({ videoUrl: videoBlobUrl, enableVideo: true });
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
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
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

                {/* TAB 2: VIDEO SETTINGS */}
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

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700">
                          URL Video (YouTube / Google Drive):
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handlePasteVideoUrl}
                            className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Clipboard size={12} />
                            <span>Tempel</span>
                          </button>
                          {config.videoUrl && (
                            <button
                              type="button"
                              onClick={handleClearVideoUrl}
                              className="text-[11px] text-slate-400 hover:text-rose-600 font-medium cursor-pointer"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="url"
                        value={config.videoUrl}
                        onChange={handleVideoUrlChange}
                        placeholder="https://drive.google.com/file/d/... atau YouTube URL"
                        className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                      />
                      <div className="text-[11px] text-slate-400 mt-1 space-y-1">
                        <p>Format yang didukung: Google Drive View, YouTube Video/Shorts, atau tautan file MP4/WebM langsung.</p>
                      </div>
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

                    <div className="relative">
                      <div className="text-xs font-bold text-slate-700 mb-1">Atau Pilih File Video dari Perangkat:</div>
                      <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors">
                        <Upload size={16} className="text-slate-500" />
                        <span className="text-xs font-semibold text-slate-600">Unggah Video Lokal (MP4/WebM)</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/ogg"
                          onChange={handleVideoFileUpload}
                          className="hidden"
                        />
                      </label>
                      {config.videoUrl && (
                        <p className="text-[11px] text-emerald-600 mt-1 font-medium flex items-center gap-1">
                          <Check size={12} /> Video aktif siap diputar di landing page
                        </p>
                      )}
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
