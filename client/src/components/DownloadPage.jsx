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
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col items-center justify-between p-4 sm:p-6 select-none relative">
      {/* Header */}
      <header className="w-full max-w-md flex items-center justify-between pt-2 pb-4 z-10 border-b border-slate-200">
        <a
          href="/"
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors font-medium"
        >
          <ArrowLeft size={16} />
          <span>Photobooth</span>
        </a>
        <div className="flex items-center gap-1 text-rose-600 font-bold text-xs tracking-wider uppercase">
          <Sparkles size={14} />
          <span>Moment Captured</span>
        </div>
      </header>

      {/* Center Flat Card & Preview */}
      <main className="w-full max-w-md flex flex-col items-center my-auto py-4 z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col items-center gap-3.5"
        >
          {/* Photo Frame Container (Clean Flat Border) */}
          <div className="relative w-full max-w-[300px] rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
            {safeFilename ? (
              <img
                src={photoUrl}
                alt="Photobooth Result"
                className="w-full h-auto object-contain max-h-[48vh]"
                loading="eager"
              />
            ) : (
              <div className="h-60 flex flex-col items-center justify-center text-slate-400 gap-2">
                <ImageIcon size={40} />
                <span className="text-sm">Foto tidak ditemukan</span>
              </div>
            )}
          </div>

          <div className="text-center mt-0.5">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              Foto Anda Siap Diunduh!
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Simpan kenangan spesial ini langsung ke galeri smartphone Anda dalam resolusi penuh.
            </p>
          </div>

          {/* Action Buttons (Compact Flat Solid Design) */}
          <div className="w-full flex flex-col gap-2 pt-1">
            <button
              onClick={handleDownload}
              disabled={downloading || !safeFilename}
              className={`w-full py-2.5 sm:py-3 px-5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                downloading
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white shadow-xs'
              }`}
            >
              <Download size={16} className={downloading ? 'animate-bounce' : ''} />
              <span>{downloading ? 'Mengunduh Foto...' : 'Unduh Foto Sekarang'}</span>
            </button>

            <button
              onClick={handleShare}
              className="w-full py-2.5 px-5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={15} className="text-emerald-600" />
                  <span className="text-emerald-600 font-medium">Link Berhasil Disalin!</span>
                </>
              ) : (
                <>
                  <Share2 size={15} />
                  <span>Bagikan Link Foto</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md text-center py-3 z-10">
        <p className="text-[11px] text-slate-400">
          Photobooth Experience &bull; Simpan foto sebelum sesi berakhir
        </p>
      </footer>
    </div>
  );
}
