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
          className={`w-14 h-20 sm:w-16 sm:h-24 rounded-lg mb-2 sm:mb-3 grid grid-cols-2 grid-rows-2 gap-1 p-1 sm:p-1.5 shadow-sm transition-colors duration-200 ${borderStyle}`}
          style={{ backgroundColor: frameBg }}
        >
          <div className="w-full h-full bg-slate-400/80 rounded-sm" />
          <div className="w-full h-full bg-slate-400/80 rounded-sm" />
          <div className="w-full h-full bg-slate-400/80 rounded-sm" />
          <div className="w-full h-full bg-slate-400/80 rounded-sm" />
        </div>
      );
    }

    if (key === 'POLAROID_1') {
      return (
        <div
          data-testid="thumbnail-polaroid-1"
          className={`w-14 h-20 sm:w-16 sm:h-24 rounded-lg mb-2 sm:mb-3 flex flex-col justify-between p-1 sm:p-1.5 shadow-sm transition-colors duration-200 ${borderStyle}`}
          style={{ backgroundColor: frameBg }}
        >
          <div className="w-full h-11 sm:h-14 bg-slate-400/80 rounded-sm" />
          <div className="w-6 sm:w-8 h-1.5 bg-slate-300/80 rounded-full self-center mb-0.5 sm:mb-1" />
        </div>
      );
    }

    // STRIP_3 or STRIP_4 or fallback
    return (
      <div
        data-testid={`thumbnail-${key.toLowerCase()}`}
        className={`w-14 h-20 sm:w-16 sm:h-24 rounded-lg mb-2 sm:mb-3 flex flex-col gap-1 p-1 sm:p-1.5 justify-center items-center shadow-sm transition-colors duration-200 ${borderStyle}`}
        style={{ backgroundColor: frameBg }}
      >
        {Array.from({ length: config.photoCount }).map((_, i) => (
          <div key={i} className="w-full h-full bg-slate-400/80 rounded-sm" />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-slate-50 text-slate-900 p-4 sm:p-6 md:p-10 select-none">
      <div className="flex items-center justify-between max-w-5xl mx-auto w-full mb-6 sm:mb-8">
        <button
          onClick={onBack}
          aria-label="Kembali"
          className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 font-semibold text-sm sm:text-base text-slate-700 transition-colors cursor-pointer shadow-sm"
        >
          <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px]" /> Kembali
        </button>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 text-center">
          Pilih Template & Warna Frame
        </h2>
        <div className="w-16 sm:w-24"></div>
      </div>

      <div className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-start">
        {/* Layout Options */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-slate-800">
            1. Pilih Tata Letak Foto
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
                  className={`cursor-pointer p-3 sm:p-4 rounded-xl border-2 transition-all flex flex-col items-center text-center ${
                    active
                      ? 'border-rose-500 bg-rose-50/40 scale-[1.02]'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  {renderLayoutThumbnail(key, config)}
                  <span className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1">{config.name}</span>
                  <span className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{config.photoCount} Jepretan</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Color Palette */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-6">
          <div>
            <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-slate-800">
              2. Pilih Warna Bingkai
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 gap-2.5 sm:gap-3">
              {PALETTES.map((p) => {
                const active = selectedPalette.hex === p.hex;
                return (
                  <button
                    key={p.hex}
                    type="button"
                    aria-label={p.name}
                    aria-pressed={active}
                    onClick={() => setSelectedPalette(p)}
                    className={`flex flex-col items-center p-2.5 sm:p-3 rounded-xl border transition-all focus:outline-none cursor-pointer ${
                      active ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-slate-300 mb-1.5 sm:mb-2 flex items-center justify-center shadow-xs"
                      style={{ backgroundColor: p.hex }}
                    >
                      {active && <Check size={18} className={`sm:w-5 sm:h-5 ${p.hex === '#1E1E24' ? 'text-white' : 'text-slate-800'}`} />}
                    </div>
                    <span className="text-[11px] sm:text-xs font-medium text-slate-700">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleConfirm}
            className="w-full py-3.5 sm:py-4 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-bold text-base sm:text-lg rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            Lanjut ke Kamera <ArrowRight size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
