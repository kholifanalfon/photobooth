import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Lock, Unlock, ShieldCheck, AlertCircle, Delete, KeyRound } from 'lucide-react';

export default function AdminLockScreen({
  onUnlock,
  expectedCode = '9999'
}) {
  const [enteredCode, setEnteredCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [shake, setShake] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef(null);

  // Support physical hardware keyboard without triggering mobile soft keyboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        handleSubmit();
      } else if (e.key === "Backspace") {
        setEnteredCode((prev) => prev.slice(0, -1));
        setErrorMessage("");
      } else if (e.key === "Escape") {
        setEnteredCode("");
        setErrorMessage("");
      } else if (/^[0-9a-zA-Z]$/.test(e.key) && e.key.length === 1) {
        if (enteredCode.length < 16) {
          setEnteredCode((prev) => (prev + e.key).toUpperCase());
          setErrorMessage("");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enteredCode, expectedCode]);

  const handleDigitPress = (char) => {
    if (enteredCode.length < 16) {
      setEnteredCode((prev) => (prev + char).toUpperCase());
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

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const cleanInput = enteredCode.trim().toUpperCase();
    const cleanExpected = String(expectedCode || '9999').trim().toUpperCase();

    if (!cleanInput) {
      setErrorMessage('Silakan masukkan Kode Admin.');
      triggerShake();
      return;
    }

    setIsVerifying(true);
    try {
      // First try local matching
      if (cleanInput === cleanExpected) {
        setIsVerifying(false);
        onUnlock();
        return;
      }

      // Fallback verification against server endpoint
      const res = await fetch('/api/config/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminCode: cleanInput })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.verified) {
          setIsVerifying(false);
          onUnlock();
          return;
        }
      }
      
      triggerShake();
      setErrorMessage('Kode Admin salah! Silakan periksa kembali.');
    } catch (_) {
      // Offline fallback comparison
      if (cleanInput === cleanExpected) {
        onUnlock();
      } else {
        triggerShake();
        setErrorMessage('Kode Admin salah! Silakan periksa kembali.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-screen-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          x: shake ? [-8, 8, -6, 6, -3, 3, 0] : 0
        }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-sm rounded-3xl p-6 sm:p-7 bg-slate-900 border border-slate-700/80 shadow-2xl text-white text-center"
      >
        {/* Lock Icon */}
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 border border-rose-400/40 flex items-center justify-center text-white mb-3 shadow-lg shadow-rose-950/50">
          <Lock size={26} />
        </div>

        {/* Title & Description */}
        <h2 id="lock-screen-title" className="text-xl font-black text-white tracking-tight">
          Photobooth Terkunci
        </h2>
        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed max-w-xs mx-auto">
          Aplikasi dalam <strong>Mode Live Kiosk</strong>. Masukkan Kode Admin untuk membuka akses photobooth.
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="relative">
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
              className="w-full py-2.5 px-4 text-center text-xl font-mono uppercase tracking-[0.3em] font-black rounded-xl border-2 border-slate-700 bg-slate-950 text-rose-400 placeholder:text-slate-600 outline-none transition-all cursor-default select-none"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-semibold"
            >
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          {/* Numeric Touchscreen Keypad */}
          <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigitPress(String(num))}
                className="h-11 rounded-xl bg-slate-800 hover:bg-slate-750 active:scale-95 border border-slate-700/80 font-bold text-lg text-white transition-all cursor-pointer shadow-xs"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-11 rounded-xl bg-slate-800/60 hover:bg-slate-700 active:scale-95 border border-slate-700/80 text-xs font-bold text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleDigitPress('0')}
              className="h-11 rounded-xl bg-slate-800 hover:bg-slate-750 active:scale-95 border border-slate-700/80 font-bold text-lg text-white transition-all cursor-pointer shadow-xs"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Hapus Karakter"
              className="h-11 rounded-xl bg-slate-800/60 hover:bg-slate-700 active:scale-95 border border-slate-700/80 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <Delete size={17} />
            </button>
          </div>

          {/* Unlock Submit Button */}
          <button
            type="submit"
            disabled={!enteredCode || isVerifying}
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:opacity-40 text-white font-bold text-sm shadow-lg shadow-rose-900/40 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <Unlock size={16} />
            <span>{isVerifying ? 'Memverifikasi...' : 'Buka Kunci Photobooth'}</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
}
