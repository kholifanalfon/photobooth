import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Layers,
  Plus,
  Copy,
  Trash2,
  Check,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Sparkles,
  Edit3,
  FileText,
  Search,
  Globe,
  Calendar
} from 'lucide-react';
import { PAPER_PRESETS, SLOT_PRESETS } from '../constants/framePresets.js';
import PrecisionFrameEditorModal from './PrecisionFrameEditorModal.jsx';
import { resolveApiUrl } from '../utils/apiConfig.js';

export default function FrameManagerModal({
  isOpen,
  onClose,
  config = {},
  onUpdateConfig,
  customFrames,
  events = [],
  onSaveFrames
}) {
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [isPrecisionModalOpen, setIsPrecisionModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmFrame, setDeleteConfirmFrame] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);

  const availableEvents = useMemo(() => {
    if (Array.isArray(events) && events.length > 0) {
      return events;
    }
    if (Array.isArray(config?.events) && config.events.length > 0) {
      return config.events;
    }
    return [];
  }, [events, config?.events]);

  const rawFrames = useMemo(() => {
    let sourceList = null;
    if (Array.isArray(customFrames) && customFrames.length > 0) {
      sourceList = customFrames;
    } else if (Array.isArray(config?.customFrames) && config.customFrames.length > 0) {
      sourceList = config.customFrames;
    }

    if (sourceList && sourceList.length > 0) {
      return sourceList.map((f) => ({
        ...f,
        isGlobal: f.isGlobal !== false,
        assignedEventIds: Array.isArray(f.assignedEventIds) ? f.assignedEventIds : []
      }));
    }

    const fallbackFrame = config?.customFrame || {
      id: 'frame-1',
      name: 'Frame 1 (4R)',
      enabled: true,
      imageUrl: '',
      orientation: 'portrait',
      paperSize: '4R',
      width: 1200,
      height: 1800,
      slots: (SLOT_PRESETS[4]?.portrait || []).map((s) => ({ ...s }))
    };

    return [
      {
        ...fallbackFrame,
        isGlobal: fallbackFrame.isGlobal !== false,
        assignedEventIds: Array.isArray(fallbackFrame.assignedEventIds)
          ? fallbackFrame.assignedEventIds
          : []
      }
    ];
  }, [customFrames, config?.customFrames, config?.customFrame]);

  const filteredFrames = useMemo(() => {
    if (!searchQuery.trim()) return rawFrames;
    const q = searchQuery.toLowerCase();
    return rawFrames.filter((f) => {
      const matchName = (f?.name || '').toLowerCase().includes(q);
      const matchEvent = (f?.assignedEventIds || []).some((evId) => {
        const ev = availableEvents.find((e) => e.id === evId);
        return ev && (ev.name || '').toLowerCase().includes(q);
      });
      return matchName || matchEvent;
    });
  }, [rawFrames, searchQuery, availableEvents]);

  const activeCount = useMemo(() => {
    return rawFrames.filter((f) => f && f.enabled).length;
  }, [rawFrames]);

  const safeFrameIndex = Math.min(
    Math.max(0, selectedFrameIndex),
    Math.max(0, rawFrames.length - 1)
  );
  const currentEditingFrame = rawFrames[safeFrameIndex] || rawFrames[0];

  const emitChanges = (updated) => {
    const activeFrame = updated.find((f) => f.enabled) || updated[0];
    if (typeof onUpdateConfig === 'function') {
      onUpdateConfig({
        customFrames: updated,
        customFrame: activeFrame
      });
    }
    if (typeof onSaveFrames === 'function') {
      onSaveFrames(updated);
    }
  };

  const updateFrameAtIndex = (idxToUpdate, patch) => {
    const updated = rawFrames.map((f, idx) => {
      if (idx === idxToUpdate) {
        return { ...f, ...patch };
      }
      return f;
    });
    emitChanges(updated);
  };

  const handleAddNewFrame = () => {
    const newId = `frame-${Date.now()}`;
    const newName = `Frame ${rawFrames.length + 1}`;
    const newFrame = {
      id: newId,
      name: newName,
      enabled: true,
      isGlobal: true,
      assignedEventIds: [],
      imageUrl: '',
      orientation: 'portrait',
      paperSize: '4R',
      width: 1200,
      height: 1800,
      slots: (SLOT_PRESETS[4]?.portrait || []).map((s) => ({ ...s }))
    };
    const updated = [...rawFrames, newFrame];
    setSelectedFrameIndex(rawFrames.length);
    emitChanges(updated);
  };

  const handleDuplicateFrame = (indexToDup) => {
    const source = rawFrames[indexToDup] || currentEditingFrame;
    const newId = `frame-${Date.now()}`;
    const newFrame = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      name: `${source.name || 'Frame'} (Salinan)`,
      enabled: true,
      isGlobal: source.isGlobal !== false,
      assignedEventIds: Array.isArray(source.assignedEventIds) ? [...source.assignedEventIds] : []
    };
    const updated = [...rawFrames, newFrame];
    setSelectedFrameIndex(rawFrames.length);
    emitChanges(updated);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmFrame) return;
    const indexToRemove = rawFrames.findIndex((f) => f.id === deleteConfirmFrame.id);
    if (indexToRemove === -1 || rawFrames.length <= 1) {
      setDeleteConfirmFrame(null);
      return;
    }

    const frameToDelete = rawFrames[indexToRemove];
    const updated = rawFrames.filter((_, idx) => idx !== indexToRemove);
    const nextIdx = Math.max(0, indexToRemove - 1);
    setSelectedFrameIndex(nextIdx);

    emitChanges(updated);

    // Delete frame file from server if it was an uploaded file
    if (
      frameToDelete?.imageUrl &&
      (frameToDelete.imageUrl.includes('/uploads/') || frameToDelete.imageUrl.startsWith('frame_'))
    ) {
      try {
        const endpoint = resolveApiUrl('/api/config/frame');
        await fetch(endpoint, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frameId: frameToDelete.id,
            imageUrl: frameToDelete.imageUrl
          })
        });
      } catch (err) {
        console.warn('Failed to delete frame file from server:', err);
      }
    }

    setDeleteConfirmFrame(null);
  };

  const handleUploadFrameFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('video', file); // Endpoint accepts 'video' field with category=frames
      formData.append('category', 'frames');

      const endpoint = resolveApiUrl('/api/photos/upload-video?category=frames');
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success && (data.videoUrl || data.mediaUrl)) {
        const frameUrl = data.videoUrl || data.mediaUrl;
        const img = new Image();
        img.onload = () => {
          const naturalW = img.naturalWidth || 1200;
          const naturalH = img.naturalHeight || 1800;
          const isLand = naturalW > naturalH;
          const isStandard4R =
            (naturalW === 1200 && naturalH === 1800) || (naturalW === 1800 && naturalH === 1200);

          const newId = `frame-${Date.now()}`;
          const cleanName =
            file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ') || `Frame ${rawFrames.length + 1}`;

          const newFrame = {
            id: newId,
            name: cleanName,
            enabled: true,
            isGlobal: true,
            assignedEventIds: [],
            imageUrl: frameUrl,
            orientation: isLand ? 'landscape' : 'portrait',
            paperSize: isStandard4R ? '4R' : 'image',
            width: naturalW,
            height: naturalH,
            slots: (SLOT_PRESETS[4]?.[isLand ? 'landscape' : 'portrait'] || []).map((s) => ({ ...s }))
          };

          const updated = [...rawFrames, newFrame];
          setSelectedFrameIndex(rawFrames.length);
          emitChanges(updated);
          setIsUploading(false);
          setIsPrecisionModalOpen(true);
        };
        img.onerror = () => {
          setIsUploading(false);
        };
        img.src = resolveApiUrl(frameUrl);
      } else {
        setIsUploading(false);
      }
    } catch (err) {
      console.error('Failed to upload frame file:', err);
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openEditorForFrame = (frameId) => {
    const idx = rawFrames.findIndex((f) => f.id === frameId);
    if (idx !== -1) {
      setSelectedFrameIndex(idx);
      setIsPrecisionModalOpen(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="frame-manager-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-4 select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl h-[92vh] max-h-[92vh] shadow-2xl overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER: Identik dengan tema gelap SessionManagerModal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center shadow-md shadow-rose-500/20 text-white shrink-0">
              <Layers size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="frame-manager-title" className="text-base sm:text-lg font-bold text-white">
                  Kelola Desain Frame Photobooth
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {rawFrames.length} Desain
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Katalog frame, upload desain, ukuran kertas, dan pemetaan slot foto untuk tamu.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Input file upload tersembunyi */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".png,.jpg,.jpeg,.webp"
              onChange={handleUploadFrameFile}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
            >
              <Upload size={14} />
              <span className="hidden sm:inline">
                {isUploading ? 'Mengunggah...' : 'Upload Gambar Frame'}
              </span>
              <span className="sm:hidden">Upload</span>
            </button>

            <button
              type="button"
              onClick={handleAddNewFrame}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Tambah Frame</span>
              <span className="sm:hidden">Tambah</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Dialog Kelola Frame"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-all cursor-pointer ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* TOOLBAR: Filter Status & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-b border-slate-800/80 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-300 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1 rounded-lg">
              Total {rawFrames.length} Desain
            </span>
            <span className="font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span>{activeCount} Aktif untuk Tamu</span>
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama frame..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* FRAME CARDS GRID CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-900">
          {filteredFrames.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3 text-center px-4">
              <ImageIcon size={44} className="text-slate-600" />
              <div>
                <p className="text-base font-bold text-slate-300">Tidak Ada Frame yang Cocok</p>
                <p className="text-xs text-slate-500 mt-1">
                  {searchQuery ? 'Coba ubah kata kunci pencarian Anda.' : 'Mulai dengan menambahkan atau mengunggah frame baru.'}
                </p>
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-rose-400 cursor-pointer"
                >
                  Reset Pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredFrames.map((f, idx) => {
                const globalIndex = rawFrames.findIndex((rf) => rf.id === f.id);
                const isSelected = globalIndex === safeFrameIndex;
                const slotCount = Array.isArray(f.slots) ? f.slots.length : 0;
                const isOrientLandscape = f.orientation === 'landscape';
                const paperKey = f.paperSize || '4R';
                const paperPreset = PAPER_PRESETS[paperKey] || PAPER_PRESETS['4R'];

                const isImageSize =
                  f.paperSize === 'image' ||
                  (Number(f.width) > 0 &&
                    Number(f.height) > 0 &&
                    f.paperSize !== '4R' &&
                    f.paperSize !== '3x5cm' &&
                    f.paperSize !== '5x5cm' &&
                    (Number(f.width) !== 1200 || Number(f.height) !== 1800) &&
                    (Number(f.width) !== 1800 || Number(f.height) !== 1200));

                let frameW = f.orientation === 'landscape' ? 1800 : 1200;
                let frameH = f.orientation === 'landscape' ? 1200 : 1800;

                if (Number(f.width) > 0 && Number(f.height) > 0) {
                  const rawW = Number(f.width);
                  const rawH = Number(f.height);
                  if (isImageSize || paperPreset.hasOrientation === false || rawW === rawH) {
                    frameW = rawW;
                    frameH = rawH;
                  } else if (f.orientation === 'landscape') {
                    frameW = Math.max(rawW, rawH);
                    frameH = Math.min(rawW, rawH);
                  } else {
                    frameW = Math.min(rawW, rawH);
                    frameH = Math.max(rawW, rawH);
                  }
                } else if (paperPreset && paperPreset.id !== 'image') {
                  const isLand = paperPreset.hasOrientation && f.orientation === 'landscape';
                  frameW = isLand ? paperPreset.landscape.width : paperPreset.portrait.width;
                  frameH = isLand ? paperPreset.landscape.height : paperPreset.portrait.height;
                }

                const isSquare = frameW === frameH;
                const paperBadgeLabel = (() => {
                  if (isImageSize) {
                    if (isSquare) return 'Ukuran Frame (Kotak)';
                    return `Ukuran Frame ${isOrientLandscape ? 'Landscape' : 'Portrait'}`;
                  }
                  if (f.paperSize === '5x5cm') return '5×5 cm';
                  if (f.paperSize === '3x5cm') return `3×5 cm ${isOrientLandscape ? 'Landscape' : 'Portrait'}`;
                  return `4R ${isOrientLandscape ? 'Landscape' : 'Portrait'}`;
                })();

                const isGlobal = f.isGlobal !== false;
                const assignedCount = Array.isArray(f.assignedEventIds) ? f.assignedEventIds.length : 0;

                return (
                  <motion.div
                    key={`fman-frame-${f.id || 'custom'}-${idx}`}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(idx * 0.03, 0.25) }}
                    className={`flex flex-col bg-slate-800/80 hover:bg-slate-800 border rounded-2xl overflow-hidden shadow-md transition-all group ${
                      isSelected
                        ? 'border-rose-500 ring-1 ring-rose-500/40 bg-slate-800'
                        : f.enabled
                        ? 'border-slate-700/80 hover:border-slate-600'
                        : 'border-slate-800 opacity-70 hover:opacity-100 bg-slate-900/60'
                    }`}
                  >
                    {/* Compact Visual Canvas Thumbnail dengan explicit height dan aspect-ratio */}
                    <div
                      onClick={() => openEditorForFrame(f.id)}
                      className="relative w-full h-36 sm:h-40 bg-slate-950 flex items-center justify-center p-2.5 cursor-pointer group/thumb overflow-hidden select-none"
                    >
                      {/* Frame Container with strict dynamic aspect ratio and explicit height */}
                      <div
                        style={{
                          aspectRatio: `${frameW} / ${frameH}`,
                          height: '100%',
                          maxHeight: '100%',
                          maxWidth: '100%'
                        }}
                        className="relative rounded-md overflow-hidden border border-slate-700/80 shadow-md bg-slate-900 flex items-center justify-center transition-transform group-hover/thumb:scale-105"
                      >
                        {/* Background custom frame image with resolveApiUrl & fallback */}
                        {f.imageUrl ? (
                          <img
                            src={resolveApiUrl(f.imageUrl)}
                            alt={f.name || 'Frame'}
                            className="w-full h-full object-contain pointer-events-none z-10"
                            onError={(e) => {
                              console.warn('Frame image failed to load:', f.imageUrl);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-800/80 flex items-center justify-center pointer-events-none">
                            <span className="text-[9px] text-slate-400 font-mono">Frame Bawaan</span>
                          </div>
                        )}

                        {/* Slot boxes rendering */}
                        <div className="absolute inset-0 pointer-events-none z-20">
                          {(f.slots || []).map((slot, sIdx) => {
                            const leftPct = (slot.x / frameW) * 100;
                            const topPct = (slot.y / frameH) * 100;
                            const widthPct = (slot.width / frameW) * 100;
                            const heightPct = (slot.height / frameH) * 100;
                            return (
                              <div
                                key={`fman-slot-${f.id || 'f'}-${slot.id !== undefined && slot.id !== null ? slot.id : sIdx}-${sIdx}`}
                                style={{
                                  left: `${leftPct}%`,
                                  top: `${topPct}%`,
                                  width: `${widthPct}%`,
                                  height: `${heightPct}%`
                                }}
                                className="absolute border border-rose-400/90 bg-rose-500/25 flex items-center justify-center"
                              >
                                <span className="text-[8px] font-bold text-white bg-rose-600/90 px-1 rounded-xs shadow-xs">
                                  {sIdx + 1}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Status dot in thumbnail corner */}
                      <span
                        className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border border-slate-900 z-30 ${
                          f.enabled ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50' : 'bg-slate-600'
                        }`}
                        title={f.enabled ? 'Frame Aktif untuk Tamu' : 'Frame Nonaktif'}
                      />

                      {/* Hover Overlay CTA */}
                      <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-bold text-xs pointer-events-none z-40">
                        <Sliders size={14} className="text-rose-400" />
                        <span>Klik untuk Atur Slot</span>
                      </div>
                    </div>

                    {/* Compact Details & Meta Area */}
                    <div className="p-3 space-y-2.5 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        {/* Editable Name Input */}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={f.name || ''}
                            onChange={(e) => updateFrameAtIndex(globalIndex, { name: e.target.value })}
                            placeholder="Nama Desain Frame"
                            className="w-full text-xs font-bold text-white bg-slate-900/60 hover:bg-slate-900 focus:bg-slate-900 border border-slate-700/60 focus:border-rose-500 rounded-lg px-2 py-1 outline-none transition-colors"
                          />
                          <Edit3 size={12} className="text-slate-500 shrink-0 pointer-events-none" />
                        </div>

                        {/* Badges: Paper size, Slot count, Dimensions, and Global/Event assignment */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="font-semibold bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <FileText size={10} className="text-slate-400" />
                            <span>{paperBadgeLabel}</span>
                          </span>
                          <span className="font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md">
                            {slotCount} Slot Foto
                          </span>
                          <span className="font-mono text-slate-400">
                            {frameW} × {frameH} px
                          </span>

                          {/* Event Assignment Badge */}
                          {isGlobal ? (
                            <span
                              className="font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md flex items-center gap-1"
                              title="Tersedia untuk Semua Event (Global)"
                            >
                              <Globe size={10} className="text-indigo-400" />
                              <span>Global</span>
                            </span>
                          ) : (
                            <span
                              className="font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1"
                              title={`Ditugaskan ke ${assignedCount} Event`}
                            >
                              <Calendar size={10} className="text-amber-400" />
                              <span>{assignedCount} Event</span>
                            </span>
                          )}
                        </div>

                        {/* Penugasan Event / Global Event toggle */}
                        <div className="pt-2 border-t border-slate-700/50 space-y-2 text-[11px]">
                          <div className="flex items-center justify-between">
                            <label className="font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isGlobal}
                                onChange={(e) => {
                                  const nextGlobal = e.target.checked;
                                  updateFrameAtIndex(globalIndex, {
                                    isGlobal: nextGlobal,
                                    assignedEventIds: Array.isArray(f.assignedEventIds) ? f.assignedEventIds : []
                                  });
                                }}
                                className="w-3.5 h-3.5 accent-rose-500 cursor-pointer rounded"
                              />
                              <span>Tersedia untuk Semua Event (Global)</span>
                            </label>
                            {isGlobal && (
                              <span className="text-[10px] font-semibold text-indigo-400 flex items-center gap-1 shrink-0">
                                <Globe size={11} />
                                <span>Semua Event</span>
                              </span>
                            )}
                          </div>

                          {/* When not global: show event checklist */}
                          {!isGlobal && (
                            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/70 space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Calendar size={11} className="text-amber-400" />
                                  <span>Penugasan Event:</span>
                                </span>
                                <span className="text-amber-300">
                                  {assignedCount} dipilih
                                </span>
                              </div>

                              {availableEvents.length === 0 ? (
                                <p className="text-[10px] text-slate-500 italic py-1">
                                  Belum ada event terdaftar. Frame tidak akan muncul di event manapun sampai event ditugaskan.
                                </p>
                              ) : (
                                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                                  {availableEvents.map((ev) => {
                                    const isAssigned = (f.assignedEventIds || []).includes(ev.id);
                                    return (
                                      <label
                                        key={ev.id}
                                        className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-slate-800/80 cursor-pointer text-slate-300 hover:text-white transition-colors"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isAssigned}
                                          onChange={(e) => {
                                            const currentAssigned = Array.isArray(f.assignedEventIds)
                                              ? f.assignedEventIds
                                              : [];
                                            const nextAssigned = e.target.checked
                                              ? [...currentAssigned, ev.id]
                                              : currentAssigned.filter((id) => id !== ev.id);
                                            updateFrameAtIndex(globalIndex, { assignedEventIds: nextAssigned });
                                          }}
                                          className="w-3.5 h-3.5 accent-rose-500 rounded cursor-pointer"
                                        />
                                        <span className="truncate text-[11px]">{ev.name || ev.id}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Toggle: Aktif untuk Tamu */}
                      <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px]">
                        <label className="font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(f.enabled)}
                            onChange={(e) => updateFrameAtIndex(globalIndex, { enabled: e.target.checked })}
                            className="w-3.5 h-3.5 accent-rose-500 cursor-pointer rounded"
                          />
                          <span>{f.enabled ? 'Aktif untuk Tamu' : 'Nonaktif (Disembunyikan)'}</span>
                        </label>
                        {f.enabled && (
                          <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            <span>Aktif</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Compact Action Buttons */}
                    <div className="p-2 bg-slate-900/70 border-t border-slate-700/60 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditorForFrame(f.id)}
                        className="flex-1 py-1.5 px-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
                      >
                        <Sliders size={13} />
                        <span>Atur Slot Foto</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateFrame(globalIndex)}
                        title="Duplikat Frame"
                        className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-lg transition-colors cursor-pointer shadow-xs"
                      >
                        <Copy size={13} />
                      </button>

                      {rawFrames.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmFrame(f)}
                          title="Hapus Frame"
                          className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors cursor-pointer shadow-xs"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER: Identik dengan tema gelap SessionManagerModal */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div>
            Perubahan nama, status aktif, dan penugasan event frame tersimpan secara otomatis.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Selesai
          </button>
        </div>
      </motion.div>

      {/* Precision Frame Editor Modal Integration */}
      <PrecisionFrameEditorModal
        isOpen={isPrecisionModalOpen}
        onClose={() => setIsPrecisionModalOpen(false)}
        customFrame={currentEditingFrame}
        onUpdateFrame={(patch) => {
          updateFrameAtIndex(safeFrameIndex, patch);
        }}
        frameName={currentEditingFrame?.name || `Frame #${safeFrameIndex + 1}`}
      />

      {/* Delete Confirmation Modal (Dark Theme) */}
      <AnimatePresence>
        {deleteConfirmFrame && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-800 text-center space-y-4 text-white"
            >
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
                <Trash2 size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-white">Hapus Desain Frame?</h3>
                <p className="text-xs text-slate-400">
                  Frame <strong className="text-slate-200">"{deleteConfirmFrame.name}"</strong> akan dihapus dari sistem beserta file gambarnya.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmFrame(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer shadow-xs"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
