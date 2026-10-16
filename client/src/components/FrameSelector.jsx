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

  return (
    <div className="flex flex-col min-h-screen w-full bg-slate-50 text-slate-800 p-6 md:p-10 select-none">
      <div className="flex items-center justify-between max-w-5xl mx-auto w-full mb-8">
        <button
          onClick={onBack}
          aria-label="Kembali"
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-100 font-semibold"
        >
          <ArrowLeft size={18} /> Kembali
        </button>
        <h2 className="text-2xl md:text-3xl font-black">Pilih Template & Warna Frame</h2>
        <div className="w-24"></div>
      </div>

      <div className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Layout Options */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg mb-4 text-slate-700">1. Pilih Tata Letak Foto</h3>
          <div className="grid grid-cols-2 gap-4">
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
                  className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col items-center text-center ${
                    active ? 'border-pink-500 bg-pink-50/50 shadow-md scale-[1.02]' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="w-16 h-24 bg-slate-200 rounded-lg mb-3 flex flex-col gap-1 p-1 justify-center items-center">
                    {Array.from({ length: config.photoCount }).slice(0, 4).map((_, i) => (
                      <div key={i} className="w-full h-full bg-slate-400 rounded-sm" />
                    ))}
                  </div>
                  <span className="font-bold text-sm text-slate-800">{config.name}</span>
                  <span className="text-xs text-slate-500">{config.photoCount} Jepretan</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Color Palette */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-lg mb-4 text-slate-700">2. Pilih Warna Bingkai</h3>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {PALETTES.map((p) => {
                const active = selectedPalette.hex === p.hex;
                return (
                  <button
                    key={p.hex}
                    type="button"
                    aria-label={p.name}
                    aria-pressed={active}
                    onClick={() => setSelectedPalette(p)}
                    className="flex flex-col items-center p-3 rounded-xl border border-slate-200 hover:shadow-sm transition-all focus:outline-none"
                  >
                    <div
                      className="w-10 h-10 rounded-full border-2 border-slate-300 mb-2 flex items-center justify-center shadow-inner"
                      style={{ backgroundColor: p.hex }}
                    >
                      {active && <Check size={20} className={p.hex === '#1E1E24' ? 'text-white' : 'text-slate-800'} />}
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleConfirm}
            className="w-full py-4 bg-gradient-to-r from-pink-600 to-rose-500 text-white font-extrabold text-lg rounded-2xl shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 hover:opacity-95"
          >
            Lanjut ke Kamera <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
