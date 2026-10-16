import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export default function ResetConfirmModal({ isOpen, onCancel, onConfirm }) {
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          aria-describedby="reset-modal-desc"
          onClick={onCancel}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center border border-slate-100"
          >
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-500 mx-auto flex items-center justify-center mb-4">
              <AlertTriangle size={32} />
            </div>

            <h3 id="reset-modal-title" className="text-2xl font-black text-slate-800 mb-2">
              Mulai Sesi Baru?
            </h3>
            <p id="reset-modal-desc" className="text-slate-600 text-sm mb-6 leading-relaxed">
              Semua foto pada sesi ini akan <strong>segera dihapus permanen</strong> demi privasi Anda. Pastikan Anda telah mengunduh atau mencetak foto sebelum melanjutkan.
            </p>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                type="button"
                className="flex-1 py-3.5 px-4 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={onConfirm}
                type="button"
                className="flex-1 py-3.5 px-4 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 transition-colors"
              >
                Ya, Hapus & Mulai
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export { ResetConfirmModal };
