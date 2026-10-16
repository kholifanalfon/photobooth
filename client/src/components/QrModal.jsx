import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, QrCode, Download } from 'lucide-react';

export default function QrModal({
  isOpen,
  onClose,
  qrCodeDataUri,
  downloadUrl,
  isLoading = false
}) {
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl text-center relative border border-slate-100"
          >
            <button
              onClick={onClose}
              aria-label="Tutup"
              type="button"
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>

            <h3 id="qr-modal-title" className="text-2xl font-black text-slate-800 mb-1">
              Scan QR Code
            </h3>
            <p className="text-slate-500 text-sm mb-6">
              Arahkan kamera smartphone untuk mengunduh fotomu.
            </p>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block mb-6 shadow-inner">
              {qrCodeDataUri ? (
                <img
                  src={qrCodeDataUri}
                  alt="QR Code Download"
                  className="w-56 h-56 object-contain rounded-lg"
                />
              ) : (
                <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <QrCode className="animate-pulse opacity-40" size={48} />
                  <span>Membuat QR...</span>
                </div>
              )}
            </div>

            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-pink-600 hover:underline font-semibold"
              >
                <Download size={16} /> Buka Link Langsung
              </a>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export { QrModal };
