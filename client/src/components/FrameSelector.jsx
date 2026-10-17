import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { FRAME_CONFIGS } from '../utils/canvasCompositor.js';

export const PALETTES = [
  { name: 'Pure White', hex: '#FFFFFF', text: '#1e293b' },
  { name: 'Midnight Black', hex: '#1E1E24', text: '#FFFFFF' },
  { name: 'Pastel Pink', hex: '#FFE4E6', text: '#881337' },
  { name: 'Sky Lavender', hex: '#E0E7FF', text: '#312E81' },
  { name: 'Mint Soft', hex: '#D1FAE5', text: '#064E3B' },
  { name: 'Warm Cream', hex: '#FEF3C7', text: '#78350F' }
];

export default function FrameSelector({ onConfirm, onBack }) {
  const [selectedLayout, setSelectedLayout] = useState('STRIP_3');
  const [selectedPalette, setSelectedPalette] = useState(PALETTES[0]);

  const layouts = Object.entries(FRAME_CONFIGS);

  const handleConfirm = () => {
    if (typeof onConfirm === 'function') {
      onConfirm({
        layoutType: selectedLayout,
        palette: selectedPalette,
        frameColor: selectedPalette.hex
      });
    }
  };

  /**
   * Helper to render accurate layout thumbnail according to layout type and selected frame color
   */
  const renderLayoutThumbnail = (key, config) => {
    const frameBg = selectedPalette.hex;
    const borderStyle = frameBg === '#FFFFFF' ? 'border border-slate-300' : 'border border-black/10';

    if (key === 'GRID_2X2') {
      return (
        <div
          data-testid="thumbnail-grid-2x2"
          className={`w-12 h-16 sm:w-16 sm:h-24 rounded-lg mb-1.5 sm:mb-2 grid grid-cols-2 grid-rows-2 gap-1 p-1 sm:p-1.5 shadow-xs transition-colors duration-200 ${borderStyle}`}
          style={{ backgroundColor: frameBg }}
        >
          <div className="w-full h-full bg-slate-400/80 rounded-xs" />
          <div className="w-full h-full bg-slate-400/80 rounded-xs" />
          <div className="w-full h-full bg-slate-400/80 rounded-xs" />
          <div className="w-full h-full bg-slate-400/80 rounded-xs" />
        </div>
      );
    }

    if (key === 'POLAROID_1') {
      return (
        <div
          data-testid="thumbnail-polaroid-1"
          className={`w-12 h-16 sm:w-16 sm:h-24 rounded-lg mb-1.5 sm:mb-2 flex flex-col justify-between p-1 sm:p-1.5 shadow-xs transition-colors duration-200 ${borderStyle}`}
          style={{ backgroundColor: frameBg }}
        >
          <div className="w-full h-9 sm:h-14 bg-slate-400/80 rounded-xs" />
          <div className="w-5 sm:w-8 h-1 bg-slate-300/80 rounded-full self-center mb-0.5" />
        </div>
      );
    }

    // STRIP_3 or STRIP_4 or fallback
    return (
      <div
        data-testid={`thumbnail-${key.toLowerCase()}`}
        className={`w-12 h-16 sm:w-16 sm:h-24 rounded-lg mb-1.5 sm:mb-2 flex flex-col gap-0.5 sm:gap-1 p-1 sm:p-1.5 justify-center items-center shadow-xs transition-colors duration-200 ${borderStyle}`}
        style={{ backgroundColor: frameBg }}
      >
        {Array.from({ length: config.photoCount }).map((_, i) => (
          <div key={i} className="w-full h-full bg-slate-400/80 rounded-xs" />
        ))}
      </div>
    );
  };

  return (
    <div className="relative flex flex-col justify-between h-full h-[100dvh] max-h-[100dvh] w-full bg-slate-50 text-slate-900 select-none overflow-hidden pb-20 sm:pb-24">
      {/* Header (Title Only) */}
      <div className="flex items-center justify-center max-w-4xl mx-auto w-full pt-3 sm:pt-5 px-4 shrink-0">
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 text-center tracking-tight">
          Pilih Template & Warna Frame
        </h2>
      </div>

      {/* Main Content (Center) */}
      <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 items-center my-auto px-4 p-1">
        {/* Layout Options (Open Flat Layout) */}
        <div className="flex flex-col justify-center">
          <h3 className="font-bold text-xs sm:text-sm mb-2 text-slate-800">
            1. Pilih Tata Letak Foto
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 p-1">
            {layouts.map(([key, config]) => {
              const active = selectedLayout === key;
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  aria-label={config.name}
                  aria-pressed={active}
                  onClick={() => setSelectedLayout(key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedLayout(key);
                    }
                  }}
                  className={`cursor-pointer p-2 sm:p-2.5 rounded-xl border-2 transition-all flex flex-col items-center text-center ${
                    active
                      ? 'border-rose-500 bg-rose-50/50 shadow-xs scale-[1.02]'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  {renderLayoutThumbnail(key, config)}
                  <span className="font-bold text-xs text-slate-900 line-clamp-1">{config.name}</span>
                  <span className="text-[10px] sm:text-[11px] text-slate-500">{config.photoCount} Jepretan</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Color Palette (Open Flat Layout) */}
        <div className="flex flex-col justify-center gap-2 p-1">
          <div>
            <h3 className="font-bold text-xs sm:text-sm mb-2 text-slate-800">
              2. Pilih Warna Bingkai
            </h3>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1">
              {PALETTES.map((p) => {
                const active = selectedPalette.hex === p.hex;
                return (
                  <button
                    key={p.hex}
                    type="button"
                    aria-label={p.name}
                    aria-pressed={active}
                    onClick={() => setSelectedPalette(p)}
                    className={`flex flex-col items-center p-1.5 sm:p-2 rounded-xl border-2 transition-all focus:outline-none cursor-pointer ${
                      active ? 'border-rose-500 bg-rose-50/50 shadow-xs' : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-slate-300 mb-1 flex items-center justify-center shadow-xs"
                      style={{ backgroundColor: p.hex }}
                    >
                      {active && <Check size={14} className={p.hex === '#1E1E24' ? 'text-white' : 'text-slate-800'} />}
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-medium text-slate-700">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 sm:py-4">
        <div className="max-w-md mx-auto w-full flex items-center gap-2.5">
          <button
            onClick={onBack}
            aria-label="Kembali"
            className="w-1/3 py-2.5 sm:py-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} /> Kembali
          </button>
          <button
            onClick={handleConfirm}
            className="w-2/3 py-2.5 sm:py-3 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            Lanjut ke Kamera <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
