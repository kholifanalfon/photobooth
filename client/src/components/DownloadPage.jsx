import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Share2, Sparkles, Check, ArrowLeft, Image as ImageIcon } from 'lucide-react';

export default function DownloadPage({ filename }) {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  // If filename not directly passed, extract from window.location.pathname
  const safeFilename =
    filename ||
    (typeof window !== 'undefined'
      ? window.location.pathname.replace(/^\/download\//, '').split('?')[0]
      : '');

  const photoUrl = `/uploads/${safeFilename}`;
  const directDownloadUrl = `/api/photos/download/${safeFilename}`;

  const handleDownload = () => {
    setDownloading(true);
    // Create an anchor pointing to direct download route with attachment header
    const link = document.createElement('a');
    link.href = directDownloadUrl;
    link.download = safeFilename || 'photobooth-moment.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloading(false);
    }, 2000);
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Foto Photobooth Saya',
          text: 'Lihat dan simpan foto seru dari Photobooth!',
          url: window.location.href
        });
        return;
      } catch (err) {
        // User cancelled or share rejected, fall back to link copy
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-4 sm:p-6 select-none relative overflow-x-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-pink-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-[400px] h-[400px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-md flex items-center justify-between pt-2 pb-4 z-10 border-b border-slate-800/80">
        <a
          href="/"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Photobooth</span>
        </a>
        <div className="flex items-center gap-1 text-pink-400 font-bold text-sm tracking-wide">
          <Sparkles size={16} />
          <span>MOMENT CAPTURED</span>
        </div>
      </header>

      {/* Center Card & Preview */}
      <main className="w-full max-w-md flex flex-col items-center my-auto py-6 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center gap-4"
        >
          {/* Photo Frame Container */}
          <div className="relative w-full max-w-[320px] rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700/60 bg-black flex items-center justify-center">
            {safeFilename ? (
              <img
                src={photoUrl}
                alt="Photobooth Result"
                className="w-full h-auto object-contain max-h-[50vh] transition-transform duration-300 hover:scale-[1.02]"
                loading="eager"
              />
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-2">
                <ImageIcon size={48} />
                <span className="text-sm">Foto tidak ditemukan</span>
              </div>
            )}
          </div>

          <div className="text-center">
            <h1 className="text-xl font-black bg-gradient-to-r from-pink-400 via-rose-300 to-amber-200 bg-clip-text text-transparent">
              Foto Anda Siap Diunduh!
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Simpan kenangan spesial ini langsung ke galeri smartphone Anda dalam resolusi penuh.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-3 pt-2">
            <button
              onClick={handleDownload}
              disabled={downloading || !safeFilename}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer ${
                downloading
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 text-white hover:brightness-110 active:scale-98 shadow-pink-500/25'
              }`}
            >
              <Download size={20} className={downloading ? 'animate-bounce' : ''} />
              <span>{downloading ? 'Mengunduh Foto...' : 'Unduh Foto Sekarang'}</span>
            </button>

            <button
              onClick={handleShare}
              className="w-full py-3 px-6 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 bg-slate-800/90 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={18} className="text-emerald-400" />
                  <span className="text-emerald-400">Link Berhasil Disalin!</span>
                </>
              ) : (
                <>
                  <Share2 size={18} />
                  <span>Bagikan Link Foto</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md text-center py-3 z-10">
        <p className="text-[11px] text-slate-500">
          Photobooth Experience &bull; Simpan foto sebelum sesi berakhir
        </p>
      </footer>
    </div>
  );
}
