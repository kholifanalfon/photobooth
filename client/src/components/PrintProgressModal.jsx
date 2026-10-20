import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, XCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * PrintProgressModal Component
 * Displays an animated printing dialog with progress status, sheet counter,
 * and an option to cancel the ongoing print operation.
 */
export default function PrintProgressModal({
  isOpen,
  status = 'Menyiapkan proses cetak...',
  currentSheet = 1,
  totalSheets = 1,
  onCancel = null,
  isFinished = false,
  isError = false,
  gifUrl = null
}) {
  // Prevent escape or background click dismissal while printing is active unless onCancel is called
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onCancel && !isFinished) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, isFinished]);

  const progressPercent = Math.min(
    100,
    Math.max(8, isFinished ? 100 : Math.round((currentSheet / Math.max(1, totalSheets)) * 100))
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-progress-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 select-none"
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl text-center border border-slate-100 flex flex-col items-center relative overflow-hidden"
          >
            {/* Ambient Background Aura */}
            <div
              className={`absolute -top-16 -left-16 w-40 h-40 rounded-full blur-3xl opacity-30 pointer-events-none ${
                isError ? 'bg-rose-500' : isFinished ? 'bg-emerald-500' : 'bg-purple-500'
              }`}
            />
            <div
              className={`absolute -bottom-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-30 pointer-events-none ${
                isError ? 'bg-amber-500' : isFinished ? 'bg-teal-500' : 'bg-indigo-500'
              }`}
            />

            {/* Animation / Graphic Area */}
            <div className="w-full flex items-center justify-center my-2 relative">
              <div className="w-40 h-40 relative rounded-2xl overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100/90 border border-slate-200/80 shadow-inner flex items-center justify-center p-2">
                <img
                  src={gifUrl || '/printing-animation.svg'}
                  alt="Animasi Proses Cetak"
                  className="w-full h-full object-contain pointer-events-none drop-shadow-sm"
                  onError={(e) => {
                    // Fallback to internal SVG if external gif fails
                    if (e.currentTarget.src !== window?.location?.origin + '/printing-animation.svg') {
                      e.currentTarget.src = '/printing-animation.svg';
                    }
                  }}
                />
              </div>
            </div>

            {/* Title & Status Message */}
            <h3
              id="print-progress-title"
              className="text-lg md:text-xl font-extrabold text-slate-800 mt-2 mb-1 flex items-center justify-center gap-1.5"
            >
              {isError ? (
                <>
                  <AlertCircle size={20} className="text-rose-600 shrink-0" />
                  <span className="text-rose-600">Pencetakan Gagal</span>
                </>
              ) : isFinished ? (
                <>
                  <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                  <span className="text-emerald-600">Selesai Dicetak!</span>
                </>
              ) : (
                <>
                  <Printer size={20} className="text-indigo-600 shrink-0 animate-pulse" />
                  <span>Sedang Mencetak Foto</span>
                </>
              )}
            </h3>

            <p className="text-xs md:text-sm text-slate-500 font-medium px-2 min-h-[36px] flex items-center justify-center text-center leading-relaxed">
              {status || 'Mohon tunggu, kertas foto sedang diproses oleh printer...'}
            </p>

            {/* Sheet Counter Badge */}
            {totalSheets > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                <span>Lembar ke</span>
                <span className="text-indigo-600 font-black">{currentSheet}</span>
                <span>dari</span>
                <span className="font-black">{totalSheets}</span>
              </div>
            )}

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 mt-4 overflow-hidden border border-slate-200/80 p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  isError
                    ? 'bg-rose-500'
                    : isFinished
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
                }`}
              />
            </div>

            {/* Action / Cancel Button */}
            <div className="w-full mt-5">
              {onCancel && !isFinished && !isError ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <XCircle size={16} className="shrink-0" />
                  <span>Batalkan Cetak</span>
                </button>
              ) : isFinished || isError ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <span>Tutup</span>
                </button>
              ) : null}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export { PrintProgressModal };
