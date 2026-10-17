import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, KeyRound, X, Check, AlertCircle } from 'lucide-react';

export default function SessionCodeModal({
  isOpen,
  onClose,
  onSuccess,
  expectedCode = '1234',
  theme = 'general'
}) {
  const [inputCode, setInputCode] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef(null);

  const isWedding = theme === 'wedding';

  useEffect(() => {
    if (isOpen) {
      setInputCode('');
      setErrorMsg(null);
      setIsShaking(false);
      // Auto focus on open
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const cleanInput = inputCode.trim();
    const cleanExpected = String(expectedCode).trim();

    if (!cleanInput) {
      setErrorMsg('Silakan masukkan kode sesi terlebih dahulu');
      triggerShake();
      return;
    }

    if (cleanInput === cleanExpected) {
      setErrorMsg(null);
      onSuccess();
    } else {
      setErrorMsg('Kode sesi salah. Silakan tanyakan kepada operator.');
      triggerShake();
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleKeyPress = (num) => {
    if (inputCode.length >= 8) return;
    setInputCode((prev) => prev + num);
    setErrorMsg(null);
  };

  const handleDelete = () => {
    setInputCode((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    setInputCode('');
    setErrorMsg(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-code-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              x: isShaking ? [-8, 8, -6, 6, -3, 3, 0] : 0
            }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            transition={{ duration: 0.25 }}
            className={`relative w-full max-w-xs sm:max-w-sm rounded-3xl p-5 sm:p-6 shadow-2xl z-10 ${
              isWedding
                ? 'bg-gradient-to-b from-rose-50/95 via-white to-amber-50/90 border border-rose-200'
                : 'bg-white border border-slate-200'
            }`}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              aria-label="Tutup Dialog"
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Icon & Title */}
            <div className="text-center mb-4">
              <div
                className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-2.5 shadow-sm ${
                  isWedding
                    ? 'bg-gradient-to-tr from-rose-500 to-pink-500 text-white shadow-rose-200'
                    : 'bg-rose-500 text-white shadow-rose-200'
                }`}
              >
                <KeyRound size={24} />
              </div>
              <h3
                id="session-code-title"
                className={`text-lg font-bold ${
                  isWedding ? 'font-serif text-rose-950' : 'text-slate-800'
                }`}
              >
                Masukkan Kode Sesi
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto">
                Silakan masukkan kode akses dari operator untuk memulai photobooth
              </p>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="• • • •"
                  className={`w-full py-2.5 px-4 text-center text-xl sm:text-2xl font-mono tracking-widest font-bold rounded-2xl border-2 transition-all outline-none ${
                    errorMsg
                      ? 'border-rose-400 bg-rose-50/50 text-rose-700'
                      : isWedding
                      ? 'border-rose-200 focus:border-rose-500 bg-white text-rose-950'
                      : 'border-slate-300 focus:border-rose-500 bg-white text-slate-800'
                  }`}
                />
              </div>

              {/* Error Message */}
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-1.5 text-xs text-rose-600 font-medium"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{errorMsg}</span>
                </motion.div>
              )}

              {/* Touchscreen Numeric Keypad */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeyPress(String(num))}
                    className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 font-bold text-slate-700 text-base transition-transform cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClear}
                  className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-xs font-semibold text-slate-500 transition-transform cursor-pointer"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleKeyPress('0')}
                  className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 font-bold text-slate-700 text-base transition-transform cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-xs font-semibold text-slate-500 transition-transform cursor-pointer"
                >
                  ⌫
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isWedding
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-rose-200'
                      : 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'
                  }`}
                >
                  <Check size={14} />
                  <span>Mulai Foto</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
