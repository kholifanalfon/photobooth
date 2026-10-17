import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal, Video, Type, Palette, Upload, RefreshCw, Check, Info } from 'lucide-react';

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
    name: 'Wedding & Celebration 💍',
    defaultTitle: 'The Wedding Celebration 💐',
    defaultSubtitle: 'Selamat datang di momen bahagia kami! Sentuh untuk mengabadikan kenangan indah.',
    bgClass: 'bg-stone-50',
    accentColor: '#D97706', // amber-600 warm gold
    btnClass: 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white',
    headingClass: 'text-stone-900 font-serif',
    subheadingClass: 'text-stone-600 font-serif',
    ornamentColor: 'text-amber-300',
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

  const handleVideoUrlChange = (e) => {
    onUpdateConfig({ videoUrl: e.target.value });
  };

  const handleToggleVideo = () => {
    onUpdateConfig({ enableVideo: !config.enableVideo });
  };

  const handleVideoFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const videoBlobUrl = URL.createObjectURL(file);
      onUpdateConfig({ videoUrl: videoBlobUrl, enableVideo: true });
    }
  };

  const handleSelectTheme = (themeId) => {
    const preset = THEME_PRESETS[themeId];
    if (preset) {
      onUpdateConfig({
        theme: themeId,
        // if title/subtitle was still preset default, update them smoothly
        title: config.isTitleCustom ? config.title : preset.defaultTitle,
        subtitle: config.isSubtitleCustom ? config.subtitle : preset.defaultSubtitle
      });
    }
  };

  const handleResetDefaults = () => {
    const theme = THEME_PRESETS[config.theme] || THEME_PRESETS.general;
    onUpdateConfig({
      title: theme.defaultTitle,
      subtitle: theme.defaultSubtitle,
      videoUrl: '',
      enableVideo: false,
      isTitleCustom: false,
      isSubtitleCustom: false
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Konfigurasi Landing Page">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity cursor-pointer"
          />

          {/* Drawer Sidebar on the Left */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="relative z-10 w-full max-w-sm sm:max-w-md bg-white h-full flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2 text-slate-800">
                <SlidersHorizontal size={18} className="text-slate-600" />
                <h3 className="font-extrabold text-sm sm:text-base">Pengaturan Landing Page</h3>
              </div>
              <button
                onClick={onClose}
                aria-label="Tutup Pengaturan"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nav Tabs */}
            <div className="flex border-b border-slate-200 px-3 pt-2 gap-1 shrink-0 bg-slate-50/50">
              <button
                onClick={() => setActiveTab('content')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer border-b-2 ${
                  activeTab === 'content'
                    ? 'border-rose-500 text-rose-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Type size={14} /> Teks
              </button>
              <button
                onClick={() => setActiveTab('video')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer border-b-2 ${
                  activeTab === 'video'
                    ? 'border-rose-500 text-rose-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Video size={14} /> Video
              </button>
              <button
                onClick={() => setActiveTab('theme')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer border-b-2 ${
                  activeTab === 'theme'
                    ? 'border-rose-500 text-rose-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Palette size={14} /> Tema
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* TAB 1: CONTENT (TITLE & SUBTITLE) */}
              {activeTab === 'content' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Judul Landing Page
                    </label>
                    <input
                      type="text"
                      value={config.title}
                      onChange={(e) => {
                        handleTitleChange(e);
                        onUpdateConfig({ isTitleCustom: true });
                      }}
                      placeholder="Contoh: Capture The Magic! ✨"
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Teks judul utama yang tampil di atas halaman.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Subjudul / Deskripsi Ajakan
                    </label>
                    <textarea
                      rows={3}
                      value={config.subtitle}
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      URL Video (YouTube / MP4 / WebM / Link Langsung)
                    </label>
                    <input
                      type="url"
                      value={config.videoUrl || ''}
                      onChange={handleVideoUrlChange}
                      placeholder="https://www.youtube.com/watch?v=... atau link MP4"
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    />
                    <div className="mt-1.5 p-2.5 bg-amber-50/80 border border-amber-200/70 rounded-xl text-[11px] text-amber-800 space-y-1">
                      <p className="font-bold flex items-center gap-1 text-amber-900">
                        <Info size={13} className="shrink-0" /> Catatan Pemutaran Video YouTube:
                      </p>
                      <p className="leading-relaxed">
                        • Autoplay di HP & Tablet mewajibkan video dimulai dalam keadaan <strong>senyap (mute)</strong> sesuai kebijakan keamanan browser mobile.
                      </p>
                      <p className="leading-relaxed">
                        • Pastikan video YouTube memiliki izin <em>Allow embedding</em>. Video klip musik berhak cipta (VEVO) diblokir oleh pemiliknya dari pemutaran luar (Error 150).
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
                  <span className="text-xs font-bold text-slate-700 block">Pilih Tema Hiasan:</span>
                  {Object.values(THEME_PRESETS).map((t) => {
                    const isSelected = config.theme === t.id;
                    return (
                      <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectTheme(t.id)}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-rose-500 bg-rose-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-slate-800">{t.name}</span>
                          {isSelected && <Check size={16} className="text-rose-500" />}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {t.id === 'wedding'
                            ? 'Dilengkapi ornamen cincin, hati, tipografi elegan dan palet nuansa wedding.'
                            : 'Gaya fun modern, dilengkapi animasi hadiah, sparkles, dan aksen kamera.'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between gap-2">
              <button
                onClick={handleResetDefaults}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw size={13} /> Reset Default
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
