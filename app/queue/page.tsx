"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

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
  // ⭐ Field progress — TAMBAH 4 INI
  order_type: string | null;
  progress_keyword: string | null;
  progress_count: number | null;
  target_count: number | null;
};

export default function QueuePage() {
  const [maxParallel, setMaxParallel] = useState(11);
const [isAdmin, setIsAdmin] = useState(false);
const [savingSlot, setSavingSlot] = useState(false);
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadQueue = async () => {
    const { data, error } = await supabase
      .from("joki_orders")
      .select("*")
      .eq("completed", false);

    if (error) {
      console.error("[Queue] load error:", error);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadQueue();

    const channel = supabase
      .channel("queue_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "joki_orders" },
        () => loadQueue()
      )
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
}, []);
const updateMaxParallel = async (newValue: number) => {
  if (newValue < 1 || newValue > 100) {
    alert("Slot harus antara 1-100");
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
      alert(data.error || "Gagal update slot");
      return;
    }

    setMaxParallel(data.max_parallel);
  } catch (err) {
    console.error(err);
    alert("Terjadi kesalahan");
  } finally {
    setSavingSlot(false);
  }
};

  const processing = orders.filter((o) => o.queue_status === "processing");
  const waiting = orders.filter((o) => o.queue_status === "waiting_confirm");
  const queued = orders.filter((o) => o.queue_status === "queued");
  const totalActive = processing.length + waiting.length;

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
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .queue-card-in {
          animation: queue-card-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
          /* Hide scrollbar — tapi tetap bisa scroll */
html, body {
  scrollbar-width: none;       /* Firefox */
  -ms-overflow-style: none;    /* IE 10+ */
}
html::-webkit-scrollbar,
body::-webkit-scrollbar {
  display: none;               /* Chrome, Safari, Edge */
}

        /* ============================================== */
        /* HIDE SCROLLBAR — tapi tetap bisa scroll        */
        /* ============================================== */
        .hide-scrollbar {
          scrollbar-width: none;        /* Firefox */
          -ms-overflow-style: none;     /* IE 10+ */
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;                /* Chrome, Safari, Edge */
        }

        /* Fallback — hide scrollbar untuk body */
        html, body {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        html::-webkit-scrollbar,
        body::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Selalu dark: pakai bg-slate-950 langsung, tanpa dark: */}
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-950 to-slate-900 text-white font-sans antialiased selection:bg-violet-500 selection:text-white">
        {/* HEADER */}
        <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="w-full px-4 md:px-6 lg:px-8 py-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-4">
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

                <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-600/30 ring-2 ring-violet-500/20">
                  <i className="fa-solid fa-list-check text-white text-lg"></i>
                </div>
                <div>
                  <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    Jokian Queue
                  </h2>
                  <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Status real-time • Update otomatis
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 rounded-2xl px-4 py-2.5">
  <i className="fa-solid fa-server text-violet-400 text-sm"></i>
  <span className="text-sm font-bold text-slate-300">Slot Aktif</span>
  <span
    className={`text-sm font-black ${
      totalActive >= maxParallel ? "text-rose-400" : "text-emerald-400"
    }`}
  >
    {totalActive}
  </span>
  <span className="text-slate-500 text-sm font-bold">/ {maxParallel}</span>

  {/* KONTROL ADMIN — cuma muncul kalau isAdmin */}
  {isAdmin && (
    <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-700/60">
      <button
        onClick={() => updateMaxParallel(maxParallel - 1)}
        disabled={savingSlot || maxParallel <= 1}
        className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed"
        title="Kurangi slot"
      >
        <i className="fa-solid fa-minus text-[10px]"></i>
      </button>
      <button
        onClick={() => updateMaxParallel(maxParallel + 1)}
        disabled={savingSlot || maxParallel >= 100}
        className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed"
        title="Tambah slot"
      >
        <i className="fa-solid fa-plus text-[10px]"></i>
      </button>
      {savingSlot && (
        <i className="fa-solid fa-spinner fa-spin text-violet-400 text-xs"></i>
      )}
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
              {/* PROCESSING */}
              <section>
                <SectionHeader
                  icon="fa-fire"
                  title="Sedang Diproses"
                  count={processing.length}
                  color="amber"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {processing.length === 0 ? (
                    <EmptyState
                      icon="fa-circle-notch"
                      text="Tidak ada jokian yang sedang diproses"
                    />
                  ) : (
                    processing.map((order) => (
                      <ProcessingCard key={order.id} order={order} now={now} />
                    ))
                  )}
                </div>
              </section>

              {/* WAITING CONFIRM */}
              <section>
                <SectionHeader
                  icon="fa-clock"
                  title="Menunggu Konfirmasi Penjoki"
                  count={waiting.length}
                  color="violet"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {waiting.length === 0 ? (
                    <EmptyState
                      icon="fa-inbox"
                      text="Tidak ada order menunggu konfirmasi"
                    />
                  ) : (
                    waiting.map((order) => (
                      <WaitingCard key={order.id} order={order} />
                    ))
                  )}
                </div>
              </section>

              {/* QUEUED */}
              <section>
                <SectionHeader
                  icon="fa-list-ol"
                  title="Antrian"
                  count={queued.length}
                  color="indigo"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {queued.length === 0 ? (
                    <EmptyState icon="fa-check-double" text="Tidak ada antrian" />
                  ) : (
                    queued.map((order) => (
                      <QueueCard key={order.id} order={order} />
                    ))
                  )}
                </div>
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
// SECTION HEADER
// ============================
function SectionHeader({
  icon,
  title,
  count,
  color,
}: {
  icon: string;
  title: string;
  count: number;
  color: "amber" | "violet" | "indigo";
}) {
  const colorMap = {
    amber: {
      text: "text-amber-400",
      border: "border-amber-500/20",
      bg: "bg-amber-500/10",
    },
    violet: {
      text: "text-violet-400",
      border: "border-violet-500/20",
      bg: "bg-violet-500/10",
    },
    indigo: {
      text: "text-indigo-400",
      border: "border-indigo-500/20",
      bg: "bg-indigo-500/10",
    },
  };

  const c = colorMap[color];

  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center`}
      >
        <i className={`fa-solid ${icon} ${c.text} text-sm`}></i>
      </div>
      <h2 className="text-base md:text-lg font-extrabold tracking-tight">
        {title}
      </h2>
      <span
        className={`text-xs font-bold ${c.text} ${c.bg} ${c.border} border px-2.5 py-1 rounded-full`}
      >
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
// PROCESSING CARD
// ============================
// ============================
// PROCESSING CARD
// ============================
function ProcessingCard({ order, now }: { order: QueueOrder; now: number }) {
  // ⭐ Detect progress order
  const isProgressOrder =
    order.order_type === "progress" ||
    (order.progress_keyword != null && (order.target_count ?? 0) > 0);

  // ⭐ Effective estimated end — null kalau progress order
  const effectiveEstimatedEnd = isProgressOrder ? null : order.estimated_end_at;

  const endTime = effectiveEstimatedEnd
    ? new Date(effectiveEstimatedEnd).getTime()
    : 0;
  const remaining = Math.max(0, endTime - now);
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  // ⭐ Overdue cuma buat countdown order
  const isOverdue = !isProgressOrder && remaining === 0;

  // ⭐ Progress percentage
  const progressPercent =
    isProgressOrder && order.target_count
      ? Math.min(100, ((order.progress_count ?? 0) / order.target_count) * 100)
      : 0;

  return (
    <Link
      href={`/queue/${order.order_id}`}
      className="queue-card-in group relative block bg-linear-to-br from-slate-900 to-slate-900/80 border-2 border-amber-500/40 rounded-2xl p-5 hover:border-amber-500/70 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
            <i
              className={`fa-solid ${
                isProgressOrder ? "fa-egg" : "fa-fire"
              } text-amber-400 text-sm`}
            ></i>
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-base truncate">
              {order.roblox_username || "Pembeli"}
            </h3>
            <p className="text-[11px] text-slate-500 font-mono truncate">
              #{order.order_id}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 pulse-dot"></span>
          LIVE
        </span>
      </div>

      {order.product && (
        <p className="text-xs text-slate-400 mb-3 truncate">{order.product}</p>
      )}

      {/* ⭐ PROGRESS ORDER — tampilkan progress bar, bukan countdown */}
      {isProgressOrder ? (
        <div className="pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <i className="fa-solid fa-egg text-violet-400"></i>
              Progress {(order.progress_keyword || "Egg").toUpperCase()}
            </span>
            <span className="text-sm font-black text-violet-300 font-mono">
              {order.progress_count ?? 0} / {order.target_count ?? 0}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-linear-to-r from-violet-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {progressPercent === 100
              ? "🎉 Selesai!"
              : `${Math.round(progressPercent)}% selesai`}
          </p>
        </div>
      ) : (
        // ⭐ COUNTDOWN ORDER — tampilkan timer kayak biasa
        <div className="pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <i className="fa-regular fa-clock text-amber-400"></i>
              Sisa Waktu
            </span>
            {order.estimated_end_at && (
              <span className="text-[10px] text-slate-500 font-mono">
                {new Date(order.estimated_end_at).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
          <p
            className={`text-2xl md:text-3xl font-black font-mono tracking-tight ${
              isOverdue ? "text-rose-400" : "text-amber-400"
            }`}
          >
            {isOverdue
              ? "SEGERA SELESAI"
              : `${hours > 0 ? hours + ":" : ""}${minutes
                  .toString()
                  .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`}
          </p>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <i className="fa-regular fa-user"></i>
          {order.joki_name || "Ellan"}
        </span>
        <span className="flex items-center gap-1 text-violet-400 font-semibold">
          Detail
          <i className="fa-solid fa-arrow-right text-[9px]"></i>
        </span>
      </div>
    </Link>
  );
}

// ============================
// WAITING CARD
// ============================
function WaitingCard({ order }: { order: QueueOrder }) {
  return (
    <Link
      href={`/queue/${order.order_id}`}
      className="queue-card-in group relative block bg-linear-to-br from-slate-900 to-slate-900/80 border border-violet-500/30 rounded-2xl p-5 hover:border-violet-500/60 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/10 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-clock text-violet-400 text-sm"></i>
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-base truncate">
              {order.roblox_username || "Pembeli"}
            </h3>
            <p className="text-[11px] text-slate-500 font-mono truncate">
              #{order.order_id}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-lg text-[10px] font-bold shrink-0">
          <i className="fa-solid fa-hourglass-half text-[9px]"></i>
          MENUNGGU
        </span>
      </div>

      {order.product && (
        <p className="text-xs text-slate-400 mb-3 truncate">{order.product}</p>
      )}

      <p className="text-xs text-slate-400 flex items-center gap-2">
        <i className="fa-solid fa-circle-info text-violet-400 text-[10px]"></i>
        Menunggu penjoki konfirmasi
      </p>

      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <i className="fa-regular fa-user"></i>
          {order.joki_name || "Ellan"}
        </span>
        <span className="flex items-center gap-1 text-violet-400 font-semibold">
          Detail
          <i className="fa-solid fa-arrow-right text-[9px]"></i>
        </span>
      </div>
    </Link>
  );
}

// ============================
// QUEUE CARD
// ============================
function QueueCard({ order }: { order: QueueOrder }) {
  return (
    <Link
      href={`/queue/${order.order_id}`}
      className="queue-card-in group relative block bg-linear-to-br from-slate-900 to-slate-900/80 border border-indigo-500/30 rounded-2xl p-5 hover:border-indigo-500/60 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-list-ol text-indigo-400 text-sm"></i>
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-base truncate">
              {order.roblox_username || "Pembeli"}
            </h3>
            <p className="text-[11px] text-slate-500 font-mono truncate">
              #{order.order_id}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-[10px] font-bold shrink-0">
          <i className="fa-solid fa-hashtag text-[9px]"></i>
          {order.queue_position ?? "-"}
        </span>
      </div>

      {order.product && (
        <p className="text-xs text-slate-400 mb-3 truncate">{order.product}</p>
      )}

      <p className="text-xs text-slate-400 flex items-center gap-2">
        <i className="fa-solid fa-circle-info text-indigo-400 text-[10px]"></i>
        Menunggu slot jokian tersedia
      </p>

      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <i className="fa-regular fa-user"></i>
          {order.joki_name || "Ellan"}
        </span>
        <span className="flex items-center gap-1 text-violet-400 font-semibold">
          Detail
          <i className="fa-solid fa-arrow-right text-[9px]"></i>
        </span>
      </div>
    </Link>
  );
}