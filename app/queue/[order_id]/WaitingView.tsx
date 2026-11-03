"use client";

// Tampilan status sebelum order dikerjakan di halaman detail queue:
//   • StatusSteps  — garis langkah: Order masuk → Dikonfirmasi → Diproses → Selesai (dipakai di semua status)
//   • WaitingHero  — status "Menunggu konfirmasi"
//   • QueueHero    — status "Antrian": nomor besar, deretan posisi, perkiraan mulai, animasi "Antrian maju!"

import { useEffect, useRef, useState } from "react";
import { formatWIB } from "@/lib/queueUtils";

// ─────────────────────────────────────────────────────────────
// Garis langkah status
// ─────────────────────────────────────────────────────────────
const STEPS = ["Order masuk", "Dikonfirmasi", "Diproses", "Selesai"] as const;

export type StepStatus = "waiting_confirm" | "queued" | "processing" | "completed";

/** Langkah yang sedang berjalan (0–3). Langkah sebelumnya dianggap selesai. */
function activeIndex(status: StepStatus) {
  switch (status) {
    case "waiting_confirm":
      return 1; // order masuk selesai, menunggu dikonfirmasi
    case "queued":
      return 2; // sudah dikonfirmasi, menunggu giliran diproses
    case "processing":
      return 2;
    case "completed":
      return 4; // semua selesai
  }
}

const STEP_COLOR: Record<StepStatus, string> = {
  waiting_confirm: "#a78bfa",
  queued: "#818cf8",
  processing: "#f59e0b",
  completed: "#10b981",
};

