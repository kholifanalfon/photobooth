import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Calendar,
  Plus,
  Trash2,
  Edit3,
  Star,
  Check,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Search,
  Sliders,
  Palette,
  Video,
  Printer,
  Sparkles,
  Loader2,
  Heart,
  Layers,
  FileText
} from 'lucide-react';
import { resolveApiUrl } from '../utils/apiConfig.js';

function generateSlug(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getInitialFormData(event = null) {
  if (!event) {
    return {
      name: '',
      slug: '',
      description: '',
      status: 'ACTIVE',
      isDefault: false,
      videoBgUrl: '',
      title: '',
      subtitle: '',
      coupleNames: '',
      eventDate: '',
      footerText: '',
      theme: 'general',
      printCopies: 1,
      paperSize: '4R',
      autoPrint: false
    };
  }

  const cfg = event.config || {};
  return {
    id: event.id,
    name: event.name || '',
    slug: event.slug || '',
    description: event.description || '',
    status: event.status || 'ACTIVE',
    isDefault: Boolean(event.isDefault),
    videoBgUrl: event.videoBgUrl || '',
    title: cfg.title || cfg.eventTitle || '',
    subtitle: cfg.subtitle || cfg.eventSubtitle || '',
    coupleNames: cfg.coupleNames || '',
    eventDate: cfg.eventDate || '',
    footerText: cfg.footerText || '',
    theme: cfg.theme || 'general',
    printCopies: cfg.printCopies !== undefined ? cfg.printCopies : 1,
    paperSize: cfg.paperSize || '4R',
    autoPrint: Boolean(cfg.autoPrint)
  };
}

export default function EventManagerModal({
  isOpen,
  onClose,
  events = [],
  onRefreshEvents,
  onEventUpdated,
  currentEventId,
  initialEditingEvent = null
}) {
  const [activeView, setActiveView] = useState(initialEditingEvent ? 'form' : 'list');
  const [editingEvent, setEditingEvent] = useState(initialEditingEvent);
  const [formData, setFormData] = useState(() => getInitialFormData(initialEditingEvent));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'ACTIVE' | 'INACTIVE'

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmEvent, setDeleteConfirmEvent] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (initialEditingEvent) {
      setEditingEvent(initialEditingEvent);
      setFormData(getInitialFormData(initialEditingEvent));
      setActiveView('form');
    }
  }, [initialEditingEvent]);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const triggerRefresh = () => {
    if (typeof onRefreshEvents === 'function') {
      onRefreshEvents();
    }
    if (typeof onEventUpdated === 'function') {
      onEventUpdated();
    }
  };

  const filteredEvents = useMemo(() => {
    let list = Array.isArray(events) ? events : [];
    if (statusFilter !== 'all') {
      list = list.filter((e) => e?.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          (e?.name || '').toLowerCase().includes(q) ||
          (e?.slug || '').toLowerCase().includes(q) ||
          (e?.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, statusFilter, searchQuery]);

  const handleStartCreate = () => {
    setEditingEvent(null);
    setFormData(getInitialFormData(null));
    setErrorMessage(null);
    setActiveView('form');
  };

  const handleStartEdit = (event) => {
    setEditingEvent(event);
    setFormData(getInitialFormData(event));
    setErrorMessage(null);
    setActiveView('form');
  };

  const handleBackToList = () => {
    setActiveView('list');
    setEditingEvent(null);
    setErrorMessage(null);
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => {
      const shouldAutoSlug = !prev.id && (!prev.slug || prev.slug === generateSlug(prev.name));
      return {
        ...prev,
        name: val,
        slug: shouldAutoSlug ? generateSlug(val) : prev.slug
      };
    });
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage('Nama Event wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const slug = (formData.slug.trim() || generateSlug(formData.name)).trim();

    const payload = {
      name: formData.name.trim(),
      slug,
      description: formData.description.trim(),
      status: formData.status,
      isDefault: Boolean(formData.isDefault),
      videoBgUrl: formData.videoBgUrl.trim(),
      config: {
        title: formData.title.trim() || formData.name.trim(),
        subtitle: formData.subtitle.trim(),
        coupleNames: formData.coupleNames.trim(),
        eventDate: formData.eventDate.trim(),
        footerText: formData.footerText.trim(),
        theme: formData.theme || 'general',
        printCopies: Math.max(1, parseInt(formData.printCopies, 10) || 1),
        paperSize: formData.paperSize || '4R',
        autoPrint: Boolean(formData.autoPrint)
      }
    };

    try {
      const isEdit = Boolean(formData.id);
      const url = isEdit
        ? resolveApiUrl(`/api/events/${formData.id}`)
        : resolveApiUrl('/api/events');
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Gagal menyimpan data event.');
      }

      setSuccessMessage(isEdit ? 'Event berhasil diperbarui.' : 'Event baru berhasil ditambahkan.');
      triggerRefresh();
      setActiveView('list');
      setEditingEvent(null);
    } catch (err) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat menyimpan event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (eventToDelete) => {
    if (!eventToDelete?.id) return;
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const url = resolveApiUrl(`/api/events/${eventToDelete.id}`);
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Gagal menghapus event.');
      }

      setSuccessMessage(`Event "${eventToDelete.name}" berhasil dihapus.`);
      setDeleteConfirmEvent(null);
      triggerRefresh();
    } catch (err) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat menghapus event.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetDefault = async (event) => {
    if (!event?.id) return;
    try {
      const url = resolveApiUrl(`/api/events/${event.id}`);
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Gagal mengatur event default.');
      }
      setSuccessMessage(`Event "${event.name}" dijadikan event default.`);
      triggerRefresh();
    } catch (err) {
      setErrorMessage(err.message || 'Gagal mengatur event default.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-manager-title"
    >
      <div className="bg-white text-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-inner">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 id="event-manager-title" className="text-xl font-bold text-slate-900 tracking-tight">
                Manajemen Event
              </h2>
              <p className="text-xs text-slate-500">
                Kelola konfigurasi multi-event, tema, video background, dan printer untuk setiap perayaan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeView === 'list' && (
              <button
                type="button"
                onClick={handleStartCreate}
                className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Event Baru</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
              aria-label="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status / Alert notifications */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Body Content */}
        {activeView === 'list' ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama event, slug, atau deskripsi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
                {['all', 'ACTIVE', 'INACTIVE'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      statusFilter === st
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'all' ? 'Semua' : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Event List */}
            {filteredEvents.length === 0 ? (
              <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Tidak ada event yang cocok dengan filter pencarian.'
                    : 'Belum ada event yang tersimpan.'}
                </p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Buat event pertama untuk mulai mengelola kustomisasi sesi dan frame.
                </p>
                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="inline-flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Event Baru</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredEvents.map((evt) => {
                  const isCurrent = currentEventId && String(currentEventId) === String(evt.id);
                  const cfg = evt.config || {};
                  return (
                    <div
                      key={evt.id}
                      className={`p-4 rounded-xl border transition ${
                        isCurrent
                          ? 'border-rose-400 bg-rose-50/20 ring-1 ring-rose-400'
                          : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-base">
                              {evt.name}
                            </h3>
                            {evt.isDefault && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                <span>Default</span>
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                evt.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {evt.status || 'ACTIVE'}
                            </span>
                            {isCurrent && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                                Aktif Saat Ini
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                              /{evt.slug}
                            </span>
                          </div>

                          {evt.description && (
                            <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                              {evt.description}
                            </p>
                          )}

                          {/* Meta Information */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-500">
                            {cfg.theme && (
                              <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                                <Palette className="w-3 h-3 text-slate-400" />
                                <span>Tema: {cfg.theme === 'wedding' ? 'Pernikahan' : 'Umum'}</span>
                              </span>
                            )}
                            {cfg.eventDate && (
                              <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{cfg.eventDate}</span>
                              </span>
                            )}
                            {cfg.coupleNames && (
                              <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                                <Heart className="w-3 h-3 text-rose-400" />
                                <span>{cfg.coupleNames}</span>
                              </span>
                            )}
                            {evt.videoBgUrl && (
                              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-100">
                                <Video className="w-3 h-3" />
                                <span>Video Background</span>
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                              <Printer className="w-3 h-3 text-slate-400" />
                              <span>{cfg.printCopies || 1}x cetak ({cfg.paperSize || '4R'})</span>
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 self-end sm:self-start pt-2 sm:pt-0">
                          {!evt.isDefault && (
                            <button
                              type="button"
                              onClick={() => handleSetDefault(evt)}
                              className="px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-lg transition flex items-center gap-1"
                              title="Jadikan Event Utama / Default"
                            >
                              <Star className="w-3.5 h-3.5 text-amber-500" />
                              <span>Jadikan Default</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(evt)}
                            className="px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg transition flex items-center gap-1"
                            title="Edit Event"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmEvent(evt)}
                            className="px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition flex items-center gap-1"
                            title="Hapus Event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Form View: Add or Edit Event */
          <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={handleBackToList}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-200/60 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Daftar</span>
              </button>
              <span className="text-xs font-semibold text-slate-700">
                {formData.id ? `Edit Event: ${formData.name || 'Event'}` : 'Tambah Event Baru'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Section 1: Informasi Dasar */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  <FileText className="w-4 h-4 text-rose-500" />
                  <span>Informasi Dasar Event</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Event <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Wedding Kevin & Sheila"
                      value={formData.name}
                      onChange={handleNameChange}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Slug URL <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center">
                      <span className="px-3 py-2 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-xs text-slate-500 font-mono">
                        /
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="wedding-kevin-sheila"
                        value={formData.slug}
                        onChange={(e) =>
                          setFormData({ ...formData, slug: generateSlug(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-r-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deskripsi Event
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Keterangan singkat tentang perayaan atau lokasi acara..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Event
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                    >
                      <option value="ACTIVE">ACTIVE (Aktif & Ditampilkan di Kiosk)</option>
                      <option value="INACTIVE">INACTIVE (Nonaktif / Arsip)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3 pt-6">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.isDefault}
                        onChange={(e) =>
                          setFormData({ ...formData, isDefault: e.target.checked })
                        }
                        className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">
                        Jadikan Event Default (Utama)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Section 2: Konfigurasi Branding & Teks */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  <Sparkles className="w-4 h-4 text-rose-500" />
                  <span>Branding & Teks Landing Page</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tema Tampilan
                    </label>
                    <select
                      value={formData.theme}
                      onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                    >
                      <option value="general">Umum & Ceria</option>
                      <option value="wedding">Pernikahan Romantis</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Pasangan / Host
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Kevin & Sheila"
                      value={formData.coupleNames}
                      onChange={(e) => setFormData({ ...formData, coupleNames: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Event
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 24 Oktober 2026"
                      value={formData.eventDate}
                      onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Judul Event (Landing)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: The Wedding Celebration"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sub-judul Event
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Abadikan momen bahagia di hari istimewa ini."
                      value={formData.subtitle}
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Footer Text
                  </label>
                  <input
                    type="text"
                    placeholder="Scan QR di hasil cetak untuk mengunduh fotomu"
                    value={formData.footerText}
                    onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Section 3: Video Background */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  <Video className="w-4 h-4 text-rose-500" />
                  <span>Video Background Event</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    URL Video Background / Path
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: /uploads/media/wedding-bg.mp4 atau https://..."
                    value={formData.videoBgUrl}
                    onChange={(e) => setFormData({ ...formData, videoBgUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Format yang didukung: MP4, WebM. Video ini akan otomatis dicache di browser klien untuk pemutaran instan.
                  </p>
                </div>
              </div>

              {/* Section 4: Pengaturan Cetak Printer */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  <Printer className="w-4 h-4 text-rose-500" />
                  <span>Pengaturan Printer Event</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Jumlah Cetak (Copies)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={formData.printCopies}
                      onChange={(e) =>
                        setFormData({ ...formData, printCopies: parseInt(e.target.value, 10) || 1 })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ukuran Kertas
                    </label>
                    <select
                      value={formData.paperSize}
                      onChange={(e) => setFormData({ ...formData, paperSize: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                    >
                      <option value="4R">4R (100 x 148 mm)</option>
                      <option value="3x5cm">3x5 cm (Stiker Foto)</option>
                      <option value="5x5cm">5x5 cm (Square)</option>
                      <option value="image">Sesuai Dimensi Gambar</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.autoPrint}
                        onChange={(e) =>
                          setFormData({ ...formData, autoPrint: e.target.checked })
                        }
                        className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">
                        Cetak Otomatis (Auto-print)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={handleBackToList}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/60 transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-5 py-2 rounded-xl flex items-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Simpan Event</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmEvent && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Hapus Event?</h3>
              </div>
              <p className="text-sm text-slate-600">
                Apakah Anda yakin ingin menghapus event{' '}
                <strong className="text-slate-900 font-semibold">{deleteConfirmEvent.name}</strong>?
                Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmEvent(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteConfirmEvent)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <span>Ya, Hapus</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
