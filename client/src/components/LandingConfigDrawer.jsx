import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal, Video, Type, Palette, Upload, RefreshCw, Check, Info, ClipboardPaste } from 'lucide-react';

export const THEME_PRESETS = {
  general: {
    id: 'general',
    name: 'Umum (Fun & Casual)',
    defaultTitle: 'Capture The Magic! ✨',
    defaultSubtitle: 'Sentuh tombol untuk membuka kotak hadiah dan memulai sesi fotomu.',
    bgClass: 'bg-slate-50',
    accentColor: '#F43F5E', // rose-500
    btnClass: 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white',
    headingClass: 'text-slate-900',
    subheadingClass: 'text-slate-500',
    ornamentColor: 'text-rose-300',
    ornamentType: 'general'
  },
  wedding: {
    id: 'wedding',
    name: 'Pernikahan (Wedding & Romance)',
    defaultTitle: 'The Wedding Celebration 💍',
    defaultSubtitle: 'Abadikan momen bahagia dan penuh cinta di hari istimewa ini.',
    bgClass: 'bg-slate-50',
    accentColor: '#FB7185', // rose-400
    btnClass: 'bg-gradient-to-r from-rose-400 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white shadow-rose-200',
    headingClass: 'text-rose-950 font-serif',
    subheadingClass: 'text-rose-700/80',
    ornamentColor: 'text-rose-300/80',
    ornamentType: 'wedding'
  }
};

export default function LandingConfigDrawer({ isOpen, onClose, config, onUpdateConfig }) {
  const [activeTab, setActiveTab] = useState('content'); // 'content' | 'video' | 'theme'

  const handleTitleChange = (e) => {
    onUpdateConfig({ title: e.target.value });
  };

  const handleSubtitleChange = (e) => {
    onUpdateConfig({ subtitle: e.target.value });
  };

  const handleToggleVideo = (e) => {
    onUpdateConfig({ enableVideo: e.target.checked });
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
      videoUrl: '',
      enableVideo: false,
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

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 left-0 max-w-full flex">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-screen max-w-sm sm:max-w-md bg-white shadow-2xl flex flex-col h-full border-r border-slate-200"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-rose-50 text-rose-500 border border-rose-100">
                    <SlidersHorizontal size={17} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-800">
                      Pengaturan Landing Page
                    </h3>
                    <p className="text-[11px] text-slate-400">Sesuaikan teks, video latar, & tema</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Tutup Pengaturan"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-200 px-3 pt-2 bg-slate-50/30 shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('content')}
                  className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'content'
                      ? 'border-rose-500 text-rose-600 bg-white rounded-t-lg'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Type size={14} />
                  <span>Konten Teks</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('video')}
                  className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'video'
                      ? 'border-rose-500 text-rose-600 bg-white rounded-t-lg'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Video size={14} />
                  <span>Video Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('theme')}
                  className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'theme'
                      ? 'border-rose-500 text-rose-600 bg-white rounded-t-lg'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Palette size={14} />
                  <span>Preset Tema</span>
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* TAB 1: TEXT CONTENT */}
                {activeTab === 'content' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Judul Utama (Heading)
                      </label>
                      <input
                        type="text"
                        value={config.title || ''}
                        onChange={(e) => {
                          handleTitleChange(e);
                          onUpdateConfig({ isTitleCustom: true });
                        }}
                        placeholder="Capture The Magic! ✨"
                        className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Dapat diisi teks bebas sesuai nama acara atau brand Anda.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Sub-judul (Keterangan)
                      </label>
                      <textarea
                        rows={3}
                        value={config.subtitle || ''}
                        onChange={(e) => {
                          handleSubtitleChange(e);
                          onUpdateConfig({ isSubtitleCustom: true });
                        }}
                        placeholder="Sentuh tombol untuk memulai sesi fotomu."
                        className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-none"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Petunjuk atau ucapan selamat datang bagi pengunjung.</p>
                    </div>
                  </div>
                )}

                {/* TAB 2: VIDEO CONFIGURATION */}
                {activeTab === 'video' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Tampilkan Video di Landing</span>
                        <span className="text-[11px] text-slate-500">Gantikan kotak hadiah dengan video preview/teaser</span>
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
                          URL Video (YouTube / Google Drive / MP4)
                        </label>
                        <button
                          type="button"
                          onClick={handlePasteVideoUrl}
                          title="Tempel link dari clipboard (otomatis mengganti link saat ini)"
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                        >
                          <ClipboardPaste size={12} />
                          <span>Paste Link</span>
                        </button>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type="url"
                          value={config.videoUrl || ''}
                          onChange={handleVideoUrlChange}
                          placeholder="https://www.youtube.com/... atau https://drive.google.com/..."
                          className="w-full pl-3 pr-9 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        />
                        {config.videoUrl && (
                          <button
                            type="button"
                            onClick={handleClearVideoUrl}
                            title="Hapus Link Saat Ini"
                            className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div className="mt-1.5 p-2.5 bg-amber-50/80 border border-amber-200/70 rounded-xl text-[11px] text-amber-800 space-y-1">
                        <p className="font-bold flex items-center gap-1 text-amber-900">
                          <Info size={13} className="shrink-0" /> Karakteristik Sumber Video:
                        </p>
                        <p className="leading-relaxed">
                          • <strong>YouTube:</strong> Otomatis berputar (autoplay) dalam kondisi senyap (mute) sesuai kebijakan browser modern.
                        </p>
                        <p className="leading-relaxed">
                          • <strong>Google Drive:</strong> Pemutar Google Drive menampilkan tombol <em>Play</em> di tengah (sistem Google Drive tidak mengizinkan autoplay otomatis dari luar).
                        </p>
                        <p className="leading-relaxed">
                          • <strong>Unggah File Lokal (MP4/WebM):</strong> Paling direkomendasikan jika ingin autoplay langsung 100% instan tanpa perlu ketuk layar sama sekali.
                        </p>
                      </div>
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
                          <div className="space-y-0.5">
                            <div className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                              <span>{preset.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Default: "{preset.defaultTitle}"
                            </div>
                          </div>
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border"
                            style={{
                              borderColor: isSelected ? preset.accentColor : '#CBD5E1',
                              backgroundColor: isSelected ? preset.accentColor : 'transparent'
                            }}
                          >
                            {isSelected && <Check size={12} className="text-white" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-3 border-t border-slate-200 bg-slate-50/70 shrink-0 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Reset Default</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  Selesai
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
