import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Check,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Eye,
  EyeOff,
  Move,
  Sliders,
  Copy,
  Plus,
  Trash2,
  Crosshair,
  Layers,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ImageIcon,
  Upload,
  Loader2,
  Sparkles,
  Camera,
  FlipHorizontal,
  Columns,
  MoveHorizontal,
  ClipboardPaste,
  LayoutGrid,
  FileText,
  ChevronDown
} from 'lucide-react';
import { SLOT_PRESETS, SAMPLE_PLACEHOLDER_PHOTOS, resolveSlotsPhotoMapping,
  PAPER_PRESETS
} from '../constants/framePresets.js';
import { uploadDirectMedia } from '../utils/chunkUploader.js';

export default function PrecisionFrameEditorModal({
  isOpen,
  onClose,
  customFrame,
  onUpdateFrame,
  frameName = ""
}) {
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const MIN_ZOOM = 50;
  const MAX_ZOOM = 800; // Mendukung perbesaran presisi ultra hingga 800%
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState('standard'); // 'standard' (50px), 'dense' (20px), 'thirds' (3x3)
  const [showPlaceholders, setShowPlaceholders] = useState(true);
  const [frameOpacity, setFrameOpacity] = useState(70);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);
  const [activeEditorMode, setActiveEditorMode] = useState("slots"); // "slots" | "image"
  const [selectedImageTarget, setSelectedImageTarget] = useState("main"); // "main" | "mirror"
  const [sidebarTab, setSidebarTab] = useState("frame"); // "frame" | "slots"
  const [isPaperDropdownOpen, setIsPaperDropdownOpen] = useState(false);
  const paperDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (paperDropdownRef.current && !paperDropdownRef.current.contains(e.target)) {
        setIsPaperDropdownOpen(false);
      }
    };
    if (isPaperDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isPaperDropdownOpen]);

  const getApiBase = () => {
    if (typeof window !== "undefined") {
      const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (isLocalHost && window.location.port && !["5000", "5025"].includes(window.location.port)) {
        return import.meta.env?.VITE_API_BASE_URL || "";
      }
    }
    return "";
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('File harus berupa gambar (PNG, JPG, atau WebP)');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      const res = await uploadDirectMedia(file, { apiBase: getApiBase(), category: "frames" });
      const uploadedUrl = res?.relativeUrl || res?.url || res?.videoUrl || (res?.filename ? `/uploads/${res.filename}` : null);
      if (uploadedUrl) {
        // Probe image natural dimensions to avoid stretch and auto-detect 1-strip
        let naturalW = 0;
        let naturalH = 0;
        if (typeof window !== "undefined" && typeof window.Image !== "undefined") {
          try {
            const probeImg = new window.Image();
            await new Promise((resolve) => {
              probeImg.onload = () => {
                naturalW = probeImg.naturalWidth;
                naturalH = probeImg.naturalHeight;
                resolve();
              };
              probeImg.onerror = () => resolve();
              probeImg.src = uploadedUrl;
            });
          } catch (_) {}
        }

        const isNarrowRatio = naturalW > 0 && naturalH > 0 && (naturalW / naturalH) < 0.55;
        const shouldMatchImage = (customFrame?.paperSize === 'image');
        const nextCanvasW = shouldMatchImage && naturalW > 0 ? naturalW : canvasW;
        const nextCanvasH = shouldMatchImage && naturalH > 0 ? naturalH : canvasH;

        let updatedSlots = activeSlots;
        if (shouldMatchImage && naturalW > 0 && naturalH > 0 && (naturalW !== canvasW || naturalH !== canvasH)) {
          const scaleX = naturalW / canvasW;
          const scaleY = naturalH / canvasH;
          updatedSlots = activeSlots.map((s) => ({
            ...s,
            x: Math.round(s.x * scaleX),
            y: Math.round(s.y * scaleY),
            width: Math.max(10, Math.round(s.width * scaleX)),
            height: Math.max(10, Math.round(s.height * scaleY)),
            radius: Math.max(0, Math.round((s.radius || 0) * Math.min(scaleX, scaleY))),
            borderWidth: Math.max(0, Math.round((s.borderWidth || 0) * Math.min(scaleX, scaleY)))
          }));
          commitSlots(updatedSlots, true);
        }

        const targetW = isNarrowRatio ? Math.round(nextCanvasW / 2) : nextCanvasW;

        onUpdateFrame({
          imageUrl: uploadedUrl,
          frameNaturalWidth: naturalW,
          frameNaturalHeight: naturalH,
          width: nextCanvasW,
          height: nextCanvasH,
          orientation: shouldMatchImage
            ? (naturalW >= naturalH ? 'landscape' : 'portrait')
            : (customFrame?.orientation || 'portrait'),
          slots: updatedSlots,
          layerMode: file.type.includes("png") ? "overlay" : "background",
          imageX: 0,
          imageY: 0,
          imageWidth: targetW,
          imageHeight: nextCanvasH,
          imageMirror: isNarrowRatio,
          mirrorImageX: isNarrowRatio ? (nextCanvasW - targetW) : 0,
          mirrorImageY: 0,
          mirrorImageWidth: targetW,
          mirrorImageHeight: nextCanvasH,
          mirrorImageFlip: false
        });
      } else {
        throw new Error('Gagal mengunggah file frame');
      }
    } catch (err) {
      console.error('Upload frame error in modal:', err);
      setUploadError(err.message || 'Gagal mengunggah gambar frame');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };


  const canvasViewportRef = useRef(null);
  const canvasBoxRef = useRef(null);
  const [clipboardSlot, setClipboardSlot] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const dragInfoRef = useRef(null);
  const resizeInfoRef = useRef(null);

  const [localSlots, setLocalSlots] = useState(() => Array.isArray(customFrame?.slots) ? customFrame.slots : []);
  const latestSlotsRef = useRef(localSlots);
  latestSlotsRef.current = localSlots;

  useEffect(() => {
    if (!dragInfoRef.current && !resizeInfoRef.current) {
      const incoming = Array.isArray(customFrame?.slots) ? customFrame.slots : [];
      setLocalSlots(incoming);
      latestSlotsRef.current = incoming;
    }
  }, [customFrame?.slots]);

  const historyRef = useRef([JSON.parse(JSON.stringify(Array.isArray(customFrame?.slots) ? customFrame.slots : []))]);
  const historyIndexRef = useRef(0);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const dragStartSlotsRef = useRef(null);
  const resizeStartSlotsRef = useRef(null);

  const updateHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1
    });
  }, []);

  const pushHistory = useCallback((slotsSnapshot) => {
    const next = historyRef.current.slice(0, historyIndexRef.current + 1);
    next.push(JSON.parse(JSON.stringify(slotsSnapshot)));
    if (next.length > 50) {
      next.shift();
    } else {
      historyIndexRef.current += 1;
    }
    historyRef.current = next;
    updateHistoryState();
  }, [updateHistoryState]);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const prevSlots = JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current]));
      setLocalSlots(prevSlots);
      latestSlotsRef.current = prevSlots;
      onUpdateFrame({ slots: prevSlots });
      updateHistoryState();
    }
  }, [onUpdateFrame, updateHistoryState]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const nextSlots = JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current]));
      setLocalSlots(nextSlots);
      latestSlotsRef.current = nextSlots;
      onUpdateFrame({ slots: nextSlots });
      updateHistoryState();
    }
  }, [onUpdateFrame, updateHistoryState]);

  const commitSlots = useCallback((updated, recordHistory = true) => {
    setLocalSlots(updated);
    latestSlotsRef.current = updated;
    onUpdateFrame({ slots: updated });
    if (recordHistory) {
      pushHistory(updated);
    }
  }, [onUpdateFrame, pushHistory]);

  const activeSlots = localSlots;
  const currentPaperKey = customFrame?.paperSize || '4R';
  const paperPreset = PAPER_PRESETS[currentPaperKey] || PAPER_PRESETS['4R'];
  const isLandscape = paperPreset.id === 'image'
    ? (Number(customFrame?.width || 0) >= Number(customFrame?.height || 0) && Number(customFrame?.width || 0) > 0)
    : (paperPreset.hasOrientation && customFrame?.orientation === 'landscape');
  const defaultW = isLandscape ? paperPreset.landscape.width : paperPreset.portrait.width;
  const defaultH = isLandscape ? paperPreset.landscape.height : paperPreset.portrait.height;

  const canvasW = Number(customFrame?.width) > 0 ? Number(customFrame.width) : defaultW;
  const canvasH = Number(customFrame?.height) > 0 ? Number(customFrame.height) : defaultH;

  const handleOrientationChange = (newOrientation) => {
    if (newOrientation === (isLandscape ? 'landscape' : 'portrait')) return;
    if (!paperPreset.hasOrientation || paperPreset.id === 'image') return;

    const isNowLandscape = newOrientation === 'landscape';
    const newW = isNowLandscape ? paperPreset.landscape.width : paperPreset.portrait.width;
    const newH = isNowLandscape ? paperPreset.landscape.height : paperPreset.portrait.height;

    const oldW = canvasW;
    const oldH = canvasH;
    const scaleX = newW / oldW;
    const scaleY = newH / oldH;

    let updatedSlots;
    if (activeSlots.length > 0) {
      updatedSlots = activeSlots.map((s) => ({
        ...s,
        x: Math.round(s.x * scaleX),
        y: Math.round(s.y * scaleY),
        width: Math.max(10, Math.round(s.width * scaleX)),
        height: Math.max(10, Math.round(s.height * scaleY)),
        radius: Math.max(0, Math.round((s.radius || 0) * Math.min(scaleX, scaleY))),
        borderWidth: Math.max(0, Math.round((s.borderWidth || 0) * Math.min(scaleX, scaleY)))
      }));
    } else {
      const preset = SLOT_PRESETS[4];
      const newTemplate = isNowLandscape ? preset.landscape : preset.portrait;
      updatedSlots = newTemplate.map((s) => ({
        ...s,
        radius: 16,
        borderWidth: 0,
        borderColor: '#FFFFFF'
      }));
    }

    commitSlots(updatedSlots, true);

    onUpdateFrame({
      orientation: newOrientation,
      width: newW,
      height: newH,
      slots: updatedSlots,
      imageX: customFrame?.imageX !== undefined ? Math.round(Number(customFrame.imageX) * scaleX) : 0,
      imageY: customFrame?.imageY !== undefined ? Math.round(Number(customFrame.imageY) * scaleY) : 0,
      imageWidth: customFrame?.imageWidth !== undefined ? Math.round(Number(customFrame.imageWidth) * scaleX) : newW,
      imageHeight: customFrame?.imageHeight !== undefined ? Math.round(Number(customFrame.imageHeight) * scaleY) : newH
    });
    setSelectedSlotIndex(0);
  };

  const handlePaperSizeChange = async (newPaperSize) => {
    const currentPaper = customFrame?.paperSize || '4R';
    if (newPaperSize === currentPaper) return;

    if (newPaperSize === 'image') {
      let targetW = Number(customFrame?.frameNaturalWidth || 0);
      let targetH = Number(customFrame?.frameNaturalHeight || 0);

      if ((!targetW || !targetH) && customFrame?.imageUrl) {
        if (typeof window !== 'undefined' && typeof window.Image !== 'undefined') {
          try {
            const probe = new window.Image();
            await new Promise((resolve) => {
              probe.onload = () => {
                targetW = probe.naturalWidth;
                targetH = probe.naturalHeight;
                resolve();
              };
              probe.onerror = () => resolve();
              probe.src = customFrame.imageUrl;
            });
          } catch (_) {}
        }
      }

      if (targetW > 0 && targetH > 0) {
        const oldW = canvasW;
        const oldH = canvasH;
        const scaleX = targetW / oldW;
        const scaleY = targetH / oldH;

        const updatedSlots = activeSlots.map((s) => ({
          ...s,
          x: Math.round(s.x * scaleX),
          y: Math.round(s.y * scaleY),
          width: Math.max(10, Math.round(s.width * scaleX)),
          height: Math.max(10, Math.round(s.height * scaleY)),
          radius: Math.max(0, Math.round((s.radius || 0) * Math.min(scaleX, scaleY))),
          borderWidth: Math.max(0, Math.round((s.borderWidth || 0) * Math.min(scaleX, scaleY)))
        }));

        const targetOrient = targetW >= targetH ? 'landscape' : 'portrait';
        commitSlots(updatedSlots, true);

        onUpdateFrame({
          paperSize: 'image',
          frameNaturalWidth: targetW,
          frameNaturalHeight: targetH,
          orientation: targetOrient,
          width: targetW,
          height: targetH,
          slots: updatedSlots,
          imageX: 0,
          imageY: 0,
          imageWidth: targetW,
          imageHeight: targetH,
          imageMirror: false
        });
        setSelectedSlotIndex(0);
        setToastMessage(`Ukuran kertas diubah mengikuti gambar frame (${targetW} × ${targetH} px)`);
        setTimeout(() => setToastMessage(''), 2500);
        return;
      } else {
        onUpdateFrame({ paperSize: 'image' });
        setToastMessage('Silakan pilih file gambar desain frame untuk menyesuaikan ukuran kertas');
        setTimeout(() => setToastMessage(''), 3000);
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
        return;
      }
    }

    const newPreset = PAPER_PRESETS[newPaperSize] || PAPER_PRESETS['4R'];
    const targetOrientation = newPreset.hasOrientation && customFrame?.orientation === 'landscape' ? 'landscape' : 'portrait';
    const newW = targetOrientation === 'landscape' ? newPreset.landscape.width : newPreset.portrait.width;
    const newH = targetOrientation === 'landscape' ? newPreset.landscape.height : newPreset.portrait.height;

    const oldW = canvasW;
    const oldH = canvasH;
    const scaleX = newW / oldW;
    const scaleY = newH / oldH;

    const updatedSlots = activeSlots.map((s) => ({
      ...s,
      x: Math.round(s.x * scaleX),
      y: Math.round(s.y * scaleY),
      width: Math.max(10, Math.round(s.width * scaleX)),
      height: Math.max(10, Math.round(s.height * scaleY)),
      radius: Math.max(0, Math.round((s.radius || 0) * Math.min(scaleX, scaleY))),
      borderWidth: Math.max(0, Math.round((s.borderWidth || 0) * Math.min(scaleX, scaleY)))
    }));

    commitSlots(updatedSlots, true);

    onUpdateFrame({
      paperSize: newPaperSize,
      orientation: targetOrientation,
      width: newW,
      height: newH,
      slots: updatedSlots,
      imageX: customFrame?.imageX !== undefined ? Math.round(Number(customFrame.imageX) * scaleX) : 0,
      imageY: customFrame?.imageY !== undefined ? Math.round(Number(customFrame.imageY) * scaleY) : 0,
      imageWidth: customFrame?.imageWidth !== undefined ? Math.round(Number(customFrame.imageWidth) * scaleX) : newW,
      imageHeight: customFrame?.imageHeight !== undefined ? Math.round(Number(customFrame.imageHeight) * scaleY) : newH
    });
    setSelectedSlotIndex(0);
    setToastMessage('Ukuran kertas diubah ke ' + newPreset.name);
    setTimeout(() => setToastMessage(''), 2500);
  };

  // Frame Image Layout & Mirror Properties (Anti-Stretch & Draggable)
  const defaultStripWidth = Math.round(canvasW / 2);
  const imageX = customFrame?.imageX !== undefined ? Number(customFrame.imageX) : 0;
  const imageY = customFrame?.imageY !== undefined ? Number(customFrame.imageY) : 0;
  const imageWidth = customFrame?.imageWidth !== undefined && Number(customFrame.imageWidth) > 0
    ? Number(customFrame.imageWidth)
    : (customFrame?.imageMirror ? defaultStripWidth : canvasW);
  const imageHeight = customFrame?.imageHeight !== undefined && Number(customFrame.imageHeight) > 0
    ? Number(customFrame.imageHeight)
    : canvasH;

  const isImageMirror = Boolean(customFrame?.imageMirror);
  const is2StripLayoutSelected = isImageMirror;
  const isFullLayoutSelected = !isImageMirror;
  const mirrorImageX = customFrame?.mirrorImageX !== undefined
    ? Number(customFrame.mirrorImageX)
    : (canvasW - imageWidth);
  const mirrorImageY = customFrame?.mirrorImageY !== undefined
    ? Number(customFrame.mirrorImageY)
    : imageY;
  const mirrorImageWidth = customFrame?.mirrorImageWidth !== undefined && Number(customFrame.mirrorImageWidth) > 0
    ? Number(customFrame.mirrorImageWidth)
    : imageWidth;
  const mirrorImageHeight = customFrame?.mirrorImageHeight !== undefined && Number(customFrame.mirrorImageHeight) > 0
    ? Number(customFrame.mirrorImageHeight)
    : imageHeight;
  const mirrorImageFlip = Boolean(customFrame?.mirrorImageFlip);

  const safeSelectedIdx = Math.min(
    Math.max(0, selectedSlotIndex),
    Math.max(0, activeSlots.length - 1)
  );
  const selectedSlot = activeSlots[safeSelectedIdx] || null;

  // Ensure index is valid when slots change
  useEffect(() => {
    if (selectedSlotIndex >= activeSlots.length && activeSlots.length > 0) {
      setSelectedSlotIndex(activeSlots.length - 1);
    }
  }, [activeSlots.length, selectedSlotIndex]);

  const updateSelectedSlot = useCallback(
    (prop, val) => {
      if (!selectedSlot) return;
      const updated = activeSlots.map((s, idx) => {
        if (idx === safeSelectedIdx) {
          if (prop === 'borderColor') return { ...s, [prop]: val };
          const num = Number(val);
          return { ...s, [prop]: isNaN(num) ? 0 : num };
        }
        return s;
      });
      commitSlots(updated);
    },
    [activeSlots, safeSelectedIdx, selectedSlot, commitSlots]
  );

  const updateSelectedSlotBatch = useCallback(
    (patch) => {
      if (!selectedSlot) return;
      const updated = activeSlots.map((s, idx) => {
        if (idx === safeSelectedIdx) {
          return { ...s, ...patch };
        }
        return s;
      });
      commitSlots(updated);
    },
    [activeSlots, safeSelectedIdx, selectedSlot, commitSlots]
  );

  // Keyboard navigation, shortcuts, and Ctrl+Scroll zoom for mapping frame
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Do not trigger if typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      // Copy selected slot: Ctrl + C / Cmd + C
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelectedSlot();
        return;
      }

      // Paste slot: Ctrl + V / Cmd + V
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteSlot();
        return;
      }

      // Duplicate slot: Ctrl + D / Cmd + D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelectedSlot();
        return;
      }

      // Undo: Ctrl + Z / Cmd + Z (tanpa Shift)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl + Shift + Z / Cmd + Shift + Z atau Ctrl + Y
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Zoom shortcuts: Ctrl + / Ctrl - / Ctrl 0
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoomLevel((z) => Math.min(MAX_ZOOM, z + (z >= 200 ? 50 : 25)));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        setZoomLevel((z) => Math.max(MIN_ZOOM, z - (z > 200 ? 50 : 25)));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoomLevel(100);
        return;
      }

      // Delete selected slot: Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeSlots.length > 1 && safeSelectedIdx >= 0) {
          e.preventDefault();
          removeSlot(safeSelectedIdx);
          return;
        }
      }

      // Escape key to close modal
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Arrow keys navigation for selected slot
      if (!selectedSlot) return;

      const step = e.shiftKey ? 10 : 1;
      let handled = false;

      if (e.key === 'ArrowLeft') {
        updateSelectedSlot('x', Math.max(0, selectedSlot.x - step));
        handled = true;
      } else if (e.key === 'ArrowRight') {
        updateSelectedSlot('x', Math.min(canvasW - selectedSlot.width, selectedSlot.x + step));
        handled = true;
      } else if (e.key === 'ArrowUp') {
        updateSelectedSlot('y', Math.max(0, selectedSlot.y - step));
        handled = true;
      } else if (e.key === 'ArrowDown') {
        updateSelectedSlot('y', Math.min(canvasH - selectedSlot.height, selectedSlot.y + step));
        handled = true;
      }

      if (handled) {
        e.preventDefault();
      }
    };

    // Zoom on Ctrl + Scroll
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoomLevel((prev) => {
          const step = prev >= 200 ? 25 : 15;
          if (e.deltaY < 0) {
            // Scroll ke atas -> Zoom In
            return Math.min(MAX_ZOOM, prev + step);
          } else if (e.deltaY > 0) {
            // Scroll ke bawah -> Zoom Out
            return Math.max(MIN_ZOOM, prev - step);
          }
          return prev;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen, selectedSlot, canvasW, canvasH, updateSelectedSlot, onClose, handleUndo, handleRedo, activeSlots.length, safeSelectedIdx]);

  // Direct drag handler for moving frame image or mirror frame image on canvas
  const handleFrameImageDragStart = (clientX, clientY, targetType = "main") => {
    setSelectedImageTarget(targetType);
    if (!canvasBoxRef.current) return;

    const rect = canvasBoxRef.current.getBoundingClientRect();
    const scale = canvasW / rect.width;

    const isMain = targetType === "main";
    const initialX = isMain ? imageX : mirrorImageX;
    const initialY = isMain ? imageY : mirrorImageY;

    setIsDragging(true);

    const onPointerMove = (moveX, moveY) => {
      const deltaX = (moveX - clientX) * scale;
      const deltaY = (moveY - clientY) * scale;
      const newX = Math.round(initialX + deltaX);
      const newY = Math.round(initialY + deltaY);

      if (isMain) {
        onUpdateFrame({ imageX: newX, imageY: newY });
      } else {
        onUpdateFrame({ mirrorImageX: newX, mirrorImageY: newY });
      }
    };

    const handleMouseMove = (e) => onPointerMove(e.clientX, e.clientY);
    const handleTouchMove = (e) => {
      if (e.cancelable) e.preventDefault();
      if (e.touches && e.touches[0]) onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handlePointerEnd = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handlePointerEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handlePointerEnd);
      window.removeEventListener("touchcancel", handlePointerEnd);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handlePointerEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handlePointerEnd);
    window.addEventListener("touchcancel", handlePointerEnd);
  };

  // Direct drag handler for moving slots on canvas (mouse + touch)
  const handleSlotDragStart = (clientX, clientY, idx) => {
    setSelectedSlotIndex(idx);
    setSidebarTab("slots");

    const slot = activeSlots[idx];
    if (!slot || !canvasBoxRef.current) return;

    const rect = canvasBoxRef.current.getBoundingClientRect();
    const scale = canvasW / rect.width;

    dragStartSlotsRef.current = JSON.stringify(activeSlots);
    dragInfoRef.current = {
      slotIndex: idx,
      startX: clientX,
      startY: clientY,
      initialSlotX: Number(slot.x) || 0,
      initialSlotY: Number(slot.y) || 0,
      slotW: Number(slot.width) || 100,
      slotH: Number(slot.height) || 100,
      scale
    };

    setIsDragging(true);

    const onPointerMove = (moveX, moveY) => {
      if (!dragInfoRef.current) return;
      const { slotIndex, startX, startY, initialSlotX, initialSlotY, slotW, slotH, scale: currentScale } = dragInfoRef.current;
      const deltaX = (moveX - startX) * currentScale;
      const deltaY = (moveY - startY) * currentScale;

      const newX = Math.round(Math.max(0, Math.min(canvasW - slotW, initialSlotX + deltaX)));
      const newY = Math.round(Math.max(0, Math.min(canvasH - slotH, initialSlotY + deltaY)));

      const updated = activeSlots.map((s, i) => {
        if (i === slotIndex) {
          return { ...s, x: newX, y: newY };
        }
        return s;
      });
      setLocalSlots(updated);
      latestSlotsRef.current = updated;
    };

    const handleMouseMove = (moveEvent) => {
      onPointerMove(moveEvent.clientX, moveEvent.clientY);
    };

    const handleTouchMove = (touchEvent) => {
      if (touchEvent.cancelable) {
        touchEvent.preventDefault();
      }
      if (touchEvent.touches && touchEvent.touches[0]) {
        onPointerMove(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
      }
    };

    const handlePointerEnd = () => {
      setIsDragging(false);
      dragInfoRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handlePointerEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handlePointerEnd);
      window.removeEventListener('touchcancel', handlePointerEnd);
      if (latestSlotsRef.current) {
        onUpdateFrame({ slots: latestSlotsRef.current });
        if (dragStartSlotsRef.current && JSON.stringify(latestSlotsRef.current) !== dragStartSlotsRef.current) {
          pushHistory(latestSlotsRef.current);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handlePointerEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handlePointerEnd);
    window.addEventListener('touchcancel', handlePointerEnd);
  };

  const handleSlotMouseDown = (e, idx) => {
    e.stopPropagation();
    handleSlotDragStart(e.clientX, e.clientY, idx);
  };

  // Direct resize handler from placeholder handles (nw, n, ne, e, se, s, sw, w)
  const handleResizeStart = (clientX, clientY, idx, direction) => {
    setSelectedSlotIndex(idx);

    const slot = activeSlots[idx];
    if (!slot || !canvasBoxRef.current) return;

    const rect = canvasBoxRef.current.getBoundingClientRect();
    const scale = canvasW / rect.width;

    resizeStartSlotsRef.current = JSON.stringify(activeSlots);
    resizeInfoRef.current = {
      slotIndex: idx,
      direction,
      startX: clientX,
      startY: clientY,
      initialX: Number(slot.x) || 0,
      initialY: Number(slot.y) || 0,
      initialW: Number(slot.width) || 100,
      initialH: Number(slot.height) || 100,
      scale
    };

    setIsDragging(true);

    const onPointerMove = (moveX, moveY) => {
      if (!resizeInfoRef.current) return;
      const {
        slotIndex,
        direction: dir,
        startX,
        startY,
        initialX,
        initialY,
        initialW,
        initialH,
        scale: currentScale
      } = resizeInfoRef.current;

      const deltaX = (moveX - startX) * currentScale;
      const deltaY = (moveY - startY) * currentScale;

      let newX = initialX;
      let newY = initialY;
      let newW = initialW;
      let newH = initialH;

      const minW = 40;
      const minH = 40;

      // Horizontal resizing
      if (dir.includes('e')) {
        newW = Math.max(minW, Math.min(canvasW - initialX, Math.round(initialW + deltaX)));
      } else if (dir.includes('w')) {
        const maxDeltaX = initialW - minW;
        const minDeltaX = -initialX;
        const boundedDeltaX = Math.max(minDeltaX, Math.min(maxDeltaX, Math.round(deltaX)));
        newX = initialX + boundedDeltaX;
        newW = initialW - boundedDeltaX;
      }

      // Vertical resizing
      if (dir.includes('s')) {
        newH = Math.max(minH, Math.min(canvasH - initialY, Math.round(initialH + deltaY)));
      } else if (dir.includes('n')) {
        const maxDeltaY = initialH - minH;
        const minDeltaY = -initialY;
        const boundedDeltaY = Math.max(minDeltaY, Math.min(maxDeltaY, Math.round(deltaY)));
        newY = initialY + boundedDeltaY;
        newH = initialH - boundedDeltaY;
      }

      const updated = activeSlots.map((s, i) => {
        if (i === slotIndex) {
          return {
            ...s,
            x: Math.round(newX),
            y: Math.round(newY),
            width: Math.round(newW),
            height: Math.round(newH)
          };
        }
        return s;
      });
      setLocalSlots(updated);
      latestSlotsRef.current = updated;
    };

    const handleMouseMove = (moveEvent) => {
      onPointerMove(moveEvent.clientX, moveEvent.clientY);
    };

    const handleTouchMove = (touchEvent) => {
      if (touchEvent.cancelable) {
        touchEvent.preventDefault();
      }
      if (touchEvent.touches && touchEvent.touches[0]) {
        onPointerMove(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
      }
    };

    const handlePointerEnd = () => {
      setIsDragging(false);
      resizeInfoRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handlePointerEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handlePointerEnd);
      window.removeEventListener('touchcancel', handlePointerEnd);
      if (latestSlotsRef.current) {
        onUpdateFrame({ slots: latestSlotsRef.current });
        if (resizeStartSlotsRef.current && JSON.stringify(latestSlotsRef.current) !== resizeStartSlotsRef.current) {
          pushHistory(latestSlotsRef.current);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handlePointerEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handlePointerEnd);
    window.addEventListener('touchcancel', handlePointerEnd);
  };

  const applySizeToAllSlots = () => {
    if (!selectedSlot) return;
    const targetW = Number(selectedSlot.width) || 100;
    const targetH = Number(selectedSlot.height) || 100;
    const updated = activeSlots.map((s) => ({
      ...s,
      width: targetW,
      height: targetH
    }));
    commitSlots(updated);
  };

  const applyStyleToAllSlots = () => {
    if (!selectedSlot) return;
    const targetRadius = Number(selectedSlot.radius) >= 0 ? Number(selectedSlot.radius) : 0;
    const targetBorderWidth = Number(selectedSlot.borderWidth) >= 0 ? Number(selectedSlot.borderWidth) : 0;
    const targetBorderColor = selectedSlot.borderColor || '#FFFFFF';

    const updated = activeSlots.map((s) => ({
      ...s,
      radius: targetRadius,
      borderWidth: targetBorderWidth,
      borderColor: targetBorderColor
    }));
    commitSlots(updated);
  };

  // Helper: Dapatkan photoIndex sebuah slot (default ke index array jika belum diset)
  const getSlotPhotoIndex = (slot, idx) => {
    return (slot && slot.photoIndex !== undefined && slot.photoIndex !== null)
      ? Number(slot.photoIndex)
      : idx;
  };

  const uniquePhotoIndices = Array.from(
    new Set(activeSlots.map((s, idx) => getSlotPhotoIndex(s, idx)))
  );
  const uniquePhotoCount = uniquePhotoIndices.length;
  const isMirrorModeActive = activeSlots.length > 1 && (
    uniquePhotoCount < activeSlots.length ||
    activeSlots.some((s) => s.mirrorFromSlot !== null && s.mirrorFromSlot !== undefined)
  );

  // Menghitung titik pusat kanvas yang terlihat (visible area) di scroll viewport saat sedang zoom
  const getVisibleCanvasCenter = (slotW = 400, slotH = 400) => {
    if (typeof window === 'undefined' || !canvasBoxRef.current || !canvasViewportRef.current) {
      return {
        x: Math.round(Math.max(0, (canvasW - slotW) / 2)),
        y: Math.round(Math.max(0, (canvasH - slotH) / 2))
      };
    }

    try {
      const vRect = canvasViewportRef.current.getBoundingClientRect();
      const cRect = canvasBoxRef.current.getBoundingClientRect();

      if (vRect.width > 0 && vRect.height > 0 && cRect.width > 0 && cRect.height > 0) {
        const visibleLeft = Math.max(vRect.left, cRect.left);
        const visibleRight = Math.min(vRect.right, cRect.right);
        const visibleTop = Math.max(vRect.top, cRect.top);
        const visibleBottom = Math.min(vRect.bottom, cRect.bottom);

        if (visibleRight > visibleLeft && visibleBottom > visibleTop) {
          const centerScreenX = (visibleLeft + visibleRight) / 2;
          const centerScreenY = (visibleTop + visibleBottom) / 2;

          const relX = centerScreenX - cRect.left;
          const relY = centerScreenY - cRect.top;

          const scaleX = canvasW / cRect.width;
          const scaleY = canvasH / cRect.height;

          const canvasCenterX = Math.round(relX * scaleX);
          const canvasCenterY = Math.round(relY * scaleY);

          const targetX = Math.round(canvasCenterX - slotW / 2);
          const targetY = Math.round(canvasCenterY - slotH / 2);

          return {
            x: Math.max(0, Math.min(canvasW - slotW, targetX)),
            y: Math.max(0, Math.min(canvasH - slotH, targetY))
          };
        }
      }
    } catch (e) {}

    return {
      x: Math.round(Math.max(0, (canvasW - slotW) / 2)),
      y: Math.round(Math.max(0, (canvasH - slotH) / 2))
    };
  };

  const copySelectedSlot = () => {
    if (!selectedSlot) return;
    setClipboardSlot({
      width: Number(selectedSlot.width) || 400,
      height: Number(selectedSlot.height) || 400,
      radius: selectedSlot.radius ?? 16,
      borderWidth: selectedSlot.borderWidth ?? 0,
      borderColor: selectedSlot.borderColor || '#FFFFFF',
      mirrorFromSlot: selectedSlot.mirrorFromSlot ?? null
    });
    setToastMessage(`Slot #${safeSelectedIdx + 1} disalin! (Ctrl + V untuk tempel)`);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const getNextSlotId = (slots) => {
    if (!Array.isArray(slots) || slots.length === 0) return 1;
    const max = slots.reduce((m, s) => {
      const num = Number(s?.id);
      return Number.isFinite(num) ? Math.max(m, num) : m;
    }, 0);
    return Math.max(max, slots.length) + 1;
  };

  const pasteSlot = () => {

    if (activeSlots.length >= 12) return;
    const template = clipboardSlot || selectedSlot || {
      width: 400,
      height: 400,
      radius: 16,
      borderWidth: 0,
      borderColor: '#FFFFFF',
      mirrorFromSlot: null
    };

    const targetW = Number(template.width) || 400;
    const targetH = Number(template.height) || 400;

    let { x, y } = getVisibleCanvasCenter(targetW, targetH);

    // Jika di posisi yang sama dengan slot terpilih, beri offset 24px agar tidak persis menumpuk
    if (selectedSlot && Math.abs(Number(selectedSlot.x) - x) < 40 && Math.abs(Number(selectedSlot.y) - y) < 40) {
      x = Math.min(canvasW - targetW, Math.max(0, Number(selectedSlot.x) + 24));
      y = Math.min(canvasH - targetH, Math.max(0, Number(selectedSlot.y) + 24));
    }

    const newId = getNextSlotId(activeSlots);
    const newSlot = {
      id: newId,
      x,
      y,
      width: targetW,
      height: targetH,
      radius: template.radius ?? 16,
      borderWidth: template.borderWidth ?? 0,
      borderColor: template.borderColor || '#FFFFFF',
      mirrorFromSlot: template.mirrorFromSlot ?? null
    };

    const nextSlots = [...activeSlots, newSlot];
    const { slotPhotoIndices, uniquePhotoCount: uCount } = resolveSlotsPhotoMapping(nextSlots);
    const synced = nextSlots.map((s, idx) => ({
      ...s,
      photoIndex: slotPhotoIndices[idx]
    }));
    commitSlots(synced);
    onUpdateFrame({ photoCount: uCount, slots: synced });
    setSelectedSlotIndex(nextSlots.length - 1);
    setToastMessage(`Slot #${nextSlots.length} berhasil ditempel di area terlihat!`);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const duplicateSelectedSlot = () => {
    if (!selectedSlot || activeSlots.length >= 12) return;
    copySelectedSlot();
    pasteSlot();
  };

  const addSlot = () => {
    if (activeSlots.length >= 12) return;
    const newId = getNextSlotId(activeSlots);
    const defaultW = selectedSlot ? Number(selectedSlot.width) || 400 : 400;
    const defaultH = selectedSlot ? Number(selectedSlot.height) || 400 : 400;
    const defaultRadius = selectedSlot ? (selectedSlot.radius ?? 16) : 16;
    const defaultBorder = selectedSlot ? (selectedSlot.borderWidth ?? 0) : 0;
    const defaultBorderColor = selectedSlot ? (selectedSlot.borderColor || '#FFFFFF') : '#FFFFFF';

    const { x, y } = getVisibleCanvasCenter(defaultW, defaultH);

    const newSlot = {
      id: newId,
      x,
      y,
      width: defaultW,
      height: defaultH,
      radius: defaultRadius,
      borderWidth: defaultBorder,
      borderColor: defaultBorderColor,
      mirrorFromSlot: null
    };
    const nextSlots = [...activeSlots, newSlot];
    const { slotPhotoIndices, uniquePhotoCount: uCount } = resolveSlotsPhotoMapping(nextSlots);
    const synced = nextSlots.map((s, idx) => ({
      ...s,
      photoIndex: slotPhotoIndices[idx]
    }));
    commitSlots(synced);
    onUpdateFrame({ photoCount: uCount, slots: synced });
    setSelectedSlotIndex(nextSlots.length - 1);
  };

  // Create slot baru yang mengambil foto (mirror) dari slot lain (misal create Slot 4 mirror dari Slot 1)
  const addMirrorSlot = (sourceSlotIdx = safeSelectedIdx) => {
    if (activeSlots.length >= 12) return;
    const src = activeSlots[sourceSlotIdx] || activeSlots[0];
    const newId = getNextSlotId(activeSlots);

    const srcX = Number(src.x) || 0;
    const srcY = Number(src.y) || 0;
    const srcW = Number(src.width) || 400;
    const srcH = Number(src.height) || 400;

    // Coba posisi simetris horizontal (misal untuk format 2 strip kiri-kanan)
    const symmetricalX = Math.round(canvasW - srcX - srcW);
    let targetX = symmetricalX;
    let targetY = srcY;

    if (Math.abs(symmetricalX - srcX) < 40 || symmetricalX < 0 || symmetricalX + srcW > canvasW) {
      const center = getVisibleCanvasCenter(srcW, srcH);
      targetX = center.x;
      targetY = center.y;
    }

    const newSlot = {
      id: newId,
      x: Math.min(canvasW - srcW, Math.max(0, targetX)),
      y: Math.min(canvasH - srcH, Math.max(0, targetY)),
      width: srcW,
      height: srcH,
      radius: src.radius ?? 16,
      borderWidth: src.borderWidth ?? 0,
      borderColor: src.borderColor || '#FFFFFF',
      mirrorFromSlot: sourceSlotIdx
    };

    const nextSlots = [...activeSlots, newSlot];
    const { slotPhotoIndices, uniquePhotoCount: uCount } = resolveSlotsPhotoMapping(nextSlots);
    const synced = nextSlots.map((s, idx) => ({
      ...s,
      photoIndex: slotPhotoIndices[idx]
    }));

    commitSlots(synced);
    onUpdateFrame({ photoCount: uCount, slots: synced });
    setSelectedSlotIndex(nextSlots.length - 1);
  };

  // Ubah sumber foto sebuah slot (apakah mirror dari slot lain atau mandiri)
  const setSlotMirrorSource = (slotIdx, sourceIdxOrNull) => {
    const updated = activeSlots.map((s, idx) => {
      if (idx !== slotIdx) return s;
      return {
        ...s,
        mirrorFromSlot: sourceIdxOrNull !== null && sourceIdxOrNull !== undefined ? Number(sourceIdxOrNull) : null
      };
    });

    const { slotPhotoIndices, uniquePhotoCount: uCount } = resolveSlotsPhotoMapping(updated);
    const synced = updated.map((s, idx) => ({
      ...s,
      photoIndex: slotPhotoIndices[idx]
    }));

    commitSlots(synced);
    onUpdateFrame({ photoCount: uCount, slots: synced });
  };

  const removeSlot = (idxToRemove) => {
    if (activeSlots.length <= 1) return;
    const filtered = activeSlots
      .filter((_, idx) => idx !== idxToRemove)
      .map((s) => {
        let newMirror = s.mirrorFromSlot;
        if (newMirror === idxToRemove) {
          newMirror = null;
        } else if (typeof newMirror === 'number' && newMirror > idxToRemove) {
          newMirror = newMirror - 1;
        }
        return {
          ...s,
          mirrorFromSlot: newMirror
        };
      });

    const { slotPhotoIndices, uniquePhotoCount: uCount } = resolveSlotsPhotoMapping(filtered);
    const synced = filtered.map((s, idx) => ({
      ...s,
      photoIndex: slotPhotoIndices[idx]
    }));

    commitSlots(synced);
    onUpdateFrame({ photoCount: uCount, slots: synced });
    setSelectedSlotIndex(Math.max(0, idxToRemove - 1));
  };

  const applyPreset = (count) => {
    const preset = SLOT_PRESETS[count];
    if (preset) {
      const template = isLandscape ? preset.landscape : preset.portrait;
      commitSlots(
        template.map((s) => ({
          ...s,
          borderWidth: 0,
          borderColor: '#FFFFFF',
          radius: 16,
          mirrorFromSlot: null
        }))
      );
      setSelectedSlotIndex(0);
    }
  };

  // Mirror Kolom (Kiri = Kanan) - Ideal untuk 2 strip dalam 1 lembar 4R (misal 6 slot diisi 3x foto)
  const applyColumnMirror = () => {
    if (activeSlots.length < 2) return;
    const midX = canvasW / 2;
    const leftSlots = [];
    const rightSlots = [];

    activeSlots.forEach((s, idx) => {
      const cx = (Number(s.x) || 0) + (Number(s.width) || 100) / 2;
      if (cx < midX) {
        leftSlots.push({ slot: s, originalIdx: idx });
      } else {
        rightSlots.push({ slot: s, originalIdx: idx });
      }
    });

    leftSlots.sort((a, b) => (Number(a.slot.y) || 0) - (Number(b.slot.y) || 0));
    rightSlots.sort((a, b) => (Number(a.slot.y) || 0) - (Number(b.slot.y) || 0));

    const updated = [...activeSlots];
    const leftCount = Math.max(leftSlots.length, 1);

    leftSlots.forEach((item, pIdx) => {
      updated[item.originalIdx] = {
        ...updated[item.originalIdx],
        mirrorFromSlot: null,
        photoIndex: pIdx
      };
    });

    rightSlots.forEach((item, pIdx) => {
      const sourceLeftIdx = pIdx < leftCount ? leftSlots[pIdx].originalIdx : leftSlots[pIdx % leftCount].originalIdx;
      updated[item.originalIdx] = {
        ...updated[item.originalIdx],
        mirrorFromSlot: sourceLeftIdx,
        photoIndex: pIdx < leftCount ? pIdx : pIdx % leftCount
      };
    });

    commitSlots(updated);
    onUpdateFrame({ photoCount: leftCount, slots: updated });
  };

  // Mirror Berpasangan (1=2, 3=4, 5=6)
  const applyPairMirror = () => {
    if (activeSlots.length < 2) return;
    const targetCount = Math.ceil(activeSlots.length / 2);
    const updated = activeSlots.map((s, idx) => {
      const isEven = idx % 2 === 0;
      return {
        ...s,
        mirrorFromSlot: isEven ? null : idx - 1,
        photoIndex: Math.floor(idx / 2)
      };
    });
    commitSlots(updated);
    onUpdateFrame({ photoCount: targetCount, slots: updated });
  };

  // Reset 1:1 Normal (Setiap slot mendapat fotonya sendiri)
  const resetSlotMirror = () => {
    const updated = activeSlots.map((s, idx) => ({
      ...s,
      mirrorFromSlot: null,
      photoIndex: idx
    }));
    commitSlots(updated);
    onUpdateFrame({ photoCount: activeSlots.length, slots: updated });
  };

  if (!isOpen) return null;

  // Calculate dynamic canvas size based on zoom
  // Base display: ~440px wide for portrait, ~660px wide for landscape at 100%
  const baseWidthPx = isLandscape ? 660 : (paperPreset.hasOrientation ? 440 : 520);
  const displayWidthPx = Math.round((baseWidthPx * zoomLevel) / 100);
  const displayHeightPx = Math.round((displayWidthPx * canvasH) / canvasW);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex flex-col select-none overflow-hidden animate-fade-in overscroll-none" style={{ overscrollBehavior: 'none', marginTop: 0 }}>
        {/* Top Header Bar (Rapi, Luwes & Bersih Tanpa Overlapping) */}
        <div className="h-14 sm:h-16 bg-slate-900 border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between shrink-0 text-white gap-3 z-50">
          <div className="flex items-center gap-2.5 min-w-0 shrink">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-xs">
              <Maximize2 size={17} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                <h2 className="text-xs sm:text-sm md:text-base font-extrabold text-white truncate">
                  Editor Presisi Frame & Mapping Slot
                </h2>
                {frameName && (
                  <span className="text-xs font-semibold text-slate-400 truncate hidden md:inline">
                    • {frameName}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0 whitespace-nowrap">
                  {paperPreset.label} {paperPreset.hasOrientation ? (isLandscape ? 'Landscape' : 'Portrait') : 'Kotak'} ({canvasW} × {canvasH} px)
                </span>
                {isMirrorModeActive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 flex items-center gap-1 shadow-xs">
                    <Sparkles size={10} className="text-amber-400" />
                    <span>Mirror ({uniquePhotoCount} Pose)</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Undo & Redo Controls */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!historyState.canUndo}
                className="p-1.5 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-300 hover:text-white cursor-pointer transition-colors"
                title="Undo / Batalkan Perubahan (Ctrl + Z)"
                aria-label="Undo"
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!historyState.canRedo}
                className="p-1.5 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-300 hover:text-white cursor-pointer transition-colors"
                title="Redo / Ulangi Perubahan (Ctrl + Shift + Z)"
                aria-label="Redo"
              >
                <Redo2 size={15} />
              </button>
            </div>

            {/* Zoom Controls (Tanpa tombol fit 100%) */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(MIN_ZOOM, z - (z > 200 ? 50 : 25)))}
                disabled={zoomLevel <= MIN_ZOOM}
                className="p-1.5 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-300 cursor-pointer transition-colors"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <span className="text-xs font-bold text-slate-200 px-2 min-w-[48px] text-center select-none">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(MAX_ZOOM, z + (z >= 200 ? 50 : 25)))}
                disabled={zoomLevel >= MAX_ZOOM}
                className="p-1.5 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-300 cursor-pointer transition-colors"
                title="Zoom In (Hingga 800%)"
                aria-label="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
            </div>

            {/* Grid Box Dropdown */}
            <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 px-2 py-0.5 gap-1.5">
              <Grid size={15} className={showGrid ? "text-rose-400 shrink-0" : "text-slate-400 shrink-0"} />
              <select
                value={showGrid ? gridSize : "off"}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "off") {
                    setShowGrid(false);
                  } else {
                    setShowGrid(true);
                    setGridSize(val);
                  }
                }}
                className="bg-transparent text-xs font-bold text-slate-200 cursor-pointer focus:outline-none py-1 border-none"
                title="Pilih Garis Bantu Grid & Sumbu Kanvas"
              >
                <option value="off" className="bg-slate-800 text-slate-300">Grid: Nonaktif</option>
                <option value="standard" className="bg-slate-800 text-slate-200">Grid: 50px</option>
                <option value="dense" className="bg-slate-800 text-slate-200">Grid: 20px</option>
                <option value="thirds" className="bg-slate-800 text-slate-200">Grid: 3×3</option>
              </select>
            </div>

            {/* Mode Switcher: Slot vs Frame Image (Icon Saja dengan Tooltip) */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setActiveEditorMode("slots");
                  setSidebarTab("slots");
                }}
                className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                  activeEditorMode === "slots"
                    ? "bg-rose-500 text-white shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
                title={`Mode Pemetaan Slot Foto (${activeSlots.length} slot)`}
                aria-label={`Mode Pemetaan Slot Foto (${activeSlots.length} slot)`}
              >
                <Crosshair size={16} />
              </button>
              {customFrame?.imageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveEditorMode("image");
                    setSidebarTab("frame");
                  }}
                  className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                    activeEditorMode === "image"
                      ? "bg-cyan-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-white hover:bg-slate-700"
                  }`}
                  title="Mode Geser & Mirror Desain Frame"
                  aria-label="Mode Geser & Mirror Desain Frame"
                >
                  <Move size={16} />
                </button>
              )}
            </div>

            {/* Placeholder Toggle (Icon Saja dengan Tooltip) */}
            <button
              type="button"
              onClick={() => setShowPlaceholders(!showPlaceholders)}
              className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                showPlaceholders
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700"
              }`}
              title={showPlaceholders ? "Sembunyikan Contoh Foto Tamu" : "Tampilkan Contoh Foto Tamu"}
              aria-label="Toggle Foto Contoh"
            >
              {showPlaceholders ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>

            {/* Save & Close Button (Tetap dengan teks) */}
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-98"
              title="Simpan perubahan dan tutup editor"
            >
              <Check size={15} />
              <span>Selesai & Simpan</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
              title="Tutup Modal"
              aria-label="Tutup Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main Content Area (Split Pane) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden custom-scrollbar">
          {/* Left / Center: Interactive Large Canvas Viewport */}
          <div ref={canvasViewportRef} className="flex-1 min-h-[460px] lg:min-h-0 bg-slate-950 p-6 sm:p-12 overflow-auto custom-scrollbar flex relative select-none">
            {/* Canvas Container */}
            <div
              style={{
                width: `${displayWidthPx}px`,
                minWidth: `${displayWidthPx}px`,
                maxWidth: `${displayWidthPx}px`,
                height: `${displayHeightPx}px`,
                minHeight: `${displayHeightPx}px`,
                maxHeight: `${displayHeightPx}px`
              }}
              className="relative shrink-0 m-auto shadow-2xl transition-[width,height] duration-75 ease-out"
            >
              {/* Outer frame container */}
              <div
                ref={canvasBoxRef}
                style={{
                  width: `${displayWidthPx}px`,
                  minWidth: `${displayWidthPx}px`,
                  height: `${displayHeightPx}px`,
                  minHeight: `${displayHeightPx}px`,
                  backgroundImage:
                    'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                  touchAction: 'none',
                  overscrollBehavior: 'none'
                }}
                className="relative bg-slate-900 rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl select-none shrink-0"
              >
                {/* Professional Design & Editing Grid Overlay */}
                {showGrid && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none z-15"
                    viewBox={`0 0 ${canvasW} ${canvasH}`}
                  >
                    <defs>
                      {/* 20px Micro Grid */}
                      <pattern id="grid20" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                      </pattern>

                      {/* 50px Standard Editing Grid */}
                      <pattern id="grid50" width="50" height="50" patternUnits="userSpaceOnUse">
                        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="1" />
                      </pattern>

                      {/* 100px Major Alignment Grid */}
                      <pattern id="grid100" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                      </pattern>
                    </defs>

                    {/* Base Grid Pattern */}
                    {gridSize === 'dense' && <rect width={canvasW} height={canvasH} fill="url(#grid20)" />}
                    {(gridSize === 'standard' || gridSize === 'dense') && (
                      <>
                        <rect width={canvasW} height={canvasH} fill="url(#grid50)" />
                        <rect width={canvasW} height={canvasH} fill="url(#grid100)" />
                      </>
                    )}

                    {/* Rule of Thirds (3x3 Grid) */}
                    {gridSize === 'thirds' && (
                      <g stroke="rgba(251,191,36,0.6)" strokeWidth="2" strokeDasharray="8 6">
                        <line x1={Math.round(canvasW / 3)} y1="0" x2={Math.round(canvasW / 3)} y2={canvasH} />
                        <line x1={Math.round((canvasW * 2) / 3)} y1="0" x2={Math.round((canvasW * 2) / 3)} y2={canvasH} />
                        <line x1="0" y1={Math.round(canvasH / 3)} x2={canvasW} y2={Math.round(canvasH / 3)} />
                        <line x1="0" y1={Math.round((canvasH * 2) / 3)} x2={canvasW} y2={Math.round((canvasH * 2) / 3)} />
                      </g>
                    )}

                    {/* Smart Center Axes (Figma / Photoshop style Cyan Guides) */}
                    <g stroke="#06B6D4" strokeWidth="2" strokeDasharray="6 4" opacity="0.85">
                      {/* Vertical Center Axis (X) */}
                      <line x1={canvasW / 2} y1="0" x2={canvasW / 2} y2={canvasH} />
                      {/* Horizontal Center Axis (Y) */}
                      <line x1="0" y1={canvasH / 2} x2={canvasW} y2={canvasH / 2} />
                    </g>

                    {/* Center Point Marker */}
                    <circle cx={canvasW / 2} cy={canvasH / 2} r="5" fill="#06B6D4" opacity="0.9" />
                    <circle cx={canvasW / 2} cy={canvasH / 2} r="12" fill="none" stroke="#06B6D4" strokeWidth="1.5" opacity="0.6" />

                    {/* 4R Safe Print Margin Guide (40px dari tepi cetak) */}
                    <rect
                      x="40"
                      y="40"
                      width={canvasW - 80}
                      height={canvasH - 80}
                      fill="none"
                      stroke="#F43F5E"
                      strokeWidth="2"
                      strokeDasharray="8 8"
                      opacity="0.65"
                    />
                  </svg>
                )}

                {/* Layer 1: Placeholders (Under frame) */}
                {showPlaceholders && customFrame?.layerMode !== 'overlay' && (
                  <div className="absolute inset-0 pointer-events-none z-10">
                    {activeSlots.map((s, idx) => (
                      <div
                        key={`under-photo-${s.id !== undefined && s.id !== null ? s.id : idx}-${idx}`}
                        style={{
                          left: `${(Number(s.x) / canvasW) * 100}%`,
                          top: `${(Number(s.y) / canvasH) * 100}%`,
                          width: `${(Number(s.width) / canvasW) * 100}%`,
                          height: `${(Number(s.height) / canvasH) * 100}%`,
                          borderRadius: `${((Number(s.radius) || 0) / canvasW) * 100}%`,
                          border:
                            (Number(s.borderWidth) || 0) > 0
                              ? `${Math.max(
                                  1,
                                  Math.round(((Number(s.borderWidth) || 0) / canvasW) * displayWidthPx)
                                )}px solid ${s.borderColor || '#FFFFFF'}`
                              : 'none',
                          boxSizing: 'border-box'
                        }}
                        className="absolute overflow-hidden bg-slate-800"
                      >
                        {(() => {
                          const pIdx = getSlotPhotoIndex(s, idx);
                          return (
                            <img
                              src={SAMPLE_PLACEHOLDER_PHOTOS[pIdx % SAMPLE_PLACEHOLDER_PHOTOS.length]}
                              alt={`Pose ${pIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}

                {/* Layer 2: Frame Image (Supports Anti-Stretch, Custom Position & Draggable Mirror) */}
                {customFrame?.imageUrl && (
                  <>
                    {/* Main Frame Image */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${(imageX / canvasW) * 100}%`,
                        top: `${(imageY / canvasH) * 100}%`,
                        width: `${(imageWidth / canvasW) * 100}%`,
                        height: `${(imageHeight / canvasH) * 100}%`,
                        opacity: frameOpacity / 100,
                        zIndex: customFrame?.layerMode === 'overlay' ? 25 : 5,
                        pointerEvents: activeEditorMode === 'image' ? 'auto' : 'none'
                      }}
                      onMouseDown={(e) => {
                        if (activeEditorMode === 'image') {
                          e.stopPropagation();
                          handleFrameImageDragStart(e.clientX, e.clientY, 'main');
                        }
                      }}
                      onTouchStart={(e) => {
                        if (activeEditorMode === 'image' && e.touches?.[0]) {
                          e.stopPropagation();
                          handleFrameImageDragStart(e.touches[0].clientX, e.touches[0].clientY, 'main');
                        }
                      }}
                      className={`${
                        activeEditorMode === 'image'
                          ? `cursor-move select-none ${
                              selectedImageTarget === 'main'
                                ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 shadow-xl'
                                : 'border-2 border-dashed border-cyan-400/80 hover:border-cyan-300'
                            }`
                          : ''
                      }`}
                    >
                      <img
                        src={customFrame.imageUrl}
                        alt="Frame Template"
                        className="w-full h-full object-contain pointer-events-none select-none"
                      />
                      {activeEditorMode === 'image' && (
                        <div className="absolute top-1.5 left-1.5 bg-cyan-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow pointer-events-none flex items-center gap-1">
                          <ImageIcon size={10} />
                          <span>Desain Utama ({imageX}, {imageY})</span>
                        </div>
                      )}
                    </div>

                    {/* Mirrored Frame Image (if active) */}
                    {isImageMirror && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${(mirrorImageX / canvasW) * 100}%`,
                          top: `${(mirrorImageY / canvasH) * 100}%`,
                          width: `${(mirrorImageWidth / canvasW) * 100}%`,
                          height: `${(mirrorImageHeight / canvasH) * 100}%`,
                          opacity: frameOpacity / 100,
                          zIndex: customFrame?.layerMode === 'overlay' ? 25 : 5,
                          transform: mirrorImageFlip ? 'scaleX(-1)' : 'none',
                          pointerEvents: activeEditorMode === 'image' ? 'auto' : 'none'
                        }}
                        onMouseDown={(e) => {
                          if (activeEditorMode === 'image') {
                            e.stopPropagation();
                            handleFrameImageDragStart(e.clientX, e.clientY, 'mirror');
                          }
                        }}
                        onTouchStart={(e) => {
                          if (activeEditorMode === 'image' && e.touches?.[0]) {
                            e.stopPropagation();
                            handleFrameImageDragStart(e.touches[0].clientX, e.touches[0].clientY, 'mirror');
                          }
                        }}
                        className={`${
                          activeEditorMode === 'image'
                            ? `cursor-move select-none ${
                                selectedImageTarget === 'mirror'
                                  ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 shadow-xl'
                                  : 'border-2 border-dashed border-amber-400/80 hover:border-amber-300'
                              }`
                            : ''
                        }`}
                      >
                        <img
                          src={customFrame.imageUrl}
                          alt="Frame Template Mirror"
                          className="w-full h-full object-contain pointer-events-none select-none"
                        />
                        {activeEditorMode === 'image' && (
                          <div
                            style={{ transform: mirrorImageFlip ? 'scaleX(-1)' : 'none' }}
                            className="absolute top-1.5 left-1.5 bg-amber-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow pointer-events-none flex items-center gap-1"
                          >
                            <FlipHorizontal size={10} />
                            <span>Desain Mirror ({mirrorImageX}, {mirrorImageY})</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Layer 3: Placeholders (Over frame when layerMode === overlay) */}
                {showPlaceholders && customFrame?.layerMode === 'overlay' && (
                  <div className="absolute inset-0 pointer-events-none z-20">
                    {activeSlots.map((s, idx) => (
                      <div
                        key={`over-photo-${s.id !== undefined && s.id !== null ? s.id : idx}-${idx}`}
                        style={{
                          left: `${(Number(s.x) / canvasW) * 100}%`,
                          top: `${(Number(s.y) / canvasH) * 100}%`,
                          width: `${(Number(s.width) / canvasW) * 100}%`,
                          height: `${(Number(s.height) / canvasH) * 100}%`,
                          borderRadius: `${((Number(s.radius) || 0) / canvasW) * 100}%`,
                          border:
                            (Number(s.borderWidth) || 0) > 0
                              ? `${Math.max(
                                  1,
                                  Math.round(((Number(s.borderWidth) || 0) / canvasW) * displayWidthPx)
                                )}px solid ${s.borderColor || '#FFFFFF'}`
                              : 'none',
                          boxSizing: 'border-box'
                        }}
                        className="absolute overflow-hidden bg-slate-800"
                      >
                        {(() => {
                          const pIdx = getSlotPhotoIndex(s, idx);
                          return (
                            <img
                              src={SAMPLE_PLACEHOLDER_PHOTOS[pIdx % SAMPLE_PLACEHOLDER_PHOTOS.length]}
                              alt={`Pose ${pIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}

                {/* Layer 4: Interactive Draggable Slots Overlay */}
                <div className={`absolute inset-0 z-30 ${activeEditorMode === 'image' ? 'pointer-events-none opacity-40' : 'pointer-events-auto opacity-100'}`}>
                  {activeSlots.map((s, idx) => {
                    const isSelected = idx === safeSelectedIdx;
                    const slotX = Number(s.x) || 0;
                    const slotY = Number(s.y) || 0;
                    const slotW = Number(s.width) || 100;
                    const slotH = Number(s.height) || 100;
                    const radius = Number(s.radius) || 0;

                    return (
                      <div
                        key={`editor-slot-${s.id !== undefined && s.id !== null ? s.id : idx}-${idx}`}
                        onMouseDown={(e) => handleSlotMouseDown(e, idx)}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          if (e.cancelable) e.preventDefault();
                          if (e.touches && e.touches[0]) {
                            handleSlotDragStart(e.touches[0].clientX, e.touches[0].clientY, idx);
                          }
                        }}
                        style={{
                          position: 'absolute',
                          left: `${(slotX / canvasW) * 100}%`,
                          top: `${(slotY / canvasH) * 100}%`,
                          width: `${(slotW / canvasW) * 100}%`,
                          height: `${(slotH / canvasH) * 100}%`,
                          borderRadius: `${(radius / canvasW) * 100}%`,
                          boxSizing: 'border-box'
                        }}
                        className={`cursor-move transition-shadow select-none ${
                          isSelected
                            ? 'ring-2 ring-rose-500 shadow-2xl z-40 bg-rose-500/10'
                            : 'border-2 border-dashed border-white/60 hover:border-amber-400 bg-white/5 hover:bg-white/10 z-30'
                        }`}
                      >
                        {/* Slot Badge (Menampilkan Slot & Sumber Mirror / Foto) */}
                        {(() => {
                          const pIdx = getSlotPhotoIndex(s, idx);
                          const isMirrored = s.mirrorFromSlot !== null && s.mirrorFromSlot !== undefined;
                          const mirrorSrcIdx = isMirrored ? Number(s.mirrorFromSlot) : null;
                          return (
                            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/85 backdrop-blur-xs text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md pointer-events-none z-10">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isSelected ? 'bg-rose-400 animate-pulse' : 'bg-slate-400'
                                }`}
                              />
                              <span>Slot #{idx + 1}</span>
                              {isMirrored ? (
                                <span className="font-extrabold text-amber-300 flex items-center gap-0.5">
                                  <span>• Mirror Slot #{mirrorSrcIdx + 1}</span>
                                </span>
                              ) : (
                                <span className="font-semibold text-slate-300">
                                  • Foto #{pIdx + 1}
                                </span>
                              )}
                              <span className="text-slate-400 font-normal hidden sm:inline">
                                ({slotW}×{slotH})
                              </span>
                            </div>
                          );
                        })()}

                        {/* Coordinates Tooltip when selected */}
                        {isSelected && (
                          <div className="absolute bottom-1.5 right-1.5 bg-rose-950/90 border border-rose-500/50 text-rose-200 px-2 py-0.5 rounded text-[9px] font-mono shadow-md pointer-events-none z-10">
                            X: {slotX} | Y: {slotY}
                          </div>
                        )}

                        {/* Center Crosshair Indicator when selected */}
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                            <Crosshair size={24} className="text-rose-400" />
                          </div>
                        )}

                        {/* 8 Direct Precision Resize Handles (Sleek Compact Size with Expanded Touch Hit-area) */}
                        {isSelected && (
                          <>
                            {/* Top-Left */}
                            <div
                              title="Tarik sudut kiri-atas untuk ubah ukuran"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleResizeStart(e.clientX, e.clientY, idx, 'nw');
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                if (e.cancelable) e.preventDefault(); if (e.touches?.[0]) handleResizeStart(e.touches[0].clientX, e.touches[0].clientY, idx, 'nw');
                              }}
                              className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-rose-500 rounded-[2px] shadow-xs cursor-nwse-resize hover:scale-150 z-50 transition-transform after:absolute after:-inset-2 touch-none after:content-['']"
                            />
                            {/* Top-Center */}
                            <div
                              title="Tarik sisi atas untuk ubah tinggi"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleResizeStart(e.clientX, e.clientY, idx, 'n');
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                if (e.cancelable) e.preventDefault(); if (e.touches?.[0]) handleResizeStart(e.touches[0].clientX, e.touches[0].clientY, idx, 'n');
                              }}
                              className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border border-rose-500 rounded-[2px] shadow-xs cursor-ns-resize hover:scale-150 z-50 transition-transform after:absolute after:-inset-2 touch-none after:content-['']"
                            />
                            {/* Top-Right */}
                            <div
                              title="Tarik sudut kanan-atas untuk ubah ukuran"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleResizeStart(e.clientX, e.clientY, idx, 'ne');
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                if (e.cancelable) e.preventDefault(); if (e.touches?.[0]) handleResizeStart(e.touches[0].clientX, e.touches[0].clientY, idx, 'ne');
                              }}
                              className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-rose-500 rounded-[2px] shadow-xs cursor-nesw-resize hover:scale-150 z-50 transition-transform after:absolute after:-inset-2 touch-none after:content-['']"
                            />
                            {/* Middle-Right */}
                            <div
                              title="Tarik sisi kanan untuk ubah lebar"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleResizeStart(e.clientX, e.clientY, idx, 'e');
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                if (e.cancelable) e.preventDefault(); if (e.touches?.[0]) handleResizeStart(e.touches[0].clientX, e.touches[0].clientY, idx, 'e');
                              }}
                              className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-white border border-rose-500 rounded-[2px] shadow-xs cursor-ew-resize hover:scale-150 z-50 transition-transform after:absolute after:-inset-2 touch-none after:content-['']"
                            />
                            {/* Bottom-Right (Primary Accent Handle) */}
                            <div
                              title="Tarik sudut kanan-bawah untuk ubah ukuran"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleResizeStart(e.clientX, e.clientY, idx, 'se');
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                if (e.cancelable) e.preventDefault(); if (e.touches?.[0]) handleResizeStart(e.touches[0].clientX, e.touches[0].clientY, idx, 'se');
                              }}
                              className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-rose-500 border border-white rounded-[2px] shadow-sm cursor-nwse-resize hover:scale-150 z-50 transition-transform after:absolute after:-inset-2 touch-none after:content-['']"
                            />
                            {/* Bottom-Center */}
                            <div
                              title="Tarik sisi bawah untuk ubah tinggi"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleResizeStart(e.clientX, e.clientY, idx, 's');
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                if (e.cancelable) e.preventDefault(); if (e.touches?.[0]) handleResizeStart(e.touches[0].clientX, e.touches[0].clientY, idx, 's');
                              }}
                              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border border-rose-500 rounded-[2px] shadow-xs cursor-ns-resize hover:scale-150 z-50 transition-transform after:absolute after:-inset-2 touch-none after:content-['']"
                            />
                            {/* Bottom-Left */}
                            <div
                              title="Tarik sudut kiri-bawah untuk ubah ukuran"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleResizeStart(e.clientX, e.clientY, idx, 'sw');
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                if (e.cancelable) e.preventDefault(); if (e.touches?.[0]) handleResizeStart(e.touches[0].clientX, e.touches[0].clientY, idx, 'sw');
                              }}
                              className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-rose-500 rounded-[2px] shadow-xs cursor-nesw-resize hover:scale-150 z-50 transition-transform after:absolute after:-inset-2 touch-none after:content-['']"
                            />
                            {/* Middle-Left */}
                            <div
                              title="Tarik sisi kiri untuk ubah lebar"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleResizeStart(e.clientX, e.clientY, idx, 'w');
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                if (e.cancelable) e.preventDefault(); if (e.touches?.[0]) handleResizeStart(e.touches[0].clientX, e.touches[0].clientY, idx, 'w');
                              }}
                              className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-white border border-rose-500 rounded-[2px] shadow-xs cursor-ew-resize hover:scale-150 z-50 transition-transform after:absolute after:-inset-2 touch-none after:content-['']"
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status footer bar below canvas */}
              <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400 px-1 font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Kanvas: {canvasW} × {canvasH} px</span>
                </div>
                <div>
                  {activeEditorMode === 'image' ? (
                    <span className="text-cyan-300 font-bold">
                      🖼️ Desain: {imageWidth}×{imageHeight} px di ({imageX}, {imageY})
                      {isImageMirror ? ` • ⚡ Mirror di (${mirrorImageX}, ${mirrorImageY})` : ''}
                    </span>
                  ) : selectedSlot ? (
                    <span className="text-rose-300">
                      Slot #{safeSelectedIdx + 1}: {selectedSlot.width} × {selectedSlot.height} px di ({selectedSlot.x}, {selectedSlot.y})
                    </span>
                  ) : (
                    <span>Pilih slot untuk mengedit</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Precision Controls Panel */}
          <div className="w-full lg:w-[440px] xl:w-[480px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800/80 p-3.5 sm:p-4 overflow-y-auto custom-scrollbar shrink-0 flex flex-col gap-3 text-white">
            {/* Tab Navigation: Frame & Kertas vs Slot Foto & Gaya */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 shrink-0 sticky top-0 z-20 backdrop-blur-md shadow-xs">
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === 'frame'}
                onClick={() => setSidebarTab('frame')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  sidebarTab === 'frame'
                    ? 'bg-rose-500 text-white shadow-md ring-1 ring-rose-400/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <ImageIcon size={14} />
                <span>Frame & Kertas</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === 'slots'}
                onClick={() => setSidebarTab('slots')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  sidebarTab === 'slots'
                    ? 'bg-rose-500 text-white shadow-md ring-1 ring-rose-400/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <LayoutGrid size={14} />
                <span>Slot Foto & Gaya</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  sidebarTab === 'slots'
                    ? 'bg-rose-700/80 text-white border border-rose-300/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {activeSlots.length}
                </span>
              </button>
            </div>

            {/* TAB 1: Frame & Kertas */}
            <div className={`flex flex-col gap-3 ${sidebarTab === 'frame' ? '' : 'hidden'}`}>
              {/* Ukuran Kertas & Orientasi Frame */}
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800/80 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <FileText size={13} className="text-rose-400" />
                  <span>Ukuran Kertas Frame:</span>
                </label>
                <span className="text-[10px] text-rose-300 font-mono bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30">
                  {canvasW} × {canvasH} px
                </span>
              </div>

              {/* Pilihan Ukuran Kertas Frame - Custom Combobox Dropdown */}
              <div ref={paperDropdownRef} className="relative">
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={isPaperDropdownOpen}
                  aria-haspopup="listbox"
                  aria-label="Pilih Ukuran Kertas Frame"
                  onClick={() => setIsPaperDropdownOpen((prev) => !prev)}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                    isPaperDropdownOpen
                      ? 'border-rose-500 bg-slate-800 ring-1 ring-rose-500/40 shadow-md'
                      : 'border-slate-700/80 bg-slate-800/90 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                      {paperPreset.id === 'image' ? <Sparkles size={14} className="text-amber-400" /> : <FileText size={14} />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-white flex items-center gap-1.5 truncate">
                        <span>{paperPreset.name || paperPreset.label}</span>
                        <span className="text-[10px] font-semibold text-rose-300 bg-rose-500/20 px-1.5 py-0.2 rounded border border-rose-500/30">
                          {paperPreset.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {paperPreset.id === 'image'
                          ? (customFrame?.imageUrl ? `Auto Resolusi: ${canvasW} × ${canvasH} px` : 'Ukuran kertas mengikuti gambar desain frame yang diupload')
                          : `${paperPreset.desc} (${paperPreset.widthMm}×${paperPreset.heightMm} mm)`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[10px] font-mono text-slate-400 hidden sm:inline bg-slate-900/60 px-2 py-0.5 rounded border border-slate-700/60">
                      {paperPreset.id === 'image'
                        ? 'Ikuti Frame'
                        : `${paperPreset.widthMm}×${paperPreset.heightMm} mm`}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform duration-200 ${
                        isPaperDropdownOpen ? 'rotate-180 text-rose-400' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Dropdown Options List */}
                <div
                  role="listbox"
                  className={`absolute top-full left-0 right-0 mt-1.5 z-50 bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl p-1.5 space-y-1 backdrop-blur-md transition-all ${
                    isPaperDropdownOpen
                      ? 'opacity-100 scale-100 pointer-events-auto block'
                      : 'opacity-0 scale-95 pointer-events-none hidden'
                  }`}
                >
                  {Object.values(PAPER_PRESETS).map((preset) => {
                    const isSelected = (customFrame?.paperSize || '4R') === preset.id;
                    const isImagePreset = preset.id === 'image';
                    let dimLabel = `${preset.widthMm}×${preset.heightMm} mm`;
                    if (isImagePreset) {
                      dimLabel = customFrame?.imageUrl ? `${canvasW}×${canvasH} px` : 'Auto Desain';
                    }

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          handlePaperSizeChange(preset.id);
                          setIsPaperDropdownOpen(false);
                        }}
                        className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-rose-500 bg-rose-500/20 text-white font-bold ring-1 ring-rose-500/40'
                            : 'border-transparent bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs ${
                              isSelected
                                ? 'bg-rose-500 text-white'
                                : 'border border-slate-700 text-transparent'
                            }`}
                          >
                            <Check size={12} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold flex items-center gap-1.5">
                              {isImagePreset && <Sparkles size={11} className="text-amber-400 shrink-0" />}
                              <span>{preset.name}</span>
                              <span className="text-[10px] font-normal text-slate-400">
                                ({preset.label})
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                              {preset.desc}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-[10px] font-mono bg-slate-900/80 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                            {dimLabel}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] font-bold text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                              Terpilih
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Orientasi (Portrait / Landscape) or Info Kanvas Mengikuti Gambar */}
              {paperPreset.id === 'image' ? (
                <div className="p-2 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between text-[11px] text-slate-300">
                  <span className="flex items-center gap-1.5 font-semibold text-rose-300">
                    <Sparkles size={12} className="text-rose-400 shrink-0" />
                    <span>Resolusi Mengikuti Gambar Frame</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                    {canvasW} × {canvasH} px ({isLandscape ? 'Landscape' : 'Portrait'})
                  </span>
                </div>
              ) : paperPreset.hasOrientation ? (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => handleOrientationChange('portrait')}
                    className={`p-2 rounded-xl border text-center text-xs transition-all cursor-pointer ${
                      !isLandscape
                        ? 'border-rose-500 bg-rose-500/20 text-white font-extrabold shadow-sm ring-1 ring-rose-400/50'
                        : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-extrabold text-[11px]">Portrait (Tegak)</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      {paperPreset.portrait.width} × {paperPreset.portrait.height} px
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOrientationChange('landscape')}
                    className={`p-2 rounded-xl border text-center text-xs transition-all cursor-pointer ${
                      isLandscape
                        ? 'border-rose-500 bg-rose-500/20 text-white font-extrabold shadow-sm ring-1 ring-rose-400/50'
                        : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-extrabold text-[11px]">Landscape (Mendatar)</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      {paperPreset.landscape.width} × {paperPreset.landscape.height} px
                    </div>
                  </button>
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-slate-800/70 border border-slate-700/60 text-center text-[11px] text-slate-300">
                  Format Persegi (1:1 Kotak) — Orientasi Simetris ({paperPreset.portrait.width} × {paperPreset.portrait.height} px)
                </div>
              )}
            </div>

            {/* Upload File Desain Frame (PNG / JPG) */}
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800/80 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-200 font-bold flex items-center gap-1.5">
                  <ImageIcon size={14} className="text-rose-400" />
                  File Desain Frame (PNG Transparan / JPG):
                </span>
                {customFrame?.imageUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      const oldUrl = customFrame.imageUrl;
                      onUpdateFrame({ imageUrl: '' });
                      if (oldUrl && (oldUrl.includes('/uploads/') || oldUrl.startsWith('frame_'))) {
                        try {
                          const endpoint = resolveApiUrl('/api/config/frame');
                          await fetch(endpoint, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              frameId: customFrame.id,
                              imageUrl: oldUrl
                            })
                          });
                        } catch (err) {
                          console.warn('Failed to delete frame file from store:', err);
                        }
                      }
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Trash2 size={11} /> Hapus File
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />

              {customFrame?.imageUrl ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 p-2 bg-slate-800/80 rounded-xl border border-slate-700">
                    <img
                      src={customFrame.imageUrl}
                      alt="Frame Preview"
                      className={`w-12 object-contain rounded-lg border border-slate-700 bg-slate-950 shrink-0 ${
                        isLandscape ? 'aspect-[3/2]' : (paperPreset.hasOrientation ? 'aspect-[2/3]' : 'aspect-square')
                      }`}
                    />
                    <div className="text-xs text-slate-200 font-medium truncate flex-1">
                      <div className="truncate">{customFrame.imageUrl.split('/').pop()}</div>
                      {(customFrame?.frameNaturalWidth || 0) > 0 && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Resolusi asli: {customFrame.frameNaturalWidth} × {customFrame.frameNaturalHeight} px
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="px-2.5 py-1 text-xs font-bold bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 cursor-pointer"
                    >
                      Ganti File
                    </button>
                  </div>

                  {customFrame?.paperSize !== 'image' && (
                    <button
                      type="button"
                      onClick={() => handlePaperSizeChange('image')}
                      className="w-full py-1.5 px-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-[11px] text-amber-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      title="Ubah ukuran kertas kanvas agar persis sama dengan resolusi gambar frame ini"
                    >
                      <Sparkles size={12} className="text-amber-400" />
                      <span>Ubah Kertas Mengikuti Gambar Ini ({customFrame.frameNaturalWidth ? `${customFrame.frameNaturalWidth}×${customFrame.frameNaturalHeight} px` : 'Resolusi Gambar'})</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full py-2.5 px-3 border border-dashed border-rose-500/50 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-rose-400" />
                      <span>Mengunggah file frame...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} className="text-rose-400" />
                      <span>Unggah Desain Frame ({paperPreset.label})</span>
                    </>
                  )}
                </button>
              )}

              {uploadError && (
                <div className="text-[11px] text-rose-400 font-semibold">{uploadError}</div>
              )}

              {/* Pengaturan Geser & Mirror Gambar Desain Frame (Anti-Stretch) */}
              {customFrame?.imageUrl && (
                <div className="mt-3 pt-3 border-t border-slate-700/80 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <MoveHorizontal size={14} className="text-cyan-400" />
                      <span>Tata Letak Desain Frame (Anti-Stretch):</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveEditorMode(activeEditorMode === 'image' ? 'slots' : 'image')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                        activeEditorMode === 'image'
                          ? 'bg-cyan-500 text-white shadow-xs'
                          : 'bg-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      {activeEditorMode === 'image' ? '✓ Mode Geser Aktif' : 'Aktifkan Drag Kanvas'}
                    </button>
                  </div>

                  {/* Preset Cepat Ukuran Desain (Anti-Stretch) */}
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateFrame({
                          imageX: 0,
                          imageY: 0,
                          imageWidth: Math.round(canvasW / 2),
                          imageHeight: canvasH,
                          imageMirror: true,
                          mirrorImageX: Math.round(canvasW / 2),
                          mirrorImageY: 0,
                          mirrorImageWidth: Math.round(canvasW / 2),
                          mirrorImageHeight: canvasH,
                          mirrorImageFlip: false
                        });
                      }}
                      className={`p-2 rounded-lg text-left cursor-pointer transition-all border ${
                        is2StripLayoutSelected
                          ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/50 shadow-sm font-bold'
                          : 'border-slate-700/80 bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200'
                      }`}
                      title="Paskan desain 1 strip photobooth di kolom kiri (600x1800) dan aktifkan mirror kembar di kolom kanan (600x1800)"
                    >
                      <div className="font-bold flex items-center justify-between gap-1 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Columns size={12} className={is2StripLayoutSelected ? 'text-cyan-400' : 'text-slate-400'} />
                          <span>{paperPreset.id === '4R' ? '2 Strip (600 × 1800)' : `2 Strip (${Math.round(canvasW / 2)} × ${canvasH})`}</span>
                        </div>
                        {is2StripLayoutSelected && (
                          <span className="text-[9px] bg-cyan-500 text-slate-950 font-extrabold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                            <Check size={9} /> Terpilih
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Anti-stretch + Mirror Kanan</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateFrame({
                          imageX: 0,
                          imageY: 0,
                          imageWidth: canvasW,
                          imageHeight: canvasH,
                          imageMirror: false
                        });
                      }}
                      className={`p-2 rounded-lg text-left cursor-pointer transition-all border ${
                        isFullLayoutSelected
                          ? 'border-rose-500 bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/50 shadow-sm font-bold'
                          : 'border-slate-700/80 bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200'
                      }`}
                      title="Penuh 1 lembar kanvas (Full Layar)"
                    >
                      <div className="font-bold flex items-center justify-between gap-1 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Maximize2 size={12} className={isFullLayoutSelected ? 'text-rose-400' : 'text-slate-400'} />
                          <span>{paperPreset.id === '4R' ? 'Penuh 4R (1200 × 1800)' : `Penuh Frame (${canvasW} × ${canvasH})`}</span>
                        </div>
                        {isFullLayoutSelected && (
                          <span className="text-[9px] bg-rose-500 text-white font-extrabold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                            <Check size={9} /> Terpilih
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">1 Lembar Penuh (Full Layar)</div>
                    </button>
                  </div>

                  {/* Kontrol Geser Gambar Utama */}
                  <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-cyan-300 flex items-center gap-1">
                        <ImageIcon size={12} />
                        <span>Posisi Desain Utama:</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-300">
                        X: {imageX} | Y: {imageY} ({imageWidth}×{imageHeight}px)
                      </span>
                    </div>

                    {/* Sliders X & Y */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <div className="flex justify-between text-slate-400 mb-0.5">
                          <span>Posisi X:</span>
                          <span className="font-mono text-cyan-300">{imageX}px</span>
                        </div>
                        <input
                          type="range"
                          min="-600"
                          max={canvasW}
                          value={imageX}
                          onChange={(e) => onUpdateFrame({ imageX: Number(e.target.value) })}
                          className="w-full accent-cyan-400"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-slate-400 mb-0.5">
                          <span>Posisi Y:</span>
                          <span className="font-mono text-cyan-300">{imageY}px</span>
                        </div>
                        <input
                          type="range"
                          min="-600"
                          max={canvasH}
                          value={imageY}
                          onChange={(e) => onUpdateFrame({ imageY: Number(e.target.value) })}
                          className="w-full accent-cyan-400"
                        />
                      </div>
                    </div>

                    {/* Tombol Nudge / Geser Presisi */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">Geser Presisi:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onUpdateFrame({ imageX: imageX - 10 })}
                          className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer"
                          title="Geser Kiri 10px"
                        >
                          <ArrowLeft size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateFrame({ imageX: imageX + 10 })}
                          className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer"
                          title="Geser Kanan 10px"
                        >
                          <ArrowRight size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateFrame({ imageY: imageY - 10 })}
                          className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer"
                          title="Geser Atas 10px"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateFrame({ imageY: imageY + 10 })}
                          className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer"
                          title="Geser Bawah 10px"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateFrame({ imageX: 0 })}
                          className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer"
                          title="Ratakan Kiri"
                        >
                          X:0
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateFrame({ imageX: Math.round((canvasW - imageWidth) / 2) })}
                          className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer"
                          title="Pusatkan Horizontal"
                        >
                          Tengah
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Kontrol Fitur Mirror Gambar Frame */}
                  <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5 cursor-pointer">
                        <FlipHorizontal size={13} />
                        <span>Fitur Mirror Gambar Frame (Duplikat Strip):</span>
                      </label>
                      <input
                        type="checkbox"
                        checked={isImageMirror}
                        onChange={(e) => {
                          const enable = e.target.checked;
                          onUpdateFrame({
                            imageMirror: enable,
                            mirrorImageX: enable ? (canvasW - imageWidth) : mirrorImageX,
                            mirrorImageY: enable ? imageY : mirrorImageY,
                            mirrorImageWidth: imageWidth,
                            mirrorImageHeight: imageHeight
                          });
                        }}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                    </div>

                    {isImageMirror && (
                      <div className="space-y-2 pt-1 border-t border-slate-800">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Posisi & Geser Mirror:</span>
                          <span className="font-mono text-amber-300">
                            X: {mirrorImageX} | Y: {mirrorImageY}
                          </span>
                        </div>

                        {/* Sliders X & Y Mirror */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <div className="flex justify-between text-slate-400 mb-0.5">
                              <span>Posisi X Mirror:</span>
                              <span className="font-mono text-amber-300">{mirrorImageX}px</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max={canvasW}
                              value={mirrorImageX}
                              onChange={(e) => onUpdateFrame({ mirrorImageX: Number(e.target.value) })}
                              className="w-full accent-amber-400"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-slate-400 mb-0.5">
                              <span>Posisi Y Mirror:</span>
                              <span className="font-mono text-amber-300">{mirrorImageY}px</span>
                            </div>
                            <input
                              type="range"
                              min="-600"
                              max={canvasH}
                              value={mirrorImageY}
                              onChange={(e) => onUpdateFrame({ mirrorImageY: Number(e.target.value) })}
                              className="w-full accent-amber-400"
                            />
                          </div>
                        </div>

                        {/* Nudge & Quick Align Mirror */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onUpdateFrame({ mirrorImageX: mirrorImageX - 10 })}
                              className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer"
                              title="Geser Kiri Mirror 10px"
                            >
                              <ArrowLeft size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateFrame({ mirrorImageX: mirrorImageX + 10 })}
                              className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer"
                              title="Geser Kanan Mirror 10px"
                            >
                              <ArrowRight size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateFrame({ mirrorImageY: mirrorImageY - 10 })}
                              className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer"
                              title="Geser Atas Mirror 10px"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateFrame({ mirrorImageY: mirrorImageY + 10 })}
                              className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer"
                              title="Geser Bawah Mirror 10px"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onUpdateFrame({ mirrorImageX: canvasW - imageWidth, mirrorImageY: imageY })}
                              className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded cursor-pointer"
                              title="Set posisi mirror simetris di sisi kanan kanvas"
                            >
                              Simetris Kanan
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateFrame({ mirrorImageFlip: !mirrorImageFlip })}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                                mirrorImageFlip
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-slate-800 text-slate-300 hover:text-white'
                              }`}
                              title="Balik gambar mirror secara horizontal (cermin) vs identik (kembar)"
                            >
                              {mirrorImageFlip ? 'Flip Horiz (✓)' : 'Flip Horiz'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Mode Lapisan & Transparansi Mapping */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium flex items-center gap-1">
                    <Layers size={13} className="text-slate-400" />
                    Transparansi Frame Saat Mapping:
                  </span>
                  <span className="font-bold text-rose-300">{frameOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={frameOpacity}
                  onChange={(e) => setFrameOpacity(Number(e.target.value))}
                  className="w-full accent-rose-500"
                />

                <div className="flex items-center justify-between pt-0.5 text-[11px] text-slate-400">
                  <span>Mode Lapisan Desain:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onUpdateFrame({ layerMode: 'background' })}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer font-bold text-xs transition-colors ${
                        customFrame?.layerMode !== 'overlay'
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                      title="Frame berada di bawah foto (JPG Canva)"
                    >
                      Latar Belakang (JPG)
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateFrame({ layerMode: 'overlay' })}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer font-bold text-xs transition-colors ${
                        customFrame?.layerMode === 'overlay'
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                      title="Frame transparan berada di atas foto (PNG Transparan)"
                    >
                      Overlay (PNG)
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* TAB 2: Slot Foto & Gaya */}
            <div className={`flex flex-col gap-3 ${sidebarTab === 'slots' ? '' : 'hidden'}`}>
              {/* Daftar Slot Foto & Toolbar Aksi (Simple & Informatif) */}
            <div className="p-3 sm:p-3.5 bg-slate-800/40 rounded-xl border border-slate-800/80 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold text-slate-300">
                <div className="flex items-center gap-1.5">
                  <LayoutGrid size={14} className="text-rose-400" />
                  <span>Daftar Slot Foto ({activeSlots.length} slot)</span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Tambah Slot Baru */}
                  <button
                    type="button"
                    onClick={addSlot}
                    disabled={activeSlots.length >= 12}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs flex items-center gap-1 font-semibold cursor-pointer transition-colors shadow-xs active:scale-95"
                    title="Tambah slot baru di area tampilan kanvas yang sedang terlihat"
                  >
                    <Plus size={12} />
                    <span>Slot</span>
                  </button>

                  {/* Copy Slot */}
                  <button
                    type="button"
                    onClick={copySelectedSlot}
                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-slate-200 hover:text-white rounded-lg text-xs flex items-center gap-1 font-medium cursor-pointer transition-colors shadow-xs"
                    title="Salin slot terpilih (Shortcut: Ctrl + C)"
                  >
                    <Copy size={11} />
                    <span>Salin</span>
                  </button>

                  {/* Paste Slot */}
                  <button
                    type="button"
                    onClick={pasteSlot}
                    disabled={activeSlots.length >= 12}
                    className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 font-medium cursor-pointer transition-colors shadow-xs ${
                      clipboardSlot
                        ? "bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                        : "bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white"
                    }`}
                    title="Tempel slot di area tampilan kanvas yang terlihat (Shortcut: Ctrl + V)"
                  >
                    <ClipboardPaste size={11} />
                    <span>Tempel</span>
                  </button>

                  {/* Mirror Slot */}
                  <button
                    type="button"
                    onClick={() => addMirrorSlot(safeSelectedIdx)}
                    disabled={activeSlots.length >= 12}
                    className="px-2 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg text-xs flex items-center gap-1 font-semibold cursor-pointer transition-colors shadow-xs active:scale-95"
                    title={`Buat slot baru yang mirror dari foto Slot #${safeSelectedIdx + 1}`}
                  >
                    <Sparkles size={11} />
                    <span>Mirror</span>
                  </button>
                </div>
              </div>

              {/* Toast Feedback */}
              {toastMessage && (
                <div className="py-1 px-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 animate-fade-in">
                  <Check size={13} />
                  <span>{toastMessage}</span>
                </div>
              )}

              {/* Slot Cards Grid (Compact: [Icon] | Slot #X with Absolute Top-Right Badge for Mirror) */}
              <div className="grid grid-cols-4 gap-2 pt-1.5 pb-0.5">
                {activeSlots.map((s, idx) => {
                  const isMirrored = s.mirrorFromSlot !== null && s.mirrorFromSlot !== undefined;
                  const mirrorSrc = isMirrored ? Number(s.mirrorFromSlot) : null;
                  const isSelected = idx === safeSelectedIdx;
                  return (
                    <button
                      key={`slot-card-${s.id !== undefined && s.id !== null ? s.id : idx}-${idx}`}
                      type="button"
                      onClick={() => setSelectedSlotIndex(idx)}
                      className={`relative py-1.5 px-1.5 rounded-lg border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold select-none ${
                        isSelected
                          ? "bg-rose-600 border-rose-500 text-white shadow-md ring-2 ring-rose-400/50"
                          : isMirrored
                          ? "bg-slate-800/90 hover:bg-slate-700/90 border-amber-400 text-slate-200 hover:border-amber-300"
                          : "bg-slate-800/90 hover:bg-slate-700/90 border-slate-700/80 text-slate-300"
                      }`}
                    >
                      {/* Badge mirror absolute di kanan atas */}
                      {isMirrored && (
                        <span
                          title={`Mirror dari Slot #{mirrorSrc + 1}`}
                          className="absolute -top-2 -right-1 px-1.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[9px] rounded-full shadow-xs leading-none ring-2 ring-slate-900 flex items-center justify-center z-10"
                        >
                          #${mirrorSrc + 1}
                        </span>
                      )}

                      {/* Icon pembeda mirror vs foto */}
                      {isMirrored ? (
                        <Sparkles
                          size={12}
                          className={`shrink-0 ${isSelected ? "text-white fill-white" : "text-amber-400 fill-amber-400"}`}
                        />
                      ) : (
                        <Camera
                          size={12}
                          className={`shrink-0 ${isSelected ? "text-white" : "text-slate-400"}`}
                        />
                      )}

                      {/* Pemisah | */}
                      <span className={`text-[11px] leading-none opacity-40 ${isSelected ? "text-white" : "text-slate-400"}`}>
                        |
                      </span>

                      {/* Label Slot */}
                      <span className="leading-none whitespace-nowrap">
                        Slot #{idx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Slot Inspector (Unified Clean Layout - No Excessive Nested Cards) */}
            {selectedSlot ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="font-bold text-sm text-white">
                      Pengaturan Slot #{safeSelectedIdx + 1}
                    </span>
                  </div>
                  {activeSlots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSlot(safeSelectedIdx)}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/20 border border-red-500/30 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>Hapus Slot</span>
                    </button>
                  )}
                </div>

                {/* Sumber Foto / Mirror Slot untuk Slot Ini */}
                {(() => {
                  const isMirrored = selectedSlot.mirrorFromSlot !== null && selectedSlot.mirrorFromSlot !== undefined;
                  const mirrorSourceIdx = isMirrored ? Number(selectedSlot.mirrorFromSlot) : null;
                  const currentPIdx = getSlotPhotoIndex(selectedSlot, safeSelectedIdx);
                  const otherSlots = activeSlots
                    .map((s, idx) => ({ slot: s, idx }))
                    .filter((item) => item.idx !== safeSelectedIdx);

                  return (
                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200 flex items-center gap-1.5">
                          <Camera size={13} className="text-rose-400" />
                          <span>Sumber Pose Kamera / Foto:</span>
                        </span>
                        {isMirrored ? (
                          <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                            ⚡ Mirror dari Slot #{mirrorSourceIdx + 1}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            📷 Foto Mandiri (Pose #{currentPIdx + 1})
                          </span>
                        )}
                      </div>

                      {/* Tombol Buat Slot Baru yang Mirror dari Slot Ini */}
                      <button
                        type="button"
                        onClick={() => addMirrorSlot(safeSelectedIdx)}
                        disabled={activeSlots.length >= 12}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-40 disabled:hover:bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
                        title={activeSlots.length >= 12 ? "Maksimal 12 slot frame telah tercapai" : `Buat slot baru yang mengambil foto dari Slot #${safeSelectedIdx + 1}`}
                      >
                        <Sparkles size={12} />
                        <span>Buat Slot Baru (Mirror dari Slot #{safeSelectedIdx + 1})</span>
                      </button>

                      {/* Mode Pilihan: Foto Mandiri VS Mirror Dari Slot Lain */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-bold text-slate-300">Pilih Sumber Foto Slot #{safeSelectedIdx + 1}:</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSlotMirrorSource(safeSelectedIdx, null)}
                            className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              !isMirrored
                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            <span>📷 Foto Mandiri</span>
                          </button>

                          {otherSlots.length > 0 && (
                            <div className="relative">
                              <select
                                value={isMirrored ? mirrorSourceIdx : ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSlotMirrorSource(safeSelectedIdx, val === "" ? null : Number(val));
                                }}
                                className={`w-full py-1.5 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer appearance-none ${
                                  isMirrored
                                    ? 'bg-amber-600 border-amber-500 text-white shadow-xs'
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                }`}
                              >
                                <option value="" disabled className="bg-slate-900 text-slate-400">
                                  ⚡ Mirror Slot...
                                </option>
                                {otherSlots.map((item) => (
                                  <option key={`mirror-opt-${item.idx}`} value={item.idx} className="bg-slate-900 text-white">
                                    Mirror dari Slot #{item.idx + 1}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Quick Buttons: Ambil dari Slot 1, 2, 3 ... */}
                        {otherSlots.length > 0 && (
                          <div className="pt-1">
                            <div className="text-[10px] text-slate-400 mb-1">Ambil langsung dari slot:</div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {otherSlots.map((item) => {
                                const isTarget = isMirrored && mirrorSourceIdx === item.idx;
                                return (
                                  <button
                                    key={`quick-mirror-${item.idx}`}
                                    type="button"
                                    onClick={() => setSlotMirrorSource(safeSelectedIdx, item.idx)}
                                    className={`py-1 px-2 rounded border text-xs font-bold cursor-pointer transition-all ${
                                      isTarget
                                        ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-xs'
                                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                                    }`}
                                  >
                                    Slot #{item.idx + 1}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Quick Alignment Helpers */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateSelectedSlot('x', Math.round((canvasW - selectedSlot.width) / 2))
                    }
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold border border-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Tengah Horizontal (X)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSelectedSlot('y', Math.round((canvasH - selectedSlot.height) / 2))
                    }
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold border border-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Tengah Vertikal (Y)</span>
                  </button>
                </div>

                {/* Line 1 (2 Kolom): Lebar & Tinggi */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* Kolom 1: Lebar / Width */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-300">Lebar / Width</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="50"
                          max={canvasW - selectedSlot.x}
                          value={selectedSlot.width}
                          onChange={(e) => updateSelectedSlot('width', e.target.value)}
                          className="w-16 px-1.5 py-0.5 text-right font-mono font-bold text-xs bg-slate-800 text-white border border-slate-700 rounded focus:border-rose-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">px</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max={canvasW - selectedSlot.x}
                      value={selectedSlot.width}
                      onChange={(e) => updateSelectedSlot('width', e.target.value)}
                      className="w-full accent-rose-500 my-0.5"
                    />
                    <div className="flex items-center justify-between gap-0.5 text-[9px] font-bold">
                      {[-10, -5, -1, 1, 5, 10].map((step) => (
                        <button
                          key={`w-step-${step}`}
                          type="button"
                          onClick={() =>
                            updateSelectedSlot(
                              'width',
                              step < 0
                                ? Math.max(50, selectedSlot.width + step)
                                : Math.min(canvasW - selectedSlot.x, selectedSlot.width + step)
                            )
                          }
                          className="flex-1 py-1 px-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer text-center"
                        >
                          {step > 0 ? `+${step}` : step}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kolom 2: Tinggi / Height */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-300">Tinggi / Height</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="50"
                          max={canvasH - selectedSlot.y}
                          value={selectedSlot.height}
                          onChange={(e) => updateSelectedSlot('height', e.target.value)}
                          className="w-16 px-1.5 py-0.5 text-right font-mono font-bold text-xs bg-slate-800 text-white border border-slate-700 rounded focus:border-rose-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">px</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max={canvasH - selectedSlot.y}
                      value={selectedSlot.height}
                      onChange={(e) => updateSelectedSlot('height', e.target.value)}
                      className="w-full accent-rose-500 my-0.5"
                    />
                    <div className="flex items-center justify-between gap-0.5 text-[9px] font-bold">
                      {[-10, -5, -1, 1, 5, 10].map((step) => (
                        <button
                          key={`h-step-${step}`}
                          type="button"
                          onClick={() =>
                            updateSelectedSlot(
                              'height',
                              step < 0
                                ? Math.max(50, selectedSlot.height + step)
                                : Math.min(canvasH - selectedSlot.y, selectedSlot.height + step)
                            )
                          }
                          className="flex-1 py-1 px-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer text-center"
                        >
                          {step > 0 ? `+${step}` : step}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Line 2 (2 Kolom): Posisi X & Posisi Y */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* Kolom 1: Posisi X (Jarak Kiri) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-300">Posisi X (Kiri)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max={canvasW - selectedSlot.width}
                          value={selectedSlot.x}
                          onChange={(e) => updateSelectedSlot('x', e.target.value)}
                          className="w-16 px-1.5 py-0.5 text-right font-mono font-bold text-xs bg-slate-800 text-white border border-slate-700 rounded focus:border-rose-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">px</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={canvasW - selectedSlot.width}
                      value={selectedSlot.x}
                      onChange={(e) => updateSelectedSlot('x', e.target.value)}
                      className="w-full accent-rose-500 my-0.5"
                    />
                    <div className="flex items-center justify-between gap-0.5 text-[9px] font-bold">
                      {[-10, -5, -1, 1, 5, 10].map((step) => (
                        <button
                          key={`x-step-${step}`}
                          type="button"
                          onClick={() =>
                            updateSelectedSlot(
                              'x',
                              step < 0
                                ? Math.max(0, selectedSlot.x + step)
                                : Math.min(canvasW - selectedSlot.width, selectedSlot.x + step)
                            )
                          }
                          className="flex-1 py-1 px-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer text-center"
                        >
                          {step > 0 ? `+${step}` : step}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kolom 2: Posisi Y (Jarak Atas) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-300">Posisi Y (Atas)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max={canvasH - selectedSlot.height}
                          value={selectedSlot.y}
                          onChange={(e) => updateSelectedSlot('y', e.target.value)}
                          className="w-16 px-1.5 py-0.5 text-right font-mono font-bold text-xs bg-slate-800 text-white border border-slate-700 rounded focus:border-rose-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">px</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={canvasH - selectedSlot.height}
                      value={selectedSlot.y}
                      onChange={(e) => updateSelectedSlot('y', e.target.value)}
                      className="w-full accent-rose-500 my-0.5"
                    />
                    <div className="flex items-center justify-between gap-0.5 text-[9px] font-bold">
                      {[-10, -5, -1, 1, 5, 10].map((step) => (
                        <button
                          key={`y-step-${step}`}
                          type="button"
                          onClick={() =>
                            updateSelectedSlot(
                              'y',
                              step < 0
                                ? Math.max(0, selectedSlot.y + step)
                                : Math.min(canvasH - selectedSlot.height, selectedSlot.y + step)
                            )
                          }
                          className="flex-1 py-1 px-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer text-center"
                        >
                          {step > 0 ? `+${step}` : step}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Gaya: Sudut Melengkung & Garis Border (2 Kolom) */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Lengkung Sudut */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                        <span>Radius:</span>
                        <span className="text-rose-400 font-bold">{selectedSlot.radius ?? 0} px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="60"
                        value={selectedSlot.radius ?? 0}
                        onChange={(e) => updateSelectedSlot('radius', e.target.value)}
                        className="w-full accent-rose-500 my-0.5"
                      />
                      <div className="flex items-center gap-0.5 text-[9px] font-bold">
                        {[0, 8, 16, 24, 32].map((rad) => (
                          <button
                            key={rad}
                            type="button"
                            onClick={() => updateSelectedSlot('radius', rad)}
                            className={`flex-1 py-1 rounded border cursor-pointer text-center ${
                              (selectedSlot.radius ?? 0) === rad
                                ? 'bg-rose-500 border-rose-400 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {rad === 0 ? 'Siku' : `${rad}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tebal Garis Bingkai */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                        <span>Tebal Garis:</span>
                        <span className="text-rose-400 font-bold">{selectedSlot.borderWidth ?? 0} px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="24"
                        value={selectedSlot.borderWidth ?? 0}
                        onChange={(e) => updateSelectedSlot('borderWidth', e.target.value)}
                        className="w-full accent-rose-500 my-0.5"
                      />
                      <div className="flex items-center gap-0.5 text-[9px] font-bold">
                        {[0, 2, 4, 8, 12].map((bw) => (
                          <button
                            key={bw}
                            type="button"
                            onClick={() => updateSelectedSlot('borderWidth', bw)}
                            className={`flex-1 py-1 rounded border cursor-pointer text-center ${
                              (selectedSlot.borderWidth ?? 0) === bw
                                ? 'bg-rose-500 border-rose-400 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {bw === 0 ? 'Polos' : `${bw}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Warna Border */}
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-300 font-semibold text-[11px]">Warna Garis:</span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { name: 'Putih', hex: '#FFFFFF' },
                        { name: 'Hitam', hex: '#000000' },
                        { name: 'Emas', hex: '#EAB308' },
                        { name: 'Rose', hex: '#F43F5E' },
                        { name: 'Abu', hex: '#64748B' }
                      ].map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => updateSelectedSlot('borderColor', c.hex)}
                          style={{ backgroundColor: c.hex }}
                          className={`w-4.5 h-4.5 rounded-full border cursor-pointer transition-transform ${
                            (selectedSlot.borderColor || '#FFFFFF').toUpperCase() === c.hex
                              ? 'ring-2 ring-rose-500 scale-110 border-white'
                              : 'border-slate-500 hover:scale-105'
                          }`}
                          title={c.name}
                        />
                      ))}
                      <input
                        type="color"
                        value={selectedSlot.borderColor || '#FFFFFF'}
                        onChange={(e) => updateSelectedSlot('borderColor', e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Batch Actions */}
                {activeSlots.length > 1 && (
                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs font-bold">
                    <button
                      type="button"
                      onClick={applySizeToAllSlots}
                      className="py-2 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Terapkan Width & Height slot ini ke semua slot"
                    >
                      <Copy size={13} />
                      <span>Samakan Ukuran</span>
                    </button>
                    <button
                      type="button"
                      onClick={applyStyleToAllSlots}
                      className="py-2 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Terapkan Radius & Border slot ini ke semua slot"
                    >
                      <Copy size={13} />
                      <span>Samakan Garis</span>
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {/* Keyboard shortcut tip */}
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <span>💡 Shortcut Keyboard:</span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-300 font-mono">
                <div><span className="text-white bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Ctrl + Z</span> : Undo</div>
                <div><span className="text-white bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Ctrl + Shift + Z</span> : Redo</div>
                <div><span className="text-white bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Ctrl + Scroll</span> : Zoom Kanvas</div>
                <div><span className="text-white bg-slate-800 px-1 py-0.5 rounded border border-slate-700">↑ ↓ ← →</span> : Geser 1px</div>
                <div><span className="text-white bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Ctrl + C</span> : Salin Slot</div>
                <div><span className="text-white bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Ctrl + V</span> : Tempel Slot</div>
                <div><span className="text-white bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Ctrl + D</span> : Duplikat Slot</div>
                <div><span className="text-white bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Shift + Panah</span> : Geser 10px</div>
                <div><span className="text-white bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Delete</span> : Hapus Slot</div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
}
