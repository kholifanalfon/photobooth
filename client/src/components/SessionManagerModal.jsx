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
  HardDrive
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
  const [previewPhoto, setPreviewPhoto] = useState(null); // photo/session object for lightbox
  const [previewActiveIndex, setPreviewActiveIndex] = useState(0);
  const [qrModalData, setQrModalData] = useState(null); // { url, qrCodeDataUri, filename, sessionId }
  const [deleteConfirmSession, setDeleteConfirmSession] = useState(null); // session object to confirm delete
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [printStatusMap, setPrintStatusMap] = useState({}); // sessionId -> 'printing' | 'success' | 'error'
  const [copiedLink, setCopiedLink] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);

  const handleOpenPreview = (session, initialIndex = 0) => {
    setPreviewPhoto(session);
    setPreviewActiveIndex(initialIndex);
    setPreviewZoom(1);
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
        if (previewPhoto) {
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
  }, [isOpen, previewPhoto, qrModalData, deleteConfirmSession, onClose]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchSearch =
        !searchQuery ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.photos && s.photos.some((p) => p.filename.toLowerCase().includes(searchQuery.toLowerCase())));

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

  // Action: Print Ulang
  const handleReprint = async (session, specificPhotoUrl = null) => {
    const sessId = session.id;
    const photoUrl = specificPhotoUrl || session.compositeUrl || session.photos?.[0]?.url;
    if (!photoUrl) {
      showToast('⚠️ URL foto tidak tersedia untuk dicetak');
      return;
    }

    setPrintStatusMap((prev) => ({ ...prev, [sessId]: 'printing' }));

    try {
      // 1. If bluetooth printer is connected, print directly
      if (bluetoothPrinter.isConnected) {
        showToast('🖨️ Mengirim ke printer Bluetooth...');
        const fullUrl = resolveApiUrl(photoUrl);
        await bluetoothPrinter.printImage(fullUrl);
        setPrintStatusMap((prev) => ({ ...prev, [sessId]: 'success' }));
        showToast('✅ Berhasil dicetak via Bluetooth!');
        setTimeout(() => setPrintStatusMap((prev) => ({ ...prev, [sessId]: null })), 3000);
        return;
      }

      // 2. Dispatch to server kiosk print endpoint
      const printEndpoint = resolveApiUrl('/api/print');
      const res = await fetch(printEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          copies: printerConfig.printCopies || 1,
          imageUrl: resolveApiUrl(photoUrl),
          printerName: printerConfig.printerName || 'Niimbot 4R Photo Printer'
        })
      });

      if (!res.ok) {
        throw new Error(`Gagal mengirim job cetak (HTTP ${res.status})`);
      }

      setPrintStatusMap((prev) => ({ ...prev, [sessId]: 'success' }));
      showToast('✅ Perintah cetak berhasil dikirim ke printer!');
      setTimeout(() => setPrintStatusMap((prev) => ({ ...prev, [sessId]: null })), 3000);
    } catch (err) {
      console.error('Error re-printing session:', err);
      setPrintStatusMap((prev) => ({ ...prev, [sessId]: 'error' }));
      showToast(`❌ Gagal mencetak: ${err.message}`);
      setTimeout(() => setPrintStatusMap((prev) => ({ ...prev, [sessId]: null })), 4000);
    }
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
      aria-labelledby="session-manager-title"
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
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center shadow-md shadow-rose-500/20">
              <FolderArchive size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="session-manager-title" className="text-base sm:text-lg font-bold text-white">
                  Kelola Sesi Foto
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {filteredSessions.length} Sesi
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Riwayat foto booth, preview resolusi penuh, cetak ulang, unduh, dan bagikan QR code.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSessions}
              disabled={isLoading}
              title="Perbarui daftar sesi"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin text-rose-400' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Kelola Sesi"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* TOOLBAR: SEARCH & PERIOD FILTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-b border-slate-800/80 bg-slate-900/60 shrink-0">
          {/* Search box */}
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ID sesi atau nama file..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Period filter buttons */}
          <div className="flex items-center gap-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700/50 w-full sm:w-auto justify-center">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'today', label: 'Hari Ini' },
              { id: 'week', label: '7 Hari Terakhir' }
            ].map((period) => (
              <button
                key={period.id}
                type="button"
                onClick={() => setFilterPeriod(period.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterPeriod === period.id
                    ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* BODY: SESSIONS LIST */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {isLoading && sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3">
              <RefreshCw size={32} className="animate-spin text-rose-500" />
              <p className="text-sm font-semibold">Memuat riwayat sesi foto...</p>
            </div>
          ) : errorMessage ? (
            <div className="flex flex-col items-center justify-center h-64 text-rose-400 space-y-3 text-center px-4">
              <AlertTriangle size={36} className="text-rose-500" />
              <p className="text-sm font-semibold">{errorMessage}</p>
              <button
                type="button"
                onClick={fetchSessions}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                Coba Lagi
              </button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3 text-center px-4">
              <Camera size={44} className="text-slate-600" />
              <div>
                <p className="text-base font-bold text-slate-300">Belum Ada Sesi Foto</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {searchQuery
                    ? 'Tidak ada sesi yang cocok dengan kata kunci pencarian Anda.'
                    : 'Foto yang diambil oleh tamu akan otomatis tersimpan dan muncul di daftar ini.'}
                </p>
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-rose-400"
                >
                  Reset Pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSessions.map((session, index) => {
                const primaryPhoto = session.photos?.[0];
                const photoSrc = primaryPhoto?.url || session.compositeUrl;
                const photoCount = session.photos?.length || 1;
                const printStatus = printStatusMap[session.id];

                return (
                  <motion.div
                    key={session.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(index * 0.03, 0.3) }}
                    className="flex flex-col bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 hover:border-slate-600 rounded-2xl overflow-hidden shadow-lg transition-all group"
                  >
                    {/* THUMBNAIL AREA */}
                    <div
                      onClick={() => handleOpenPreview(session, 0)}
                      className="relative w-full aspect-[4/3] bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer group/thumb"
                    >
                      {photoSrc ? (
                        <img
                          src={resolveApiUrl(photoSrc)}
                          alt={`Sesi ${session.id}`}
                          loading="lazy"
                          className="w-full h-full object-contain group-hover/thumb:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 gap-1">
                          <ImageIcon size={32} />
                          <span className="text-[11px]">Tidak ada thumbnail</span>
                        </div>
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 text-slate-900 font-bold text-xs shadow-lg backdrop-blur-xs">
                          <Eye size={14} className="text-rose-500" />
                          <span>Preview Penuh</span>
                        </span>
                      </div>

                      {/* Badges */}
                      <div className="absolute top-2 left-2 flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/70 backdrop-blur-xs text-white border border-white/10">
                          #{filteredSessions.length - index}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/80 backdrop-blur-xs text-white shadow-xs">
                          {photoCount} Foto
                        </span>
                      </div>

                      {primaryPhoto?.size && (
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-black/70 backdrop-blur-xs text-slate-300">
                          {formatFileSize(primaryPhoto.size)}
                        </div>
                      )}
                    </div>

                    {/* METADATA INFO */}
                    <div className="p-3.5 flex flex-col flex-1 justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-300 font-bold">
                            <span className="truncate max-w-[130px]">{session.id}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(session.id);
                                showToast('ID sesi tersalin!');
                              }}
                              title="Salin ID Sesi"
                              className="text-slate-400 hover:text-white p-0.5"
                            >
                              <Copy size={11} />
                            </button>
                          </div>
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

                        {/* 2. Print Ulang */}
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
      {/* LIGHTBOX PREVIEW MODAL                                        */}
      {/* ============================================================== */}
      <AnimatePresence>
        {previewPhoto && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Preview Foto Resolusi Penuh"
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 backdrop-blur-lg p-2 sm:p-6"
            onClick={() => setPreviewPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[92vh] w-full flex flex-col items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Lightbox Controls Header */}
              <div className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/90 backdrop-blur-md rounded-2xl mb-2 text-xs border border-slate-800">
                <div className="flex items-center gap-2 text-slate-300 font-mono">
                  <span className="font-bold text-white">ID: {previewPhoto.id ? String(previewPhoto.id).slice(0, 16) : '-'}...</span>
                  <span>•</span>
                  <span>{formatDateIndo(previewPhoto.createdAt)}</span>
                  {activePreviewItem && (
                    <>
                      <span>•</span>
                      <span className="text-rose-400 font-semibold">{activePreviewItem.label}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom((z) => Math.max(0.6, z - 0.2))}
                    title="Perkecil"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="text-[11px] font-mono w-10 text-center">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom((z) => Math.min(2.5, z + 0.2))}
                    title="Perbesar"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(1)}
                    title="Reset Zoom"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold px-2"
                  >
                    100%
                  </button>

                  <div className="h-4 w-[1px] bg-slate-700 mx-1" />

                  <button
                    type="button"
                    onClick={() => handleDownload(previewPhoto, activePreviewItem?.photoObj || null)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold"
                  >
                    <Download size={13} />
                    <span>Unduh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReprint(previewPhoto, activePreviewItem?.url || null)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold"
                  >
                    <Printer size={13} />
                    <span>Cetak</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmSession(previewPhoto);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold"
                  >
                    <Trash2 size={13} />
                    <span>Hapus</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(null)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 ml-2"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Lightbox Image Container */}
              <div className="relative w-full max-h-[72vh] min-h-[280px] overflow-auto flex items-center justify-center p-3 rounded-2xl bg-black/70 border border-slate-800">
                {activeImageUrl ? (
                  <img
                    src={activeImageUrl}
                    alt={activePreviewItem?.label || "Preview Foto"}
                    style={{ transform: `scale(${previewZoom})`, transformOrigin: 'center center' }}
                    className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-2xl transition-transform duration-150 select-none"
                  />
                ) : (
                  <div className="py-16 px-6 flex flex-col items-center justify-center text-center text-slate-400 gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-500">
                      <ImageIcon size={32} />
                    </div>
                    <p className="text-sm font-bold text-slate-200">Belum Ada File Foto</p>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Sesi ini belum memiliki file foto atau hasil komposit pada storage server.
                    </p>
                  </div>
                )}
              </div>

              {/* Thumbnail Selector (Full Frame + Poses) */}
              {previewItems.length > 1 && (
                <div className="flex items-center justify-center gap-2 mt-3 overflow-x-auto max-w-full px-2 py-1">
                  {previewItems.map((item, idx) => {
                    const isSelected = (previewActiveIndex === idx) || (!previewItems[previewActiveIndex] && idx === 0);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setPreviewActiveIndex(idx);
                          setPreviewZoom(1);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/40 ring-1 ring-rose-400'
                            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {item.type === 'composite' ? <Layers size={13} /> : <ImageIcon size={13} />}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* QR CODE & LINK MODAL                                           */}
      {/* ============================================================== */}
      <AnimatePresence>
        {qrModalData && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="QR Code Link Download"
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
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
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-70 px-4 py-2.5 rounded-2xl bg-slate-950/95 border border-slate-700/80 text-white text-xs font-semibold shadow-2xl shadow-black flex items-center gap-2"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
