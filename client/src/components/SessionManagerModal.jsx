import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  RefreshCw,
  Printer,
  Download,
  QrCode,
  Trash2,
  Eye,
  Calendar,
  Layers,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Camera,
  FolderArchive,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  HardDrive,
  ArrowLeft,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { resolveApiUrl } from '../utils/apiConfig.js';
import { bluetoothPrinter } from '../utils/bluetoothPrinter.js';

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch (_) {
    return dateStr;
  }
}

export default function SessionManagerModal({
  isOpen,
  onClose,
  printerConfig = {}
}) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all' | 'today' | 'week'
  
  // Sub-modal states
  const [previewPhoto, setPreviewPhoto] = useState(null); // active session being previewed
  const [previewActiveIndex, setPreviewActiveIndex] = useState(0);
  const [qrModalData, setQrModalData] = useState(null); // { url, qrCodeDataUri, filename, sessionId }
  const [deleteConfirmSession, setDeleteConfirmSession] = useState(null); // session object to confirm delete
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [printStatusMap, setPrintStatusMap] = useState({}); // sessionId -> 'printing' | 'success' | 'error'
  const [copiedLink, setCopiedLink] = useState(false);

  // Print Choice states (1:1 with PreviewResult)
  const [printChoiceSession, setPrintChoiceSession] = useState(null);
  const [isPrintChoiceOpen, setIsPrintChoiceOpen] = useState(false);
  const [printMode, setPrintMode] = useState('frame'); // 'frame' | 'raw'
  const [selectedPoseIndices, setSelectedPoseIndices] = useState([]);
  const [printStatus, setPrintStatus] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleOpenPreview = (session, initialIndex = 0) => {
    setPreviewPhoto(session);
    setPreviewActiveIndex(initialIndex);
    setPrintStatus(null);
    setPrintMode('frame');
    const poses = Array.isArray(session?.photos) ? session.photos : [];
    setSelectedPoseIndices(poses.length > 0 ? poses.map((_, i) => i) : [0]);
  };

  const previewItems = useMemo(() => {
    if (!previewPhoto) return [];
    const items = [];
    if (previewPhoto.compositeUrl) {
      items.push({
        type: 'composite',
        label: 'Full Frame',
        url: previewPhoto.compositeUrl,
        filename: `composite_${previewPhoto.id ? String(previewPhoto.id).slice(0, 8) : 'session'}.jpg`,
        isComposite: true
      });
    }
    if (Array.isArray(previewPhoto.photos)) {
      previewPhoto.photos.forEach((p, idx) => {
        if (p?.url) {
          items.push({
            type: 'pose',
            label: `Pose ${idx + 1}`,
            url: p.url,
            filename: p.filename || `pose_${idx + 1}.jpg`,
            size: p.size,
            isPose: true,
            photoObj: p
          });
        }
      });
    }
    return items;
  }, [previewPhoto]);

  const activePreviewItem = previewItems[previewActiveIndex] || previewItems[0];
  const activeImageUrl = activePreviewItem?.url ? resolveApiUrl(activePreviewItem.url) : '';

  const showToast = (msg, duration = 3000) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, duration);
  };

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const url = resolveApiUrl('/api/sessions');
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Gagal memuat sesi (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      } else {
        setSessions([]);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setErrorMessage(err.message || 'Gagal memuat riwayat sesi foto');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isPrintChoiceOpen) {
          setIsPrintChoiceOpen(false);
        } else if (previewPhoto) {
          setPreviewPhoto(null);
        } else if (qrModalData) {
          setQrModalData(null);
        } else if (deleteConfirmSession) {
          setDeleteConfirmSession(null);
        } else if (isOpen) {
          onClose?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewPhoto, qrModalData, deleteConfirmSession, isPrintChoiceOpen, onClose]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchSearch =
        !searchQuery ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.photos && s.photos.some((p) => p.filename && p.filename.toLowerCase().includes(searchQuery.toLowerCase())));

      if (!matchSearch) return false;

      if (filterPeriod === 'today') {
        const d = new Date(s.createdAt);
        const today = new Date();
        return (
          d.getDate() === today.getDate() &&
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear()
        );
      }
      if (filterPeriod === 'week') {
        const d = new Date(s.createdAt);
        const now = new Date();
        const diffDays = (now - d) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      }
      return true;
    });
  }, [sessions, searchQuery, filterPeriod]);

  // Core Print Execution Handler (Full Frame vs Foto Saja)
  const handleExecutePrint = async (session, mode = 'frame', overrideIndices = null, forcedPhotoUrl = null) => {
    const targetSession = session || previewPhoto || printChoiceSession;
    if (!targetSession) return;
    const sessId = targetSession.id;
    const activeIndices = overrideIndices !== null ? overrideIndices : selectedPoseIndices;

    const imagesToPrint = [];
    if (forcedPhotoUrl) {
      imagesToPrint.push(resolveApiUrl(forcedPhotoUrl));
    } else if (mode === 'frame') {
      const composite = targetSession.compositeUrl || targetSession.photos?.[0]?.url;
      if (composite) {
        imagesToPrint.push(resolveApiUrl(composite));
      }
    } else {
      const poses = Array.isArray(targetSession.photos) ? targetSession.photos : [];
      const targetIndices = activeIndices.length > 0 ? activeIndices : poses.map((_, i) => i);
      targetIndices.forEach((idx) => {
        const photo = poses[idx];
        const pUrl = photo?.url || photo;
        if (pUrl) {
          imagesToPrint.push(resolveApiUrl(pUrl));
        }
      });
    }

    if (imagesToPrint.length === 0) {
      showToast('⚠️ URL foto tidak tersedia untuk dicetak');
      return;
    }

    setIsPrinting(true);
    setPrintStatus('Menyiapkan lembar cetak...');
    setPrintStatusMap((prev) => ({ ...prev, [sessId]: 'printing' }));

    try {
      // 1. Bluetooth printer if connected
      if (bluetoothPrinter.isConnected) {
        setPrintStatus(`Mencetak via Bluetooth (${imagesToPrint.length} lembar)...`);
        for (const imgUrl of imagesToPrint) {
          await bluetoothPrinter.printImage(imgUrl);
        }
        setPrintStatus('Berhasil dicetak via Bluetooth! ✅');
        setPrintStatusMap((prev) => ({ ...prev, [sessId]: 'success' }));
        showToast('✅ Berhasil dicetak via Bluetooth!');
        setTimeout(() => {
          setPrintStatus(null);
          setPrintStatusMap((prev) => ({ ...prev, [sessId]: null }));
        }, 3000);
        return;
      }

      // 2. Server Kiosk /api/print endpoint
      setPrintStatus(`Mengirim perintah cetak (${imagesToPrint.length} lembar)...`);
      const printEndpoint = resolveApiUrl('/api/print');
      for (const imgUrl of imagesToPrint) {
        const res = await fetch(printEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: targetSession.id,
            copies: printerConfig.printCopies || 1,
            imageUrl: imgUrl,
            printerName: printerConfig.printerName || 'Niimbot 4R Photo Printer'
          })
        });

        if (!res.ok) {
          throw new Error(`Gagal mengirim job cetak (HTTP ${res.status})`);
        }
      }

      setPrintStatus('Perintah cetak berhasil dikirim ke printer! ✅');
      setPrintStatusMap((prev) => ({ ...prev, [sessId]: 'success' }));
      showToast('✅ Perintah cetak berhasil dikirim ke printer!');
      setTimeout(() => {
        setPrintStatus(null);
        setPrintStatusMap((prev) => ({ ...prev, [sessId]: null }));
      }, 3000);
    } catch (err) {
      console.error('Error printing:', err);
      setPrintStatus(`Gagal mencetak: ${err.message} ❌`);
      setPrintStatusMap((prev) => ({ ...prev, [sessId]: 'error' }));
      showToast(`❌ Gagal mencetak: ${err.message}`);
      setTimeout(() => {
        setPrintStatus(null);
        setPrintStatusMap((prev) => ({ ...prev, [sessId]: null }));
      }, 4000);
    } finally {
      setIsPrinting(false);
    }
  };

  // Action: Print Ulang (triggers 1:1 Print Choice Modal)
  const handleReprint = async (session, specificPhotoUrl = null) => {
    if (specificPhotoUrl) {
      return handleExecutePrint(session, 'raw', [0], specificPhotoUrl);
    }
    const poses = Array.isArray(session?.photos) ? session.photos : [];
    setPrintChoiceSession(session);
    setPrintMode('frame');
    setSelectedPoseIndices(poses.length > 0 ? poses.map((_, i) => i) : [0]);
    setIsPrintChoiceOpen(true);
  };

  // Action: Download Ulang
  const handleDownload = (session, specificPhoto = null) => {
    const target = specificPhoto || session.photos?.[0];
    const fileUrl = target?.apiDownloadUrl || target?.url || session.compositeUrl;
    if (!fileUrl) {
      showToast('⚠️ URL file tidak ditemukan');
      return;
    }

    const downloadUrl = resolveApiUrl(fileUrl);
    const filename = target?.filename || `photobooth_${session.id}.jpg`;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast(`📥 Mengunduh file ${filename}...`);
  };

  // Action: Kirim Link QR Ulang
  const handleOpenQr = async (session) => {
    const primaryPhoto = session.photos?.[0];
    const downloadPageUrl = primaryPhoto?.downloadUrl || resolveApiUrl(`/download/${primaryPhoto?.filename || session.id}`);
    
    setQrModalData({
      sessionId: session.id,
      downloadUrl: downloadPageUrl,
      filename: primaryPhoto?.filename,
      qrCodeDataUri: null,
      isLoadingQr: true
    });

    try {
      const qrEndpoint = resolveApiUrl('/api/photos/qr-generate');
      const res = await fetch(qrEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: downloadPageUrl })
      });
      if (res.ok) {
        const json = await res.json();
        setQrModalData((prev) => prev ? { ...prev, qrCodeDataUri: json.qrCodeDataUri, isLoadingQr: false } : null);
      } else {
        setQrModalData((prev) => prev ? { ...prev, isLoadingQr: false } : null);
      }
    } catch (err) {
      console.warn('Gagal generate QR:', err);
      setQrModalData((prev) => prev ? { ...prev, isLoadingQr: false } : null);
    }
  };

  // Action: Hapus Sesi & Foto
  const handleDeleteSession = async () => {
    if (!deleteConfirmSession) return;
    const sessId = deleteConfirmSession.id;

    try {
      setIsDeleting(true);
      const delUrl = resolveApiUrl(`/api/sessions/${sessId}`);
      const res = await fetch(delUrl, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(`Gagal menghapus sesi (HTTP ${res.status})`);
      }

      setSessions((prev) => prev.filter((s) => s.id !== sessId));
      setDeleteConfirmSession(null);
      if (previewPhoto?.id === sessId) setPreviewPhoto(null);
      if (printChoiceSession?.id === sessId) setPrintChoiceSession(null);
      if (qrModalData?.sessionId === sessId) setQrModalData(null);

      showToast(`🗑️ Sesi ${sessId.slice(0, 8)}... dan foto berhasil dihapus permanen`);
    } catch (err) {
      console.error('Error deleting session:', err);
      showToast(`❌ Gagal menghapus: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kelola Sesi Foto"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 select-none"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative flex flex-col w-full max-w-5xl h-[94vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* HEADER BAR */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20 text-white">
              <FolderArchive size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Kelola Sesi Foto
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  {sessions.length} Sesi Tersimpan
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Lihat riwayat jepretan foto, cetak ulang, download file dan buat link QR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSessions}
              disabled={isLoading}
              title="Refresh Data Sesi"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Kelola Sesi"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* TOOLBAR: SEARCH & FILTERS */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-800/80 bg-slate-900/90 text-xs shrink-0">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ID sesi atau nama file..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-400 text-xs focus:outline-none focus:border-rose-500 transition-all"
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

          {/* Filter Period Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-800/70 rounded-xl border border-slate-700/60">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'today', label: 'Hari Ini' },
              { id: 'week', label: '7 Hari Terakhir' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterPeriod(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterPeriod === tab.id
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* SESSIONS LIST CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar bg-slate-950/40">
          {isLoading && sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
              <RefreshCw size={28} className="animate-spin text-rose-500" />
              <span className="text-xs font-medium">Memuat riwayat sesi foto dari server...</span>
            </div>
          ) : errorMessage ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
              <AlertTriangle size={32} className="text-amber-400" />
              <p className="text-sm font-semibold text-slate-300">{errorMessage}</p>
              <button
                type="button"
                onClick={fetchSessions}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all"
              >
                Coba Lagi
              </button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
              <Camera size={36} className="text-slate-600" />
              <p className="text-sm font-semibold text-slate-400">
                {searchQuery || filterPeriod !== 'all'
                  ? 'Tidak ada sesi yang cocok dengan filter pencarian.'
                  : 'Belum ada riwayat sesi foto tersimpan.'}
              </p>
              {(searchQuery || filterPeriod !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterPeriod('all');
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 underline font-semibold"
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredSessions.map((session) => {
                const primaryPhoto = session.photos?.[0];
                const compositeUrl = session.compositeUrl || primaryPhoto?.url;
                const photoCount = Array.isArray(session.photos) ? session.photos.length : 0;
                const printStatus = printStatusMap[session.id];

                return (
                  <motion.div
                    key={session.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col justify-between bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/60 hover:border-slate-600 rounded-2xl p-3.5 transition-all shadow-md group"
                  >
                    <div>
                      {/* Thumbnail Container */}
                      <div
                        onClick={() => handleOpenPreview(session, 0)}
                        className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 border border-slate-700/50 mb-3 cursor-pointer group-hover:border-rose-500/50 transition-all flex items-center justify-center"
                      >
                        {compositeUrl ? (
                          <img
                            src={resolveApiUrl(compositeUrl)}
                            alt={`Sesi ${session.id}`}
                            className="w-full h-full object-contain group-hover:scale-102 transition-transform duration-200"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-500 gap-1.5">
                            <ImageIcon size={24} />
                            <span className="text-[10px] font-semibold">Tidak ada gambar</span>
                          </div>
                        )}

                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-[10px] font-bold text-white border border-white/10 flex items-center gap-1">
                            <Layers size={10} className="text-rose-400" />
                            <span>{photoCount} Pose</span>
                          </span>
                          {session.compositeUrl && (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/80 text-[9px] font-extrabold text-white">
                              Composite
                            </span>
                          )}
                        </div>

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <span className="px-3 py-1.5 rounded-xl bg-white/90 text-slate-900 text-xs font-bold flex items-center gap-1 shadow-lg">
                            <Eye size={13} />
                            <span>Lihat Detail</span>
                          </span>
                        </div>
                      </div>

                      {/* Session Info */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-white truncate max-w-[170px]">
                            {session.id}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock size={11} />
                            <span>{formatDateIndo(session.createdAt)}</span>
                          </span>
                        </div>

                        {primaryPhoto?.filename && (
                          <div className="text-[10px] font-mono text-slate-500 truncate mt-1">
                            {primaryPhoto.filename}
                          </div>
                        )}
                      </div>

                      {/* 5 ACTION BUTTONS */}
                      <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-slate-700/60">
                        {/* 1. Preview Ulang */}
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(session, 0)}
                          title="Preview Ulang Resolusi Penuh"
                          className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                        >
                          <Eye size={15} className="text-cyan-400 mb-0.5" />
                          <span className="text-[9px] font-semibold">Preview</span>
                        </button>

                        {/* 2. Print Ulang (triggers 1:1 Print Choice Modal) */}
                        <button
                          type="button"
                          onClick={() => handleReprint(session)}
                          disabled={printStatus === 'printing'}
                          title="Print Ulang Foto"
                          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                            printStatus === 'printing'
                              ? 'bg-rose-500/20 text-rose-300 animate-pulse'
                              : printStatus === 'success'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white'
                          }`}
                        >
                          {printStatus === 'printing' ? (
                            <RefreshCw size={15} className="text-rose-400 animate-spin mb-0.5" />
                          ) : (
                            <Printer size={15} className="text-emerald-400 mb-0.5" />
                          )}
                          <span className="text-[9px] font-semibold">
                            {printStatus === 'printing' ? 'Cetak...' : 'Print'}
                          </span>
                        </button>

                        {/* 3. Download Ulang */}
                        <button
                          type="button"
                          onClick={() => handleDownload(session)}
                          title="Unduh Foto ke Perangkat"
                          className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                        >
                          <Download size={15} className="text-amber-400 mb-0.5" />
                          <span className="text-[9px] font-semibold">Unduh</span>
                        </button>

                        {/* 4. Kirim Link QR Ulang */}
                        <button
                          type="button"
                          onClick={() => handleOpenQr(session)}
                          title="Kirim / Tampilkan QR Code & Link"
                          className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                        >
                          <QrCode size={15} className="text-purple-400 mb-0.5" />
                          <span className="text-[9px] font-semibold">QR Link</span>
                        </button>

                        {/* 5. Hapus Foto */}
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmSession(session)}
                          title="Hapus Sesi & Foto dari Server"
                          className="flex flex-col items-center justify-center p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all cursor-pointer"
                        >
                          <Trash2 size={15} className="mb-0.5" />
                          <span className="text-[9px] font-semibold">Hapus</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER BAR */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/80 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <HardDrive size={14} className="text-rose-400" />
            <span>Folder Penyimpanan: <code className="text-rose-300 font-mono">server/uploads/photos/</code></span>
          </div>

          <div className="flex items-center gap-3">
            <span>Total: <strong className="text-white">{filteredSessions.length}</strong> sesi</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer"
            >
              Selesai
            </button>
          </div>
        </div>
      </motion.div>

      {/* ============================================================== */}
      {/* 1:1 PREVIEW MODAL (IDENTICAL TO PREVIEW RESULT POST-PHOTO)     */}
      {/* ============================================================== */}
      <AnimatePresence>
        {previewPhoto && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Preview Foto Resolusi Penuh"
            className="fixed inset-0 z-60 flex flex-col items-center justify-between h-full h-[100dvh] max-h-[100dvh] w-full bg-slate-50 text-slate-800 p-2.5 sm:p-4 md:p-6 select-none overflow-hidden animate-fade-in"
          >
            {/* 0: Top Header Matching PreviewResult */}
            <div className="w-full max-w-4xl flex items-center justify-between pt-0.5 pb-1 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Kembali</span>
              </button>

              <div className="text-center flex flex-col items-center">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mb-0.5">
                  Hasil Fotomu Siap! 🎉
                </h2>
                <p className="text-slate-500 text-xs">
                  Cetak langsung atau scan QR code untuk menyimpan di ponsel.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-500 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                title="Tutup Preview"
              >
                <X size={16} />
              </button>
            </div>

            {/* 1: Frame Preview (Full frame composite) */}
            <div className="h-[66vh] sm:h-[72vh] md:h-[75vh] w-full flex flex-col items-center justify-center my-auto shrink overflow-hidden">
              <div className="flex-1 flex items-center justify-center w-full min-h-0 overflow-hidden">
                {activeImageUrl ? (
                  <img
                    src={activeImageUrl}
                    alt={activePreviewItem?.label || "Hasil Fotomu Siap!"}
                    className="max-h-full w-auto max-w-[94vw] object-contain rounded-2xl shadow-xl border border-slate-200/80"
                  />
                ) : (
                  <div className="py-16 px-6 flex flex-col items-center justify-center text-center text-slate-400 gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-slate-200/80 flex items-center justify-center text-slate-400">
                      <ImageIcon size={32} />
                    </div>
                    <p className="text-sm font-bold text-slate-700">Belum Ada File Foto</p>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Sesi ini belum memiliki file foto atau hasil komposit pada storage server.
                    </p>
                  </div>
                )}
              </div>

              {/* Pose switcher tabs if session has multiple items */}
              {previewItems.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-2 overflow-x-auto max-w-full px-2 py-1">
                  {previewItems.map((item, idx) => {
                    const isSelected = (previewActiveIndex === idx) || (!previewItems[previewActiveIndex] && idx === 0);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPreviewActiveIndex(idx)}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {item.type === 'composite' ? <Layers size={13} /> : <ImageIcon size={13} />}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2: printStatus Message (Matching PreviewResult) */}
            {printStatus && (
              <div className={`mt-1 flex items-center gap-1.5 font-semibold text-xs px-3 py-1 rounded-lg border animate-fade-in text-center shrink-0 ${
                printStatus.toLowerCase().includes('error') || printStatus.toLowerCase().includes('gagal')
                  ? 'text-rose-700 bg-rose-50 border-rose-200'
                  : printStatus.includes('...') || printStatus.toLowerCase().includes('proses') || printStatus.toLowerCase().includes('mengirim')
                  ? 'text-purple-700 bg-purple-50 border-purple-200'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-200'
              }`}>
                {printStatus.toLowerCase().includes('error') || printStatus.toLowerCase().includes('gagal') ? (
                  <AlertCircle size={14} className="shrink-0 text-rose-600" />
                ) : printStatus.includes('...') || printStatus.toLowerCase().includes('proses') || printStatus.toLowerCase().includes('mengirim') ? (
                  <Loader2 size={14} className="shrink-0 animate-spin text-purple-600" />
                ) : (
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                )}
                <span>{printStatus}</span>
              </div>
            )}

            {/* 3: Action Buttons (1:1 with PreviewResult) */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-1 sm:mt-2 w-full max-w-xl shrink-0">
              <button
                onClick={() => {
                  setPrintMode('frame');
                  const count = Array.isArray(previewPhoto.photos) ? previewPhoto.photos.length : 0;
                  setSelectedPoseIndices(count > 0 ? Array.from({ length: count }, (_, i) => i) : [0]);
                  setIsPrintChoiceOpen(true);
                }}
                disabled={isPrinting || (!previewPhoto.compositeUrl && (!previewPhoto.photos || previewPhoto.photos.length === 0))}
                type="button"
                className="flex-1 min-w-[140px] whitespace-nowrap py-2 sm:py-2.5 px-3 sm:px-4 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-colors cursor-pointer active:scale-98"
              >
                <Printer size={15} className="shrink-0" />
                <span>Print Foto</span>
              </button>

              <button
                onClick={() => handleOpenQr(previewPhoto)}
                type="button"
                className="flex-1 min-w-[145px] whitespace-nowrap py-2 sm:py-2.5 px-3 sm:px-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-colors cursor-pointer active:scale-98"
              >
                <QrCode size={15} className="shrink-0" />
                <span>Download (QR)</span>
              </button>

              <button
                onClick={() => setPreviewPhoto(null)}
                type="button"
                className="w-full sm:w-auto min-w-[130px] whitespace-nowrap py-2 sm:py-2.5 px-3 sm:px-4 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-xs flex items-center justify-center gap-1 text-xs sm:text-sm transition-colors cursor-pointer active:scale-98"
              >
                <ArrowLeft size={14} className="text-slate-500 shrink-0" />
                <span>Kembali ke Daftar</span>
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* PRINT CHOICE DIALOG (FULL FRAME VS FOTO SAJA 1:1)             */}
      {/* ============================================================== */}
      {isPrintChoiceOpen && (previewPhoto || printChoiceSession) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pilihan Cetak Foto"
          className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 animate-fade-in"
          onClick={() => setIsPrintChoiceOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                  <Printer size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                    Pilihan Cetak Foto
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    Pilih format lembar yang ingin dicetak:
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintChoiceOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                title="Tutup dialog"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 custom-scrollbar">
              {/* Opsi Kartu Mode Cetak */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Mode: Full Frame */}
                <button
                  type="button"
                  onClick={() => setPrintMode('frame')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                    printMode === 'frame'
                      ? 'border-rose-500 bg-rose-50/70 shadow-sm ring-2 ring-rose-400/30'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      printMode === 'frame' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <Layers size={16} />
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      printMode === 'frame' ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-300'
                    }`}>
                      {printMode === 'frame' && <Check size={11} strokeWidth={3} />}
                    </div>
                  </div>
                  <div>
                    <div className="font-extrabold text-xs sm:text-sm text-slate-900">Full Frame</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Cetak lengkap desain frame, dekorasi & teks
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-slate-500">Jumlah cetak:</span>
                    <span className="font-extrabold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full">1 Lembar</span>
                  </div>
                </button>

                {/* Mode: Foto Saja */}
                <button
                  type="button"
                  onClick={() => setPrintMode('raw')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                    printMode === 'raw'
                      ? 'border-rose-500 bg-rose-50/70 shadow-sm ring-2 ring-rose-400/30'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      printMode === 'raw' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <ImageIcon size={16} />
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      printMode === 'raw' ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-300'
                    }`}>
                      {printMode === 'raw' && <Check size={11} strokeWidth={3} />}
                    </div>
                  </div>
                  <div>
                    <div className="font-extrabold text-xs sm:text-sm text-slate-900">Foto Saja</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Cetak lembar foto asli per pose tanpa bingkai
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-slate-500">Terpilih:</span>
                    <span className="font-extrabold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full">
                      {selectedPoseIndices.length} Pose
                    </span>
                  </div>
                </button>
              </div>

              {/* Sub-section: Daftar Foto untuk Foto Saja */}
              {printMode === 'raw' && (
                (() => {
                  const targetSession = previewPhoto || printChoiceSession;
                  const poses = Array.isArray(targetSession?.photos) ? targetSession.photos : [];
                  if (poses.length === 0) return null;
                  return (
                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-2 animate-fade-in">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">
                          Pilih Foto ({selectedPoseIndices.length} dari {poses.length} terpilih):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedPoseIndices.length === poses.length) {
                              setSelectedPoseIndices([]);
                            } else {
                              setSelectedPoseIndices(poses.map((_, i) => i));
                            }
                          }}
                          className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                        >
                          {selectedPoseIndices.length === poses.length ? 'Hapus Pilihan' : 'Pilih Semua'}
                        </button>
                      </div>

                      {/* Thumbnail grid */}
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[32vh] overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200/80 custom-scrollbar">
                        {poses.map((p, idx) => {
                          const isChecked = selectedPoseIndices.includes(idx);
                          const pUrl = resolveApiUrl(p?.url || p);
                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                setSelectedPoseIndices((prev) =>
                                  prev.includes(idx)
                                    ? prev.filter((i) => i !== idx)
                                    : [...prev, idx].sort((a, b) => a - b)
                                );
                              }}
                              className={`group relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all flex flex-col items-center bg-white shadow-2xs ${
                                isChecked
                                  ? 'border-rose-500 ring-2 ring-rose-400/40'
                                  : 'border-slate-200 opacity-60 hover:opacity-100'
                              }`}
                            >
                              <div className="w-full aspect-[3/4] relative overflow-hidden bg-slate-100">
                                <img
                                  src={pUrl}
                                  alt={`Pose ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <div className={`absolute top-1 right-1 w-5 h-5 rounded-md flex items-center justify-center transition-colors shadow-xs ${
                                  isChecked ? 'bg-rose-500 text-white' : 'bg-slate-900/50 text-white/40 border border-white/60'
                                }`}>
                                  {isChecked ? <Check size={13} strokeWidth={3} /> : null}
                                </div>
                              </div>
                              <div className="py-1 px-1.5 w-full text-center bg-white">
                                <span className={`text-[10px] font-extrabold ${isChecked ? 'text-rose-600' : 'text-slate-500'}`}>
                                  Pose #{idx + 1}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {selectedPoseIndices.length === 0 && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-xl font-medium text-center">
                          ⚠️ Pilih minimal 1 foto di atas untuk melanjutkan cetak.
                        </p>
                      )}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Footer Buttons */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsPrintChoiceOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={printMode === 'raw' && selectedPoseIndices.length === 0}
                onClick={() => {
                  const targetSession = previewPhoto || printChoiceSession;
                  setIsPrintChoiceOpen(false);
                  handleExecutePrint(targetSession, printMode, selectedPoseIndices);
                }}
                className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-black disabled:opacity-40 text-white font-extrabold rounded-xl shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm transition-all cursor-pointer active:scale-98"
              >
                <Printer size={15} />
                <span>
                  {printMode === 'frame'
                    ? 'Cetak Full Frame (1 Lembar)'
                    : selectedPoseIndices.length > 0
                    ? `Cetak Foto (${selectedPoseIndices.length} Lembar)`
                    : 'Pilih Foto'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* QR CODE & LINK MODAL                                           */}
      {/* ============================================================== */}
      <AnimatePresence>
        {qrModalData && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="QR Code Link Download"
            className="fixed inset-0 z-70 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
            onClick={() => setQrModalData(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-7 max-w-sm w-full text-center relative shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setQrModalData(null)}
                aria-label="Tutup"
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-purple-500/20">
                <QrCode size={24} className="text-white" />
              </div>

              <h3 className="text-lg font-bold text-white mb-1">
                Link &amp; QR Download
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Scan menggunakan kamera HP untuk mengunduh foto sesi ini secara langsung.
              </p>

              {/* QR Image Box */}
              <div className="p-3 bg-white rounded-2xl inline-block mb-4 shadow-inner">
                {qrModalData.isLoadingQr ? (
                  <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-500 gap-2">
                    <RefreshCw className="animate-spin text-purple-600" size={28} />
                    <span className="text-xs font-semibold">Membuat QR...</span>
                  </div>
                ) : qrModalData.qrCodeDataUri ? (
                  <img
                    src={qrModalData.qrCodeDataUri}
                    alt="QR Code"
                    className="w-48 h-48 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                    QR tidak tersedia
                  </div>
                )}
              </div>

              {/* Link Input & Copy */}
              <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs mb-4">
                <input
                  type="text"
                  readOnly
                  value={qrModalData.downloadUrl}
                  className="bg-transparent text-slate-300 font-mono text-[11px] px-2 flex-1 outline-none select-all truncate"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(qrModalData.downloadUrl)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    copiedLink
                      ? 'bg-emerald-500 text-white'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                  }`}
                >
                  {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedLink ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>

              {/* External Link */}
              <a
                href={qrModalData.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold"
              >
                <span>Buka Halaman Download</span>
                <ExternalLink size={13} />
              </a>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* DELETE CONFIRMATION DIALOG                                     */}
      {/* ============================================================== */}
      <AnimatePresence>
        {deleteConfirmSession && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="fixed inset-0 z-70 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
            onClick={() => !isDeleting && setDeleteConfirmSession(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-3">
                <Trash2 size={24} />
              </div>

              <h3 id="delete-dialog-title" className="text-lg font-bold text-white mb-1">
                Hapus Sesi &amp; File Foto?
              </h3>
              <p className="text-xs text-slate-400 mb-2">
                Sesi <span className="font-mono text-rose-300 font-bold">{deleteConfirmSession.id.slice(0, 16)}...</span> beserta seluruh file foto komposit dan fotonya akan dihapus permanen dari server.
              </p>
              <p className="text-[11px] text-rose-400 font-semibold mb-5">
                Tindakan ini tidak dapat dibatalkan!
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmSession(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSession}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-lg shadow-rose-600/30 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={13} />
                      <span>Hapus Permanen</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST FEEDBACK */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-80 px-4 py-2.5 rounded-2xl bg-slate-950/95 border border-slate-700/80 text-white text-xs font-semibold shadow-2xl shadow-black flex items-center gap-2"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
