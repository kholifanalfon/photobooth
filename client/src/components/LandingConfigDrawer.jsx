import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal, Video, Type, Palette, Upload, RefreshCw, Check, Info, ClipboardPaste, Code } from 'lucide-react';

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
    bgClass: 'bg-rose-50/70',
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
          onUpdateConfig({ videoUrl: text.trim(), enableVideo: true, videoInputMode: 'url' });
          return;
        }
      }
    } catch (err) {
      console.warn('Clipboard readText failed or not permitted', err);
    }
    if (typeof window !== 'undefined') {
      const promptVal = window.prompt('Tempel link video YouTube / MP4 di sini:', '');
      if (promptVal && promptVal.trim()) {
        onUpdateConfig({ videoUrl: promptVal.trim(), enableVideo: true, videoInputMode: 'url' });
      }
    }
  };

  const handleClearVideoUrl = () => {
    onUpdateConfig({ videoUrl: '' });
  };

  const handlePasteEmbedCode = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          onUpdateConfig({ embedCode: text.trim(), enableVideo: true, videoInputMode: 'code' });
          return;
        }
      }
    } catch (err) {
      console.warn('Clipboard readText failed or not permitted', err);
    }
    if (typeof window !== 'undefined') {
      const promptVal = window.prompt('Tempel kode embed HTML / iframe di sini:', '');
      if (promptVal && promptVal.trim()) {
        onUpdateConfig({ embedCode: promptVal.trim(), enableVideo: true, videoInputMode: 'code' });
      }
    }
  };

  const handleClearEmbedCode = () => {
    onUpdateConfig({ embedCode: '' });
  };

  const handleEmbedCodeChange = (e) => {
    onUpdateConfig({ embedCode: e.target.value });
  };

  const handleVideoFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const videoBlobUrl = URL.createObjectURL(file);
      onUpdateConfig({ videoUrl: videoBlobUrl, enableVideo: true, videoInputMode: 'url' });
    }
  };

  const handleSelectTheme = (themeId) => {
    const preset = THEME_PRESETS[themeId];
    if (preset) {
      onUpdateConfig({
        theme: themeId,
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
      embedCode: '',
      videoInputMode: 'url',
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
                <Video size={14} /> Video Preview
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

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* TAB 1: TEXT CONTENT */}
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

                  {/* Mode Selector: Link URL vs Embed Code */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Metode Input Video:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => onUpdateConfig({ videoInputMode: 'url' })}
                        className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          (config.videoInputMode || 'url') === 'url'
                            ? 'bg-white text-rose-600 shadow-xs'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        <Video size={13} />
                        <span>Link URL / File</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateConfig({ videoInputMode: 'code' })}
                        className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          config.videoInputMode === 'code'
                            ? 'bg-white text-rose-600 shadow-xs'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        <Code size={13} />
                        <span>Embed Code (HTML)</span>
                      </button>
                    </div>
                  </div>

                  {/* MODE 1: URL / FILE */}
                  {(config.videoInputMode || 'url') === 'url' ? (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-slate-700">
                            URL Video (YouTube / MP4 / WebM)
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
                            placeholder="https://www.youtube.com/watch?v=... atau link MP4"
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
                            <Info size={13} className="shrink-0" /> Catatan Pemutaran Video YouTube:
                          </p>
                          <p className="leading-relaxed">
                            • Autoplay di HP &amp; Tablet mewajibkan video dimulai dalam keadaan <strong>senyap (mute)</strong> sesuai kebijakan keamanan browser mobile.
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
                    </>
                  ) : (
                    /* MODE 2: EMBED CODE (HTML / IFRAME) */
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-slate-700">
                            Kode Embed Video (&lt;iframe...&gt;)
                          </label>
                          <div className="flex items-center gap-1">
                            {config.embedCode && (
                              <button
                                type="button"
                                onClick={handleClearEmbedCode}
                                className="px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                              >
                                Hapus
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handlePasteEmbedCode}
                              title="Tempel kode embed dari clipboard (otomatis mengganti)"
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            >
                              <ClipboardPaste size={12} />
                              <span>Paste Code</span>
                            </button>
                          </div>
                        </div>
                        <textarea
                          rows={5}
                          value={config.embedCode || ''}
                          onChange={handleEmbedCodeChange}
                          placeholder={'<iframe src="https://www.youtube.com/embed/..." allow="autoplay; ..."></iframe>'}
                          className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        />
                        <div className="mt-1.5 p-2.5 bg-blue-50/80 border border-blue-200/70 rounded-xl text-[11px] text-blue-900 space-y-1">
                          <p className="font-bold flex items-center gap-1 text-blue-950">
                            <Info size={13} className="shrink-0" /> Tips Embed Video Generator:
                          </p>
                          <p className="leading-relaxed">
                            • Tempel langsung seluruh kode HTML / &lt;iframe&gt; hasil dari website <em>YouTube Embed Code Generator</em>.
                          </p>
                          <p className="leading-relaxed">
                            • Tampilan video akan otomatis disesuaikan ukurannya agar responsif 16:9 pas di layar HP dan tablet.
                          </p>
                        </div>
                        {config.embedCode && (
                          <p className="text-[11px] text-emerald-600 mt-2 font-medium flex items-center gap-1">
                            <Check size={12} /> Kode embed aktif terpasang di landing page
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: THEME PRESETS */}
              {activeTab === 'theme' && (
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pilih Tema Tampilan Landing Page
                  </label>
                  <div className="grid grid-cols-1 gap-2.5">
                    {Object.values(THEME_PRESETS).map((theme) => {
                      const isSelected = (config.theme || 'general') === theme.id;
                      return (
                        <div
                          key={theme.id}
                          onClick={() => handleSelectTheme(theme.id)}
                          className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'border-rose-500 bg-rose-50/40 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs"
                              style={{ backgroundColor: theme.accentColor }}
                            >
                              {theme.id === 'wedding' ? '💍' : '🎉'}
                            </div>
                            <div>
                              <h4 className="text-xs sm:text-sm font-extrabold text-slate-800">{theme.name}</h4>
                              <p className="text-[11px] text-slate-500">
                                {theme.id === 'wedding' ? 'Nuansa romantis & hangat untuk pernikahan' : 'Nuansa ceria untuk segala momen photobooth'}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                              <Check size={12} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer with Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Reset Default</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
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
