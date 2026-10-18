import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Share2, Sparkles, Check, Image as ImageIcon } from 'lucide-react';

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
    <div className="w-full min-h-[100dvh] bg-slate-50 text-slate-800 flex flex-col items-center justify-between p-3 sm:p-4 pb-12 sm:pb-8 select-none relative overflow-y-auto">
      {/* Header - Bersih tanpa tombol back to photobooth */}
      <header className="w-full max-w-md flex items-center justify-center pt-2 pb-2 z-10 border-b border-slate-200/80 shrink-0">
        <div className="flex items-center gap-1.5 text-rose-600 font-extrabold text-xs sm:text-sm tracking-wider uppercase">
          <Sparkles size={14} className="text-amber-500 animate-pulse" />
          <span>Moment Captured</span>
          <Sparkles size={14} className="text-amber-500 animate-pulse" />
        </div>
      </header>

      {/* Main: Preview Hasil Foto Mengambil Ruang Flex Responsif */}
      <main className="w-full max-w-md flex-1 min-h-0 flex flex-col items-center justify-center py-2 z-10">
        {/* Photo Container Flex-Shrinkable agar muat proporsional di semua layar hp */}
        <div className="relative w-full flex-1 min-h-0 max-h-[55vh] sm:max-h-[64vh] flex items-center justify-center mb-3">
          {safeFilename ? (
            <img
              src={photoUrl}
              alt="Photobooth Result"
              className="max-h-[54vh] sm:max-h-[62vh] max-w-[92vw] sm:max-w-md w-auto h-auto object-contain rounded-2xl shadow-md border border-slate-200/70"
              loading="eager"
            />
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
              <ImageIcon size={32} />
              <span className="text-xs">Foto tidak ditemukan</span>
            </div>
          )}
        </div>

        {/* Action Buttons (Tidak akan pernah terpotong) */}
        <div className="w-full max-w-xs sm:max-w-sm flex flex-col gap-2 shrink-0">
          <button
            onClick={handleDownload}
            disabled={downloading || !safeFilename}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              downloading
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white shadow-xs'
            }`}
          >
            <Download size={15} className={downloading ? 'animate-bounce' : ''} />
            <span>{downloading ? 'Mengunduh...' : 'Unduh Foto Sekarang'}</span>
          </button>

          <button
            onClick={handleShare}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-600" />
                <span className="text-emerald-600 font-medium">Link Berhasil Disalin!</span>
              </>
            ) : (
              <>
                <Share2 size={14} />
                <span>Bagikan Link Foto</span>
              </>
            )}
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-sm text-center pt-2 pb-2 z-10 shrink-0">
        <p className="text-[10px] text-slate-400">
          Photobooth Experience &bull; Simpan foto sebelum sesi berakhir
        </p>
      </footer>
    </div>
  );
}