export function StatusSteps({ status, hint }: { status: StepStatus; hint?: string | null }) {
  const active = activeIndex(status);
  const color = STEP_COLOR[status];
  const fill = Math.min(1, active / (STEPS.length - 1));

  return (
    <div className="mb-6" aria-label="Tahapan order">
      <style>{`
        @keyframes st-ping { 0% { transform: scale(1); opacity: .55 } 100% { transform: scale(2.3); opacity: 0 } }
        .st-ping { animation: st-ping 1.6s cubic-bezier(0,0,.2,1) infinite }
        @media (prefers-reduced-motion: reduce) { .st-ping { animation: none } }
      `}</style>
      <div className="relative">
        {/* garis dasar + garis terisi */}
        <div className="absolute top-[9px] left-[12.5%] right-[12.5%] h-0.5 bg-slate-800 rounded-full" />
        <div
          className="absolute top-[9px] left-[12.5%] h-0.5 rounded-full"
          style={{ width: `${fill * 75}%`, background: color, transition: "width .8s ease, background .6s ease" }}
        />
        <ol className="relative grid grid-cols-4">
          {STEPS.map((label, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <li key={label} className="flex flex-col items-center text-center" aria-current={current ? "step" : undefined}>
                <span className="relative w-5 h-5 flex items-center justify-center">
                  {current && <span className="st-ping absolute inset-0 rounded-full" style={{ background: color }} />}
                  <span
                    className="relative w-5 h-5 rounded-full flex items-center justify-center border-2 text-[9px] text-slate-950"
                    style={{
                      background: done ? color : "#0f172a",
                      borderColor: done || current ? color : "#334155",
                      transition: "background .6s ease, border-color .6s ease",
                    }}
                  >
                    {done ? (
                      <i className="fa-solid fa-check"></i>
                    ) : current ? (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    ) : null}
                  </span>
                </span>
                <span
                  className={`mt-1.5 text-[10px] sm:text-[11px] font-bold leading-tight ${
                    current ? "" : done ? "text-slate-300" : "text-slate-600"
                  }`}
                  style={current ? { color } : undefined}
                >
                  {label}
                </span>
                {current && hint && <span className="text-[9px] sm:text-[10px] text-slate-500 leading-tight mt-0.5">{hint}</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Menunggu konfirmasi
// ─────────────────────────────────────────────────────────────
export function WaitingHero() {
  return (
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto mb-5">
        <span className="absolute inset-0 rounded-3xl bg-violet-500/20 animate-pulse" />
        <div className="relative w-20 h-20 rounded-3xl bg-violet-500/20 text-violet-400 flex items-center justify-center border border-violet-500/40">
          <i className="fa-solid fa-hourglass-half text-3xl"></i>
        </div>
      </div>
      <h2 className="text-xl md:text-2xl font-black mb-2 text-violet-300">MENUNGGU KONFIRMASI</h2>
      <p className="text-sm text-slate-400">Order kamu sudah masuk, tim kami akan segera mengonfirmasi</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Antrian
// ─────────────────────────────────────────────────────────────
function untilText(ms: number) {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `sekitar ${min} menit lagi`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `sekitar ${h} jam ${m} menit lagi` : `sekitar ${h} jam lagi`;
}

const MAX_DOTS = 10;

export function QueueHero({
  position,
  totalQueued,
  eta,
  now,
}: {
  position: number | null;
  totalQueued: number;
  /** Perkiraan jam mulai (ms). undefined = masih dihitung, null = belum bisa diperkirakan */
  eta: number | null | undefined;
  now: number;
}) {
  // ── Deteksi antrian maju ──────────────────────────────────
  const prevPos = useRef<number | null>(position);
  const [moved, setMoved] = useState<{ from: number; key: number } | null>(null);
  useEffect(() => {
    const before = prevPos.current;
    prevPos.current = position;
    if (before == null || position == null || position >= before) return;
    const t0 = setTimeout(() => setMoved({ from: before, key: Date.now() }), 0);
    const t1 = setTimeout(() => setMoved(null), 5000);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
    };
  }, [position]);

  const ahead = position != null ? Math.max(0, position - 1) : null;
  const total = Math.max(totalQueued, position ?? 0);
  // Deretan titik: maksimal 10, posisi kamu selalu kelihatan
  const shown = Math.min(total, MAX_DOTS);
  const youIndex = position != null ? Math.min(position, shown) - 1 : -1;

  let etaLine: string;
  if (eta === undefined) etaLine = "Menghitung perkiraan…";
  else if (eta === null) etaLine = "Perkiraan mulai belum tersedia";
  else if (eta - now <= 60_000) etaLine = "Sebentar lagi giliranmu";
  else etaLine = `Perkiraan mulai ±${formatWIB(eta, now)} WIB`;

  return (
    <div className="text-center">
      <style>{`
        @keyframes q-num { 0% { transform: translateY(60%); opacity: 0 } 60% { transform: translateY(-6%); opacity: 1 } 100% { transform: none } }
        .q-num { animation: q-num .7s cubic-bezier(.22,1,.36,1) both }
        @keyframes q-old { 0% { transform: none; opacity: 1 } 100% { transform: translateY(-70%); opacity: 0 } }
        .q-old { animation: q-old .5s ease-in both }
        @keyframes q-pop { 0% { opacity: 0; transform: translateY(6px) scale(.9) } 12% { opacity: 1; transform: none } 85% { opacity: 1 } 100% { opacity: 0 } }
        .q-pop { animation: q-pop 5s ease-out both }
        @keyframes q-you { 0%,100% { box-shadow: 0 0 0 0 rgba(129,140,248,.6) } 50% { box-shadow: 0 0 0 6px rgba(129,140,248,0) } }
        .q-you { animation: q-you 1.8s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .q-num, .q-old, .q-pop, .q-you { animation: none } }
      `}</style>

      <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-indigo-400/80">Nomor antrian</p>

      {/* Nomor besar */}
      <div className="relative h-24 mt-1 overflow-hidden flex items-center justify-center">
        {moved && (
          <span key={`old-${moved.key}`} className="q-old absolute text-7xl font-black text-indigo-300/40 tabular-nums">
            #{moved.from}
          </span>
        )}
        <span key={`now-${moved?.key ?? 0}`} className={`text-7xl font-black text-indigo-300 tabular-nums ${moved ? "q-num" : ""}`}>
          #{position ?? "-"}
        </span>
        {moved && (
          <span
            key={`pop-${moved.key}`}
            className="q-pop absolute top-1 left-1/2 ml-14 whitespace-nowrap px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 text-[11px] font-black shadow-lg shadow-emerald-500/30"
          >
            <i className="fa-solid fa-arrow-up mr-1"></i>Antrian maju!
          </span>
        )}
      </div>

      <p className="text-sm text-slate-400">
        {ahead == null
          ? "Order kamu sedang dalam antrian"
          : ahead === 0
            ? (
              <span className="text-indigo-300 font-bold">
                <i className="fa-solid fa-forward-step mr-1.5"></i>Kamu antrian berikutnya
              </span>
            )
            : `${ahead} order di depan kamu`}
      </p>

      {/* Deretan posisi */}
      {shown > 0 && (
        <div className="mt-5 flex items-end justify-center gap-1.5 flex-wrap" aria-hidden="true">
          {Array.from({ length: shown }, (_, i) => {
            const isYou = i === youIndex;
            const isAhead = i < youIndex;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span
                  className={`block rounded-lg transition-all duration-500 ${
                    isYou
                      ? "q-you w-7 h-7 bg-indigo-400"
                      : isAhead
                        ? "w-5 h-5 bg-indigo-500/40"
                        : "w-5 h-5 bg-slate-800 border border-slate-700"
                  }`}
                />
                <span className={`text-[9px] font-bold ${isYou ? "text-indigo-300" : "text-transparent"}`}>kamu</span>
              </div>
            );
          })}
          {total > MAX_DOTS && <span className="text-[11px] text-slate-500 font-bold pb-5">+{total - MAX_DOTS}</span>}
        </div>
      )}

      {/* Perkiraan mulai */}
      <div className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-950/50 border border-indigo-500/20 text-left">
        <i className={`fa-solid ${eta ? "fa-calendar-check" : "fa-circle-info"} text-indigo-400`}></i>
        <div>
          <p className="text-sm font-bold text-slate-200">{etaLine}</p>
          {eta != null && eta - now > 60_000 && <p className="text-[11px] text-slate-500">{untilText(eta - now)}</p>}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">Halaman ini akan memberi tahu kamu begitu order mulai dikerjakan</p>
    </div>
  );
}
