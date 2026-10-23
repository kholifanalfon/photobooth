import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Sparkles,
  Settings,
  ArrowRight,
  AlertCircle,
  Tag,
  ShieldCheck,
  PartyPopper
} from 'lucide-react';

export default function EventSelectorScreen({
  events = [],
  onSelectEvent = () => {},
  onOpenAdmin = () => {}
}) {
  const hasEvents = Array.isArray(events) && events.length > 0;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-10 relative overflow-hidden select-none">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header & Operator Settings Button */}
      <header className="relative z-10 flex items-center justify-between w-full max-w-7xl mx-auto pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-pink-500/25">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold text-pink-400">
              Photobooth Kiosk
            </div>
            <div className="text-sm font-medium text-slate-400">
              Multi-Event System
            </div>
          </div>
        </div>

        {/* Top-right Operator Settings Button */}
        <button
          type="button"
          onClick={onOpenAdmin}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/10 text-slate-200 hover:text-white transition-all shadow-sm backdrop-blur-md touch-manipulation focus:outline-none focus:ring-2 focus:ring-pink-500"
          title="Buka Pengaturan Operator / Admin"
          aria-label="Pengaturan Admin"
        >
          <Settings className="w-5 h-5 text-slate-300" />
          <span className="hidden sm:inline text-sm font-medium">Pengaturan Admin</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col justify-center items-center w-full max-w-7xl mx-auto py-8">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <PartyPopper className="w-3.5 h-3.5" />
              Pilih Acara Anda
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md">
              Pilih Event
            </h1>
            <p className="mt-3 text-slate-300 text-base sm:text-lg leading-relaxed">
              Silakan pilih acara yang sedang berlangsung untuk memulai Photobooth.
            </p>
          </motion.div>
        </div>

        {/* Empty State vs Event Cards Grid */}
        <div className="w-full">
          {!hasEvents ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="max-w-md mx-auto p-8 rounded-3xl bg-slate-900/80 border border-slate-800 text-center backdrop-blur-xl shadow-2xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                Belum ada acara aktif
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Tidak ada event aktif yang tersedia untuk booth ini. Silakan buka Pengaturan Admin untuk mendaftarkan atau mengaktifkan acara.
              </p>
              <button
                type="button"
                onClick={onOpenAdmin}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white font-semibold text-sm shadow-lg shadow-pink-500/25 active:scale-[0.98] transition-all touch-manipulation"
              >
                <Settings className="w-4 h-4" />
                <span>Buka Pengaturan Admin</span>
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.08 }
                }
              }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full"
            >
              <AnimatePresence>
                {events.map((event) => {
                  const eventDate =
                    event?.config?.eventDate ||
                    event?.eventDate ||
                    'Tanggal tidak diset';
                  const theme = event?.config?.theme || 'general';
                  const status = event?.status || 'ACTIVE';

                  return (
                    <motion.div
                      key={event.id || event.slug}
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0 }
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onSelectEvent(event)}
                      className="group cursor-pointer flex flex-col justify-between p-6 sm:p-7 rounded-3xl bg-slate-900/80 hover:bg-slate-800/90 border border-white/10 hover:border-pink-500/40 shadow-xl hover:shadow-pink-500/10 backdrop-blur-xl transition-all duration-300 relative overflow-hidden touch-manipulation"
                    >
                      {/* Top Accent Gradient Hover Indicator */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-indigo-500 to-amber-500 opacity-60 group-hover:opacity-100 transition-opacity" />

                      <div>
                        {/* Badges Header */}
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {status}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                            <Tag className="w-3.5 h-3.5" />
                            {theme}
                          </span>
                        </div>

                        {/* Event Title */}
                        <h2 className="text-xl sm:text-2xl font-bold text-white group-hover:text-pink-300 transition-colors line-clamp-2 mb-3">
                          {event.name}
                        </h2>

                        {/* Event Date */}
                        <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                          <Calendar className="w-4 h-4 text-pink-400 shrink-0" />
                          <span className="line-clamp-1">{eventDate}</span>
                        </div>
                      </div>

                      {/* Card Action Button */}
                      <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium">
                          Sentuh untuk memulai
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(event);
                          }}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-indigo-600 group-hover:from-pink-600 group-hover:to-indigo-700 text-white font-semibold text-sm shadow-md shadow-pink-500/20 active:scale-95 transition-all"
                        >
                          <span>Masuk ke Booth</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer Kiosk Info */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div>Photobooth Kiosk Touch Interface</div>
        <div>Sentuh kartu acara untuk mulai berfoto</div>
      </footer>
    </div>
  );
}
