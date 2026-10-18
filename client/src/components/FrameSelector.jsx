import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Image as ImageIcon } from 'lucide-react';
import { FRAME_CONFIGS } from '../utils/canvasCompositor.js';

export const PALETTES = [
  { name: 'Pure White', hex: '#FFFFFF', text: '#1e293b' },
  { name: 'Midnight Black', hex: '#1E1E24', text: '#FFFFFF' },
  { name: 'Pastel Pink', hex: '#FFE4E6', text: '#881337' },
  { name: 'Sky Lavender', hex: '#E0E7FF', text: '#312E81' },
  { name: 'Mint Soft', hex: '#D1FAE5', text: '#064E3B' },
  { name: 'Warm Cream', hex: '#FEF3C7', text: '#78350F' }
];

export default function FrameSelector({ onConfirm, onBack, availableCustomFrames = [] }) {
  const hasCustomFrames = Array.isArray(availableCustomFrames) && availableCustomFrames.length > 0;
  const [selectedCustomFrameId, setSelectedCustomFrameId] = useState(
    hasCustomFrames ? (availableCustomFrames[0]?.id || '') : ''
  );
  const [selectedLayout, setSelectedLayout] = useState('STRIP_3');
  const [selectedPalette, setSelectedPalette] = useState(PALETTES[0]);

  const layouts = Object.entries(FRAME_CONFIGS);

  const handleConfirm = () => {
    if (typeof onConfirm !== 'function') return;

    if (hasCustomFrames) {
      const chosen = availableCustomFrames.find((f) => f.id === selectedCustomFrameId) || availableCustomFrames[0];
      if (chosen) {
        const uniqueSlotsPhotoCount = Array.isArray(chosen.slots) && chosen.slots.length > 0
          ? Math.max(...chosen.slots.map((s, idx) => Number(s.photoIndex ?? idx))) + 1
          : 4;
        const effectivePhotoCount = Number(chosen.photoCount) > 0
          ? Number(chosen.photoCount)
          : uniqueSlotsPhotoCount;

        onConfirm({
          layoutType: 'CUSTOM_4R',
          customFrame: chosen,
          photoCount: effectivePhotoCount,
          frameColor: '#FFFFFF'
        });
        return;
      }
    }

    onConfirm({
      layoutType: selectedLayout,
      palette: selectedPalette,
      frameColor: selectedPalette.hex
    });
  };

  /**
   * Helper to render accurate layout thumbnail according to layout type and selected frame color (legacy fallback)
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
    <div className="relative flex flex-col h-full h-[100dvh] max-h-[100dvh] w-full bg-slate-50 text-slate-900 select-none overflow-hidden">
      {/* Header */}
      <div className="flex flex-col items-center justify-center max-w-4xl mx-auto w-full pt-3 sm:pt-5 pb-1 px-4 shrink-0 gap-1">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 text-center tracking-tight">
          {hasCustomFrames ? 'Pilih Desain Frame Foto' : 'Pilih Template & Warna Frame'}
        </h2>

        {hasCustomFrames && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
              Desain Acara ({availableCustomFrames.length})
            </span>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Sentuh frame pilihanmu untuk memulai sesi foto
            </p>
          </div>
        )}
      </div>

      {/* Main Content (Center) */}
      {hasCustomFrames ? (
        <div className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-2 overflow-y-auto custom-scrollbar min-h-0 pb-28 sm:pb-32 overscroll-contain">
          <div
            className={`grid gap-2.5 sm:gap-5 justify-center items-start w-full mx-auto ${
              availableCustomFrames.length === 1
                ? 'grid-cols-1 max-w-[240px] sm:max-w-xs'
                : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-3xl'
            }`}
          >
            {availableCustomFrames.map((f, idx) => {
              const isSelected = f.id === selectedCustomFrameId || (!selectedCustomFrameId && idx === 0);
              const isLandscape = f.orientation === 'landscape';
              const frameWidth = isLandscape ? (f.width || 1800) : (f.width || 1200);
              const frameHeight = isLandscape ? (f.height || 1200) : (f.height || 1800);
              const slots = Array.isArray(f.slots) ? f.slots : [];
              const slotCount = slots.length;
              const uniqueSlotsPhotoCount = slots.length > 0
                ? Math.max(...slots.map((s, sIdx) => Number(s.photoIndex ?? sIdx))) + 1
                : 4;
              const photoCount = Number(f.photoCount) > 0 ? Number(f.photoCount) : uniqueSlotsPhotoCount;

              return (
                <div
                  key={f.id || idx}
                  role="button"
                  tabIndex={0}
                  aria-label={f.name || `Frame ${idx + 1}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedCustomFrameId(f.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCustomFrameId(f.id);
                    }
                  }}
                  className={`cursor-pointer rounded-xl sm:rounded-2xl border-2 transition-all duration-200 flex flex-col items-center text-center p-2 sm:p-3 bg-white relative active:scale-98 ${
                    isSelected
                      ? 'border-rose-500 bg-rose-50/70 shadow-lg ring-2 sm:ring-4 ring-rose-400/25'
                      : 'border-slate-200 hover:border-rose-300 hover:shadow-md bg-white shadow-xs'
                  }`}
                >
                  {/* Thumbnail Container */}
                  <div
                    className={`w-full ${
                      isLandscape ? 'aspect-[3/2]' : 'aspect-[2/3]'
                    } max-h-[38vh] sm:max-h-[46vh] rounded-lg sm:rounded-xl overflow-hidden border border-slate-300/80 bg-slate-900 relative shadow-inner flex items-center justify-center`}
                  >
                    {/* Background frame image (Supports Anti-Stretch, Custom Position & Mirror) */}
                    {f.imageUrl && f.layerMode !== 'overlay' && (
                      <div className="absolute inset-0 w-full h-full pointer-events-none select-none z-0">
                        <img
                          src={f.imageUrl}
                          alt={f.name || `Frame ${idx + 1}`}
                          style={{
                            position: 'absolute',
                            left: `${((Number(f.imageX) || 0) / frameWidth) * 100}%`,
                            top: `${((Number(f.imageY) || 0) / frameHeight) * 100}%`,
                            width: `${((Number(f.imageWidth) || (f.imageMirror ? frameWidth / 2 : frameWidth)) / frameWidth) * 100}%`,
                            height: `${((Number(f.imageHeight) || frameHeight) / frameHeight) * 100}%`
                          }}
                          className="object-contain"
                        />
                        {f.imageMirror && (
                          <img
                            src={f.imageUrl}
                            alt={`${f.name || 'Frame'} Mirror`}
                            style={{
                              position: 'absolute',
                              left: `${((f.mirrorImageX !== undefined ? Number(f.mirrorImageX) : frameWidth / 2) / frameWidth) * 100}%`,
                              top: `${((Number(f.mirrorImageY) || 0) / frameHeight) * 100}%`,
                              width: `${((Number(f.mirrorImageWidth) || frameWidth / 2) / frameWidth) * 100}%`,
                              height: `${((Number(f.mirrorImageHeight) || frameHeight) / frameHeight) * 100}%`,
                              transform: f.mirrorImageFlip ? 'scaleX(-1)' : 'none'
                            }}
                            className="object-contain"
                          />
                        )}
                      </div>
                    )}

                    {/* Mapped Slot Rectangles Visual Overlay */}
                    <div className="absolute inset-0 w-full h-full z-10 pointer-events-none">
                      {slots.map((s, sIdx) => {
                        const leftPct = (Number(s.x) / frameWidth) * 100;
                        const topPct = (Number(s.y) / frameHeight) * 100;
                        const widthPct = (Number(s.width) / frameWidth) * 100;
                        const heightPct = (Number(s.height) / frameHeight) * 100;
                        const radiusPct = ((Number(s.radius) || 0) / frameWidth) * 100;

                        return (
                          <div
                            key={s.id || sIdx}
                            style={{
                              left: `${leftPct}%`,
                              top: `${topPct}%`,
                              width: `${widthPct}%`,
                              height: `${heightPct}%`,
                              borderRadius: `${radiusPct}%`
                            }}
                            className="absolute border border-white/70 bg-white/25 backdrop-blur-[1px] flex items-center justify-center shadow-2xs pointer-events-none"
                          >
                            <span className="text-[9px] sm:text-xs font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                              #{sIdx + 1}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Overlay frame image if layerMode is overlay */}
                    {f.imageUrl && f.layerMode === 'overlay' && (
                      <div className="absolute inset-0 w-full h-full pointer-events-none select-none z-20">
                        <img
                          src={f.imageUrl}
                          alt={f.name || `Frame ${idx + 1}`}
                          style={{
                            position: 'absolute',
                            left: `${((Number(f.imageX) || 0) / frameWidth) * 100}%`,
                            top: `${((Number(f.imageY) || 0) / frameHeight) * 100}%`,
                            width: `${((Number(f.imageWidth) || (f.imageMirror ? frameWidth / 2 : frameWidth)) / frameWidth) * 100}%`,
                            height: `${((Number(f.imageHeight) || frameHeight) / frameHeight) * 100}%`
                          }}
                          className="object-contain"
                        />
                        {f.imageMirror && (
                          <img
                            src={f.imageUrl}
                            alt={`${f.name || 'Frame'} Mirror`}
                            style={{
                              position: 'absolute',
                              left: `${((f.mirrorImageX !== undefined ? Number(f.mirrorImageX) : frameWidth / 2) / frameWidth) * 100}%`,
                              top: `${((Number(f.mirrorImageY) || 0) / frameHeight) * 100}%`,
                              width: `${((Number(f.mirrorImageWidth) || frameWidth / 2) / frameWidth) * 100}%`,
                              height: `${((Number(f.mirrorImageHeight) || frameHeight) / frameHeight) * 100}%`,
                              transform: f.mirrorImageFlip ? 'scaleX(-1)' : 'none'
                            }}
                            className="object-contain"
                          />
                        )}
                      </div>
                    )}

                    {/* Fallback placeholder if no image and no slots */}
                    {!f.imageUrl && slots.length === 0 && (
                      <div className="flex flex-col items-center justify-center text-slate-400 p-2">
                        <ImageIcon size={28} className="opacity-60" />
                        <span className="text-[10px] font-bold mt-1 text-slate-300">Frame Kosong</span>
                      </div>
                    )}

                    {/* Selection Checkmark Badge */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg ring-2 ring-white z-30">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}
                  </div>

                  {/* Frame Details & Badges */}
                  <div className="w-full mt-2 sm:mt-2.5 space-y-0.5 sm:space-y-1">
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                      {f.name || `Frame #${idx + 1}`}
                    </h4>
                    <div className="flex items-center justify-center gap-1 text-[11px] text-slate-600 font-semibold flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[9px] sm:text-[10px] text-slate-700 font-bold">
                        4R {isLandscape ? 'Landscape' : 'Portrait'} • {slotCount > photoCount ? `${slotCount} Slot (${photoCount}x Foto)` : `${slotCount} Foto`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 items-center my-auto px-4 p-1">
          {/* Legacy Layout Options */}
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
                      onClick={() => setSelectedPalette(p)}
                      className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        active
                          ? 'border-rose-500 ring-2 ring-rose-400/40 shadow-xs scale-[1.02]'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center shadow-2xs"
                        style={{ backgroundColor: p.hex }}
                      >
                        {active && (
                          <Check
                            size={14}
                            className={p.hex === '#1E1E24' ? 'text-white' : 'text-slate-800'}
                          />
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 sm:py-4">
        <div className="max-w-md mx-auto w-full flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Kembali"
            className="w-1/3 py-2.5 sm:py-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} /> Kembali
          </button>
          <button
            type="button"
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
