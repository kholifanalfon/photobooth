import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, Delete, LogOut, KeyRound } from 'lucide-react';

export default function AdminExitModal({
  isOpen,
  onClose,
  onSuccess,
  expectedCode = '9999',
  title = 'Akses Operator Kiosk',
  description = 'Masukkan Kode Admin untuk keluar dari Mode Live kembali ke konfigurasi.',
  actionLabel = 'Keluar Live',
  actionIcon: ActionIcon = LogOut
}) {
  const [enteredCode, setEnteredCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setEnteredCode('');
      setErrorMessage('');
      setShake(false);
    }
  }, [isOpen]);

  // Physical keyboard support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Backspace') {
        setEnteredCode((prev) => prev.slice(0, -1));
        setErrorMessage('');
      } else if (/^[0-9a-zA-Z]$/.test(e.key) && e.key.length === 1) {
        if (enteredCode.length < 16) {
          setEnteredCode((prev) => (prev + e.key).toUpperCase());
          setErrorMessage('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, enteredCode, expectedCode]);

  const handleDigitPress = (digit) => {
    if (enteredCode.length < 16) {
      setEnteredCode((prev) => (prev + digit).toUpperCase());
      setErrorMessage('');
    }
  };

  const handleDelete = () => {
    setEnteredCode((prev) => prev.slice(0, -1));
    setErrorMessage('');
  };

  const handleClear = () => {
    setEnteredCode('');
    setErrorMessage('');
  };

  const handleSubmit = async () => {
    const cleanTarget = String(expectedCode || '9999').trim().toUpperCase();
    const cleanInput = enteredCode.trim().toUpperCase();

    if (!cleanInput) {
      setShake(true);
      setErrorMessage('Silakan masukkan Kode Admin.');
      setTimeout(() => setShake(false), 500);
      return;
    }

    if (cleanInput === cleanTarget) {
      onSuccess();
      return;
    }

    // Try server verification as fallback
    try {
      const res = await fetch('/api/config/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminCode: cleanInput })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.verified) {
          onSuccess();
          return;
        }
      }
    } catch (_) {}

    setShake(true);
    setErrorMessage('Kode Admin salah! Silakan coba lagi.');
    setTimeout(() => setShake(false), 500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            x: shake ? [-8, 8, -6, 6, -3, 3, 0] : 0
          }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: shake ? 0.4 : 0.2 }}
          className="relative w-full max-w-sm rounded-3xl p-5 sm:p-6 bg-slate-900 border border-slate-700 shadow-2xl text-white"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Tutup Dialog Admin"
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-rose-400 mb-2.5 shadow-inner">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
              {description}
            </p>
          </div>

          {/* Input Form Display */}
          <div className="flex justify-center items-center gap-2 mb-3">
            <input
              ref={inputRef}
              type="password"
              inputMode="none"
              readOnly
              tabIndex={-1}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={16}
              value={enteredCode}
              placeholder="KODE ADMIN"
              className="h-12 w-full max-w-[220px] px-4 rounded-xl bg-slate-950 border border-slate-700 text-center tracking-[0.3em] font-mono text-xl text-rose-400 font-black shadow-inner outline-none focus:border-rose-500 transition-colors placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-sans placeholder:text-xs cursor-default select-none"
            />
          </div>

          {/* Error Message */}
          {errorMessage ? (
            <p className="text-rose-400 text-xs text-center font-medium mb-3">
              {errorMessage}
            </p>
          ) : (
            <div className="h-4 mb-2" />
          )}

          {/* Touch Keypad */}
          <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigitPress(String(num))}
                className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 font-bold text-lg text-white transition-all cursor-pointer shadow-xs"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-11 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 active:scale-95 font-bold text-xs transition-all cursor-pointer"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleDigitPress('0')}
              className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 font-bold text-lg text-white transition-all cursor-pointer shadow-xs"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="h-11 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
              aria-label="Hapus Digit"
            >
              <Delete size={17} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750 font-bold text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!enteredCode}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ActionIcon size={14} />
              <span>{actionLabel}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
