import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, KeyRound, X, Check, AlertCircle, Hash, Type } from 'lucide-react';

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
  const [keypadMode, setKeypadMode] = useState('numpad'); // 'numpad' | 'qwerty'
  const inputRef = useRef(null);

  const isWedding = theme === 'wedding';

  useEffect(() => {
    if (isOpen) {
      setInputCode('');
      setErrorMsg(null);
      setIsShaking(false);
      // Auto-detect keypad mode based on expectedCode: if contains letters, start with qwerty, else numpad
      const hasLetters = /[a-zA-Z]/.test(String(expectedCode));
      setKeypadMode(hasLetters ? 'qwerty' : 'numpad');
    }
  }, [isOpen, expectedCode]);

  // Handle keyboard events (Physical hardware keyboard support)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Backspace') {
        setInputCode((prev) => prev.slice(0, -1));
        setErrorMsg(null);
      } else if (/^[0-9a-zA-Z]$/.test(e.key) && e.key.length === 1) {
        if (inputCode.length < 16) {
          setInputCode((prev) => (prev + e.key).toUpperCase());
          setErrorMsg(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, inputCode]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const cleanInput = inputCode.trim().toUpperCase();
    const cleanExpected = String(expectedCode).trim().toUpperCase();

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

  const handleKeyPress = (char) => {
    if (inputCode.length >= 16) return;
    setInputCode((prev) => (prev + char).toUpperCase());
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
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none overflow-y-auto"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
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
            className={`relative w-full max-w-[360px] sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-3xl p-4 sm:p-6 shadow-2xl z-10 my-auto ${
              isWedding
                ? 'bg-gradient-to-b from-rose-50/95 via-white to-amber-50/90 border border-rose-200'
                : 'bg-white border border-slate-200'
            }`}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              aria-label="Tutup Dialog"
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Icon & Title */}
            <div className="text-center mb-3">
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-2xl flex items-center justify-center mb-2 shadow-sm ${
                  isWedding
                    ? 'bg-gradient-to-tr from-rose-500 to-pink-500 text-white shadow-rose-200'
                    : 'bg-rose-500 text-white shadow-rose-200'
                }`}
              >
                <KeyRound size={22} className="sm:w-6 sm:h-6" />
              </div>
              <h3
                id="session-code-title"
                className={`text-base sm:text-lg font-bold ${
                  isWedding ? 'font-serif text-rose-950' : 'text-slate-800'
                }`}
              >
                Masukkan Kode Sesi
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 max-w-[280px] mx-auto">
                Silakan masukkan kode akses (huruf & angka) untuk memulai photobooth
              </p>
            </div>

            {/* Input Form Display */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="none"
                  readOnly
                  tabIndex={-1}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={16}
                  value={inputCode}
                  placeholder="KODE SESI"
                  className={`w-full py-2.5 px-3 sm:py-3 sm:px-4 text-center text-xl sm:text-2xl font-mono uppercase tracking-widest font-extrabold rounded-2xl border-2 transition-all outline-none select-none cursor-default ${
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

              {/* Keypad Mode Switcher Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setKeypadMode('numpad')}
                  className={`flex-1 py-1 sm:py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    keypadMode === 'numpad'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Hash size={13} />
                  <span>Numpad (Angka)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setKeypadMode('qwerty')}
                  className={`flex-1 py-1 sm:py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    keypadMode === 'qwerty'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Type size={13} />
                  <span>Keyboard (Huruf & Angka)</span>
                </button>
              </div>

              {/* Keypad View 1: Spacious Responsive Numpad */}
              {keypadMode === 'numpad' ? (
                <div className="grid grid-cols-3 gap-2 pt-1 touch-manipulation">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeyPress(digit)}
                      className="h-11 sm:h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 active:bg-rose-100 font-black text-slate-800 text-lg sm:text-xl transition-all cursor-pointer flex items-center justify-center shadow-2xs border border-slate-200/60"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    title="Hapus Semua"
                    className="h-11 sm:h-12 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 font-bold text-rose-600 text-xs sm:text-sm transition-all cursor-pointer border border-rose-200/80 flex items-center justify-center"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeyPress('0')}
                    className="h-11 sm:h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 active:bg-rose-100 font-black text-slate-800 text-lg sm:text-xl transition-all cursor-pointer flex items-center justify-center shadow-2xs border border-slate-200/60"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    title="Hapus Karakter"
                    className="h-11 sm:h-12 rounded-xl bg-slate-200 hover:bg-slate-300 active:scale-95 font-bold text-slate-700 text-sm sm:text-base transition-all cursor-pointer flex items-center justify-center border border-slate-300/60"
                  >
                    ⌫
                  </button>
                </div>
              ) : (
                /* Keypad View 2: Touch-Optimized Responsive QWERTY Layout */
                <div className="space-y-1.5 pt-1 touch-manipulation">
                  {/* Numbers Row */}
                  <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleKeyPress(digit)}
                        className="h-8 sm:h-9 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 active:bg-rose-100 font-bold text-slate-700 text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center border border-slate-200/60"
                      >
                        {digit}
                      </button>
                    ))}
                  </div>

                  {/* Letters Row 1: Q - P */}
                  <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                    {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((letter) => (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => handleKeyPress(letter)}
                        className="h-8 sm:h-9 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 active:bg-rose-100 font-bold text-slate-700 text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center border border-slate-200/60"
                      >
                        {letter}
                      </button>
                    ))}
                  </div>

                  {/* Letters Row 2: A - L */}
                  <div className="grid grid-cols-9 gap-1 sm:gap-1.5 px-1 sm:px-2">
                    {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((letter) => (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => handleKeyPress(letter)}
                        className="h-8 sm:h-9 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 active:bg-rose-100 font-bold text-slate-700 text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center border border-slate-200/60"
                      >
                        {letter}
                      </button>
                    ))}
                  </div>

                  {/* Letters Row 3: C, Z - M, Delete */}
                  <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
                    <button
                      type="button"
                      onClick={handleClear}
                      title="Hapus Semua"
                      className="h-8 sm:h-9 rounded-lg bg-rose-50 hover:bg-rose-100 active:scale-95 font-bold text-rose-600 text-[10px] sm:text-xs transition-all cursor-pointer border border-rose-200/60 flex items-center justify-center"
                    >
                      C
                    </button>
                    {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((letter) => (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => handleKeyPress(letter)}
                        className="h-8 sm:h-9 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 active:bg-rose-100 font-bold text-slate-700 text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center border border-slate-200/60"
                      >
                        {letter}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleDelete}
                      title="Hapus Karakter"
                      className="h-8 sm:h-9 rounded-lg bg-slate-200 hover:bg-slate-300 active:scale-95 font-bold text-slate-700 text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center border border-slate-300/60"
                    >
                      ⌫
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 active:scale-98 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-md active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isWedding
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-rose-200'
                      : 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'
                  }`}
                >
                  <Check size={15} />
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
