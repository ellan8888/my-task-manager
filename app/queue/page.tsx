"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useToast } from "@/app/components/ToastProvider";
import {
  formatShortNumber,
  formatWIB,
  getDisplayTarget,
  getProgressPercent,
  maskUsername,
  timeAgo,
} from "@/lib/queueUtils";

type QueueOrder = {
  id: number;
  order_id: string;
  roblox_username: string | null;
  product: string | null;
  joki_name: string | null;
  queue_status: string;
  queue_position: number | null;
  processing_started_at: string | null;
  estimated_end_at: string | null;
  schedule_date: string;
  schedule_time: string;
  created_at?: string | null;
  // Field progress
  order_type: string | null;
  progress_keyword: string | null;
  progress_count: number | null;
  target_count: number | null;
  target_unit: string | null;
  /** Diisi otomatis oleh trigger DB saat progress_count berubah (SQL 003) */
  progress_updated_at?: string | null;
};

const isProgressOrder = (o: QueueOrder) =>
  o.order_type === "progress" || (o.progress_keyword != null && (o.target_count ?? 0) > 0);

const toMs = (iso: string | null | undefined) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/** Normalisasi ID order untuk pencarian: tanpa #, spasi, dan akhiran "(ID)" */
const normalizeId = (v: string) =>
  v
    .replace(/\s*\([A-Z]{2}\)\s*$/i, "")
    .replace(/[#\s]/g, "")
    .toLowerCase();

const HIGHLIGHT_MS = 5000;

export default function QueuePage() {
  const toast = useToast();
  const [maxParallel, setMaxParallel] = useState(11);
  const [isAdmin, setIsAdmin] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);

  // ⭐ Cari order
  const [search, setSearch] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlChecked = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadQueue = async () => {
    const { data, error } = await supabase.from("joki_orders").select("*").eq("completed", false);

    if (error) {
      console.error("[Queue] load error:", error);
    } else {
      setOrders(data || []);

      // ⭐ Link langsung: /queue?order=123456 → otomatis cari & sorot (sekali saja)
      if (!urlChecked.current) {
        urlChecked.current = true;
        const fromUrl = new URLSearchParams(window.location.search).get("order");
        if (fromUrl) {
          setSearch(fromUrl);
          const found = findOrder(fromUrl, data || []);
          if (found) focusOrder(found.order_id);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadQueue();

    const channel = supabase
      .channel("queue_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "joki_orders" }, () => loadQueue())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    // Load max_parallel dari API
    fetch("/api/queue/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMaxParallel(d.max_parallel);
      })
      .catch((err) => console.error("Gagal load max_parallel:", err));

    // Cek admin
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin))
      .catch(() => setIsAdmin(false));

    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  const updateMaxParallel = async (newValue: number) => {
    if (newValue < 1 || newValue > 100) {
      toast.warning("Slot harus antara 1–100");
      return;
    }

    setSavingSlot(true);
    try {
      const res = await fetch("/api/queue/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_parallel: newValue }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Gagal update slot");
        return;
      }

      setMaxParallel(data.max_parallel);
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan saat update slot");
    } finally {
      setSavingSlot(false);
    }
  };

  // ══════════════════════════════════════════════════════════
  // ⭐ Pembagian & urutan
  // ══════════════════════════════════════════════════════════
  const processingAll = orders.filter((o) => o.queue_status === "processing");

  const processingCountdown = processingAll
    .filter((o) => !isProgressOrder(o))
    .sort((a, b) => (toMs(a.estimated_end_at) ?? Infinity) - (toMs(b.estimated_end_at) ?? Infinity));

  const processingProgress = processingAll
    .filter((o) => isProgressOrder(o))
    .sort((a, b) => getProgressPercent(b) - getProgressPercent(a));

  const waiting = orders
    .filter((o) => o.queue_status === "waiting_confirm")
    .sort((a, b) => (toMs(a.created_at) ?? 0) - (toMs(b.created_at) ?? 0));

  const queued = orders
    .filter((o) => o.queue_status === "queued")
    .sort((a, b) => (a.queue_position ?? Infinity) - (b.queue_position ?? Infinity));

  const totalActive = processingAll.length + waiting.length;
  const freeSlots = Math.max(0, maxParallel - totalActive);

  // ══════════════════════════════════════════════════════════
  // ⭐ Perkiraan waktu mulai untuk antrian
  //    Slot kosong = sekarang. Slot countdown = saat countdown habis.
  //    Order progress & menunggu konfirmasi tidak punya jam selesai,
  //    jadi slotnya tidak dihitung.
  // ══════════════════════════════════════════════════════════
  const queueEstimates = (() => {
    const result = new Map<string, number | null>();

    const durations = processingCountdown
      .map((o) => {
        const s = toMs(o.processing_started_at);
        const e = toMs(o.estimated_end_at);
        return s != null && e != null && e > s ? e - s : null;
      })
      .filter((d): d is number => d != null);
    const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

    const slots: number[] = [];
    for (let i = 0; i < freeSlots; i++) slots.push(now);
    for (const o of processingCountdown) {
      const e = toMs(o.estimated_end_at);
      if (e != null) slots.push(Math.max(e, now));
    }
    slots.sort((a, b) => a - b);

    for (const o of queued) {
      const start = slots.shift();
      if (start == null) {
        result.set(o.order_id, null);
        continue;
      }
      result.set(o.order_id, start);
      if (avgDuration != null) {
        slots.push(start + avgDuration);
        slots.sort((a, b) => a - b);
      }
    }
    return result;
  })();

  // ══════════════════════════════════════════════════════════
  // ⭐ Cari order kamu
  // ══════════════════════════════════════════════════════════
  function findOrder(raw: string, list: QueueOrder[]): QueueOrder | null {
    const q = normalizeId(raw);
    if (!q) return null;
    return (
      list.find((o) => normalizeId(o.order_id) === q) ??
      (q.length >= 4 ? list.find((o) => normalizeId(o.order_id).includes(q)) : undefined) ??
      null
    );
  }

  function focusOrder(orderId: string) {
    setHighlightId(orderId);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    requestAnimationFrame(() => {
      document
        .getElementById(`order-${orderId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  const handleSearch = (e?: FormEvent) => {
    e?.preventDefault();
    if (!search.trim()) return;
    const found = findOrder(search, orders);
    if (found) {
      focusOrder(found.order_id);
    } else {
      toast.warning("Order tidak ada di antrian. Mungkin sudah selesai atau ID-nya salah.");
    }
  };

  const nameOf = (o: QueueOrder) => (isAdmin ? o.roblox_username || "Pembeli" : maskUsername(o.roblox_username));

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
          70% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        .pulse-dot { animation: pulse-ring 2s infinite; }

        @keyframes queue-card-in {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .queue-card-in { animation: queue-card-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }

        /* Kilau sekali lewat saat kartu muncul / pindah status */
        @keyframes queue-shine {
          from { transform: translateX(-120%) skewX(-20deg); }
          to   { transform: translateX(220%) skewX(-20deg); }
        }
        .queue-shine {
          position: absolute; inset: 0 auto 0 0; width: 40%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
          animation: queue-shine 1.1s ease-out 0.15s both;
          pointer-events: none;
        }

        /* Sorotan hasil "Cari order kamu" */
        @keyframes queue-highlight {
          0%, 100% { box-shadow: 0 0 0 0 rgba(167, 139, 250, 0.0), 0 0 0 2px rgba(167, 139, 250, 0.9); }
          50%      { box-shadow: 0 0 0 8px rgba(167, 139, 250, 0.18), 0 0 0 2px rgba(167, 139, 250, 0.9); }
        }
        .queue-highlight { animation: queue-highlight 1.2s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .queue-card-in, .queue-shine, .queue-highlight, .pulse-dot { animation: none; }
        }
      `}</style>

      {/* Selalu dark: pakai bg-slate-950 langsung, tanpa dark: */}
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-950 to-slate-900 text-white font-sans antialiased selection:bg-violet-500 selection:text-white">
        {/* HEADER */}
        <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="w-full px-4 md:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                {/* TOMBOL KEMBALI — cuma admin */}
                {isAdmin && (
                  <Link
                    href="/"
                    className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center transition text-slate-300 hover:text-white shrink-0"
                    title="Kembali ke Home"
                  >
                    <i className="fa-solid fa-arrow-left text-sm"></i>
                  </Link>
                )}

                <div className="w-11 h-11 rounded-2xl bg-linear-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-600/30 ring-2 ring-violet-500/20 shrink-0">
                  <i className="fa-solid fa-list-check text-white text-base"></i>
                </div>
                <div className="min-w-0">
                  <h1 className="text-base md:text-xl font-extrabold text-white tracking-tight">Jokian Queue</h1>
                  <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Real-time • update otomatis
                  </p>
                </div>
              </div>

              {/* SLOT */}
              <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl px-4 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-server text-violet-400 text-xs"></i>
                    <span className="text-xs font-bold text-slate-300">Slot aktif</span>
                    <span
                      className={`text-sm font-black ${totalActive >= maxParallel ? "text-rose-400" : "text-emerald-400"}`}
                    >
                      {totalActive}
                    </span>
                    <span className="text-slate-500 text-sm font-bold">/ {maxParallel}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full min-w-32 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        totalActive >= maxParallel ? "bg-rose-500" : "bg-linear-to-r from-emerald-500 to-teal-400"
                      }`}
                      style={{ width: `${Math.min(100, (totalActive / Math.max(1, maxParallel)) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* KONTROL ADMIN — cuma muncul kalau isAdmin */}
                {isAdmin && (
                  <div className="flex items-center gap-1 pl-3 border-l border-slate-700/60">
                    <button
                      onClick={() => updateMaxParallel(maxParallel - 1)}
                      disabled={savingSlot || maxParallel <= 1}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Kurangi slot"
                      aria-label="Kurangi slot"
                    >
                      <i className="fa-solid fa-minus text-[10px]"></i>
                    </button>
                    <button
                      onClick={() => updateMaxParallel(maxParallel + 1)}
                      disabled={savingSlot || maxParallel >= 100}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Tambah slot"
                      aria-label="Tambah slot"
                    >
                      <i className="fa-solid fa-plus text-[10px]"></i>
                    </button>
                    {savingSlot && <i className="fa-solid fa-spinner fa-spin text-violet-400 text-xs ml-1"></i>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="w-full p-4 md:p-8 space-y-8">
          {/* LOADING */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-400 text-sm">Memuat antrian...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* ⭐ RINGKASAN */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryTile icon="fa-fire" label="Sedang diproses" value={processingAll.length} color="amber" />
                <SummaryTile icon="fa-clock" label="Menunggu konfirmasi" value={waiting.length} color="violet" />
                <SummaryTile icon="fa-list-ol" label="Antrian" value={queued.length} color="indigo" />
                <SummaryTile icon="fa-circle-check" label="Slot kosong" value={freeSlots} color="emerald" />
              </div>

              {/* ⭐ CARI ORDER KAMU */}
              <form
                onSubmit={handleSearch}
                className="flex flex-col sm:flex-row gap-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-2"
              >
                <div className="relative flex-1">
                  <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari order kamu — masukkan ID order"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-11 pr-10 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition"
                    aria-label="ID order"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setHighlightId(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 flex items-center justify-center"
                      aria-label="Hapus pencarian"
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition flex items-center justify-center gap-2 shadow-md shadow-violet-600/30"
                >
                  <i className="fa-solid fa-location-crosshairs text-xs"></i>
                  Temukan
                </button>
              </form>

              {/* PROCESSING */}
              <section>
                <SectionHeader icon="fa-fire" title="Sedang Diproses" count={processingAll.length} color="amber" />

                {/* SUB-SECTION: COUNTDOWN */}
                <div className="mb-6">
                  <SubHeader icon="fa-hourglass-half" title="Countdown" count={processingCountdown.length} />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {processingCountdown.length === 0 ? (
                      <EmptyState icon="fa-circle-notch" text="Tidak ada jokian countdown" />
                    ) : (
                      processingCountdown.map((order) => (
                        <CountdownCard
                          key={order.id}
                          order={order}
                          now={now}
                          name={nameOf(order)}
                          highlighted={highlightId === order.order_id}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* SUB-SECTION: PROGRESS */}
                <div>
                  <SubHeader icon="fa-egg" title="Progress" count={processingProgress.length} />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {processingProgress.length === 0 ? (
                      <EmptyState icon="fa-circle-notch" text="Tidak ada jokian progress" />
                    ) : (
                      processingProgress.map((order) => (
                        <ProgressCard
                          key={order.id}
                          order={order}
                          now={now}
                          name={nameOf(order)}
                          highlighted={highlightId === order.order_id}
                        />
                      ))
                    )}
                  </div>
                </div>
              </section>

              {/* WAITING CONFIRM */}
              <section>
                <SectionHeader icon="fa-clock" title="Menunggu Konfirmasi Penjoki" count={waiting.length} color="violet" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {waiting.length === 0 ? (
                    <EmptyState icon="fa-inbox" text="Tidak ada order menunggu konfirmasi" />
                  ) : (
                    waiting.map((order) => (
                      <SimpleCard
                        key={order.id}
                        order={order}
                        name={nameOf(order)}
                        highlighted={highlightId === order.order_id}
                        color="violet"
                        icon="fa-clock"
                        badge={
                          <>
                            <i className="fa-solid fa-hourglass-half text-[9px]"></i>
                            MENUNGGU
                          </>
                        }
                        info="Menunggu penjoki konfirmasi"
                      />
                    ))
                  )}
                </div>
              </section>

              {/* QUEUED */}
              <section>
                <SectionHeader icon="fa-list-ol" title="Antrian" count={queued.length} color="indigo" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {queued.length === 0 ? (
                    <EmptyState icon="fa-check-double" text="Tidak ada antrian" />
                  ) : (
                    queued.map((order) => {
                      const eta = queueEstimates.get(order.order_id) ?? null;
                      const info =
                        eta == null
                          ? "Menunggu slot jokian kosong"
                          : eta - now <= 60_000
                            ? "Segera dimulai"
                            : `Perkiraan mulai ±${formatWIB(eta, now)} WIB`;
                      return (
                        <SimpleCard
                          key={order.id}
                          order={order}
                          name={nameOf(order)}
                          highlighted={highlightId === order.order_id}
                          color="indigo"
                          icon="fa-list-ol"
                          badge={
                            <>
                              <i className="fa-solid fa-hashtag text-[9px]"></i>
                              {order.queue_position ?? "-"}
                            </>
                          }
                          info={info}
                          infoIcon={eta == null ? "fa-circle-info" : "fa-calendar-check"}
                        />
                      );
                    })
                  )}
                </div>
                {queued.length > 0 && (
                  <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-info text-[10px]"></i>
                    Perkiraan mulai dihitung dari sisa waktu jokian yang sedang berjalan, bisa maju atau mundur.
                  </p>
                )}
              </section>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-800/60 mt-12">
          <div className="w-full px-4 md:px-6 lg:px-8 py-6 text-center">
            <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
              <i className="fa-solid fa-circle-info text-[10px]"></i>
              Halaman ini di-update otomatis setiap ada perubahan
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================
// WARNA
// ============================
type QColor = "amber" | "violet" | "indigo" | "emerald";

const COLORS: Record<
  QColor,
  { text: string; border: string; bg: string; cardBorder: string; cardHover: string; badge: string }
> = {
  amber: {
    text: "text-amber-400",
    border: "border-amber-500/20",
    bg: "bg-amber-500/10",
    cardBorder: "border-amber-500/40",
    cardHover: "hover:border-amber-500/70 hover:shadow-amber-500/10",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  violet: {
    text: "text-violet-400",
    border: "border-violet-500/20",
    bg: "bg-violet-500/10",
    cardBorder: "border-violet-500/30",
    cardHover: "hover:border-violet-500/60 hover:shadow-violet-500/10",
    badge: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  },
  indigo: {
    text: "text-indigo-400",
    border: "border-indigo-500/20",
    bg: "bg-indigo-500/10",
    cardBorder: "border-indigo-500/30",
    cardHover: "hover:border-indigo-500/60 hover:shadow-indigo-500/10",
    badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  },
  emerald: {
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/10",
    cardBorder: "border-emerald-500/30",
    cardHover: "hover:border-emerald-500/60 hover:shadow-emerald-500/10",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
};

// ============================
// RINGKASAN
// ============================
function SummaryTile({ icon, label, value, color }: { icon: string; label: string; value: number; color: QColor }) {
  const c = COLORS[color];
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center shrink-0`}>
        <i className={`fa-solid ${icon} ${c.text} text-sm`}></i>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400 font-semibold leading-tight">{label}</p>
        <p className={`text-xl font-black ${c.text}`}>{value}</p>
      </div>
    </div>
  );
}

// ============================
// SECTION HEADER
// ============================
function SectionHeader({ icon, title, count, color }: { icon: string; title: string; count: number; color: QColor }) {
  const c = COLORS[color];
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center`}>
        <i className={`fa-solid ${icon} ${c.text} text-sm`}></i>
      </div>
      <h2 className="text-base md:text-lg font-extrabold tracking-tight">{title}</h2>
      <span className={`text-xs font-bold ${c.text} ${c.bg} ${c.border} border px-2.5 py-1 rounded-full`}>{count}</span>
    </div>
  );
}

function SubHeader({ icon, title, count }: { icon: string; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3 pl-2 border-l-2 border-violet-500/50">
      <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
        <i className={`fa-solid ${icon} text-violet-400 text-xs`}></i>
      </div>
      <h3 className="text-sm font-bold text-slate-300">{title}</h3>
      <span className="text-[10px] font-bold text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  );
}

// ============================
// EMPTY STATE
// ============================
function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="col-span-full bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-3">
        <i className={`fa-solid ${icon} text-slate-500 text-lg`}></i>
      </div>
      <p className="text-slate-500 text-sm">{text}</p>
    </div>
  );
}

// ============================
// KERANGKA KARTU (dipakai semua kartu)
// ============================
function CardShell({
  order,
  name,
  color,
  icon,
  badge,
  highlighted,
  thick = false,
  children,
}: {
  order: QueueOrder;
  name: string;
  color: QColor;
  icon: string;
  badge: ReactNode;
  highlighted: boolean;
  thick?: boolean;
  children: ReactNode;
}) {
  const c = COLORS[color];
  return (
    <Link
      id={`order-${order.order_id}`}
      href={`/queue/${order.order_id}`}
      className={`queue-card-in group relative block overflow-hidden scroll-mt-28 bg-linear-to-br from-slate-900 to-slate-900/80 ${
        thick ? "border-2" : "border"
      } ${c.cardBorder} ${c.cardHover} rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
        highlighted ? "queue-highlight" : ""
      }`}
    >
      <span className="queue-shine" aria-hidden="true"></span>

      {highlighted && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-b-lg bg-violet-500 text-white text-[10px] font-bold">
          Order kamu
        </span>
      )}

      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-10 h-10 rounded-xl ${c.badge} border flex items-center justify-center shrink-0`}>
            <i className={`fa-solid ${icon} ${c.text} text-sm`}></i>
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-base truncate">{name}</h3>
            <p className="text-[11px] text-slate-500 font-mono truncate">#{order.order_id}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 px-2.5 py-1 ${c.badge} border rounded-lg text-[10px] font-bold shrink-0`}>
          {badge}
        </span>
      </div>

      {order.product && <p className="text-xs text-slate-400 mb-3 truncate">{order.product}</p>}

      {children}

      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <i className="fa-regular fa-user"></i>
          {order.joki_name || "Ellan"}
        </span>
        <span className="flex items-center gap-1 text-violet-400 font-semibold group-hover:gap-2 transition-all">
          Detail
          <i className="fa-solid fa-arrow-right text-[9px]"></i>
        </span>
      </div>
    </Link>
  );
}

const LiveBadge = () => (
  <>
    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 pulse-dot"></span>
    LIVE
  </>
);

// ============================
// KARTU COUNTDOWN — dengan cincin waktu
// ============================
const RING_R = 24;
const RING_C = 2 * Math.PI * RING_R;

function CountdownCard({
  order,
  now,
  name,
  highlighted,
}: {
  order: QueueOrder;
  now: number;
  name: string;
  highlighted: boolean;
}) {
  const end = toMs(order.estimated_end_at);
  const start = toMs(order.processing_started_at);
  const remaining = end != null ? Math.max(0, end - now) : 0;
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  const isOverdue = end != null && remaining === 0;
  const total = end != null && start != null && end > start ? end - start : null;
  const fraction = total ? Math.min(1, remaining / total) : end != null ? 1 : 0;
  // Merah kalau tinggal < 5 menit atau < 10%
  const almost = !isOverdue && end != null && (remaining < 5 * 60_000 || fraction < 0.1);

  const ringColor = isOverdue || almost ? "stroke-rose-400" : "stroke-amber-400";
  const textColor = isOverdue || almost ? "text-rose-400" : "text-amber-400";

  return (
    <CardShell order={order} name={name} color="amber" icon="fa-fire" badge={<LiveBadge />} highlighted={highlighted} thick>
      <div className="pt-4 border-t border-slate-800/80 flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 56 56" className="w-16 h-16 -rotate-90" aria-hidden="true">
            <circle cx="28" cy="28" r={RING_R} className="stroke-slate-800" strokeWidth="5" fill="none" />
            <circle
              cx="28"
              cy="28"
              r={RING_R}
              className={`${ringColor} transition-[stroke-dashoffset] duration-1000 ease-linear`}
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - fraction)}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <i className={`fa-solid ${isOverdue ? "fa-flag-checkered" : "fa-hourglass-half"} ${textColor} text-sm`}></i>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Sisa waktu</p>
          <p className={`text-2xl md:text-3xl font-black font-mono tracking-tight ${textColor}`}>
            {end == null
              ? "--:--"
              : isOverdue
                ? "SEGERA SELESAI"
                : `${hours > 0 ? hours + ":" : ""}${minutes.toString().padStart(2, "0")}:${seconds
                    .toString()
                    .padStart(2, "0")}`}
          </p>
          {end != null && !isOverdue && (
            <p className="text-[11px] text-slate-500">Selesai ±{formatWIB(end, now)} WIB</p>
          )}
        </div>
      </div>
    </CardShell>
  );
}

// ============================
// KARTU PROGRESS
// ============================
function ProgressCard({
  order,
  now,
  name,
  highlighted,
}: {
  order: QueueOrder;
  now: number;
  name: string;
  highlighted: boolean;
}) {
  const percent = getProgressPercent(order);
  const lastUpdate = timeAgo(order.progress_updated_at, now);
  const keyword = (order.progress_keyword || "Egg").toUpperCase();

  return (
    <CardShell order={order} name={name} color="amber" icon="fa-egg" badge={<LiveBadge />} highlighted={highlighted} thick>
      <div className="pt-4 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <i className="fa-solid fa-egg text-violet-400"></i>
            Progress {keyword}
          </span>
          <span className="text-sm font-black text-violet-300 font-mono">
            {formatShortNumber(order.progress_count ?? 0)} / {getDisplayTarget(order)}
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-linear-to-r from-violet-500 to-indigo-500 transition-all duration-700 rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px]">
          <span className="text-slate-400 font-semibold">
            {percent >= 100 ? "🎉 Selesai!" : `${Math.floor(percent)}% selesai`}
          </span>
          {lastUpdate && (
            <span className="text-slate-500 flex items-center gap-1" title="Terakhir kali progres berubah">
              <i className="fa-solid fa-rotate text-[9px]"></i>
              Update {lastUpdate}
            </span>
          )}
        </div>
      </div>
    </CardShell>
  );
}

// ============================
// KARTU MENUNGGU / ANTRIAN
// ============================
function SimpleCard({
  order,
  name,
  highlighted,
  color,
  icon,
  badge,
  info,
  infoIcon = "fa-circle-info",
}: {
  order: QueueOrder;
  name: string;
  highlighted: boolean;
  color: QColor;
  icon: string;
  badge: ReactNode;
  info: string;
  infoIcon?: string;
}) {
  const c = COLORS[color];
  return (
    <CardShell order={order} name={name} color={color} icon={icon} badge={badge} highlighted={highlighted}>
      <p className="text-xs text-slate-300 flex items-center gap-2">
        <i className={`fa-solid ${infoIcon} ${c.text} text-[11px]`}></i>
        {info}
      </p>
    </CardShell>
  );
}
