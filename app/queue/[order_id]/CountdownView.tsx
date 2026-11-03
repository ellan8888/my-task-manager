"use client";

// Tampilan order COUNTDOWN di halaman detail queue:
//   • cincin sisa waktu (kuning → oranye 15 menit terakhir → merah berdenyut 5 menit terakhir → hijau "Proses akhir")
//   • garis waktu Mulai → Selesai dengan titik yang bergerak
//   • label "+1 jam · diperpanjang" saat waktu ditambah ketika halaman sedang dibuka
//   • tombol cepat +15m / +30m / +1 jam (khusus admin)

import { useEffect, useRef, useState } from "react";

const R = 54;
const CIRC = 2 * Math.PI * R;

const timeWIB = (ms: number) =>
  new Date(ms).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

function spanText(ms: number) {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h && m) return `${h} jam ${m} menit`;
  if (h) return `${h} jam`;
  return `${m} menit`;
}

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function CountdownHero({
  startIso,
  endIso,
  now,
  isAdmin,
  saving,
  onQuickAdd,
  onOpenAddTime,
}: {
  startIso: string | null;
  endIso: string | null;
  now: number;
  isAdmin: boolean;
  saving: boolean;
  onQuickAdd: (minutes: number) => void;
  onOpenAddTime: () => void;
}) {
  const end = endIso ? new Date(endIso).getTime() : null;
  const startRaw = startIso ? new Date(startIso).getTime() : null;

  // ── Deteksi waktu ditambah selama halaman terbuka ──────────
  const prevEnd = useRef<number | null>(end);
  const [extended, setExtended] = useState<number | null>(null);
  useEffect(() => {
    const before = prevEnd.current;
    prevEnd.current = end;
    if (before == null || end == null || end - before < 30_000) return;
    const t0 = setTimeout(() => setExtended(end - before), 0);
    const t1 = setTimeout(() => setExtended(null), 6000);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
    };
  }, [end]);

  if (end == null) {
    return (
      <div className="text-center py-4">
        <p className="text-xl font-black text-amber-300">SEDANG DIPROSES</p>
        <p className="text-sm text-slate-400 mt-1">Jokian kamu sedang dikerjakan</p>
      </div>
    );
  }

  const start = startRaw != null && startRaw < end ? startRaw : null;
  const total = start != null ? end - start : null;
  const remaining = Math.max(0, end - now);
  const elapsed = start != null ? Math.min(total!, Math.max(0, now - start)) : null;
  const doneFrac = total ? Math.min(1, elapsed! / total) : remaining === 0 ? 1 : 0;
  const finished = remaining === 0;

  const phase = finished ? "done" : remaining <= 5 * 60_000 ? "critical" : remaining <= 15 * 60_000 ? "soon" : "normal";
  const color = { done: "#10b981", critical: "#f43f5e", soon: "#f97316", normal: "#f59e0b" }[phase];
  const textCls = {
    done: "text-emerald-300",
    critical: "text-rose-300",
    soon: "text-orange-300",
    normal: "text-amber-300",
  }[phase];

  // Cincin = sisa waktu (berkurang)
  const remainFrac = total ? remaining / total : finished ? 0 : 1;

  return (
    <div className="text-center">
      <style>{`
        @keyframes cd-pulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
        .cd-pulse { animation: cd-pulse 1.2s ease-in-out infinite }
        @keyframes cd-pop { 0% { opacity: 0; transform: translateY(6px) scale(.9) } 15% { opacity: 1; transform: none } 85% { opacity: 1 } 100% { opacity: 0 } }
        .cd-pop { animation: cd-pop 6s ease-out both }
        @media (prefers-reduced-motion: reduce) { .cd-pulse, .cd-pop { animation: none } }
      `}</style>

      {/* CINCIN */}
      <div className="relative w-44 h-44 mx-auto">
        <svg viewBox="0 0 128 128" className="w-44 h-44 -rotate-90" aria-hidden="true">
          <circle cx="64" cy="64" r={R} stroke="#1e293b" strokeWidth="9" fill="none" />
          <circle
            cx="64"
            cy="64"
            r={R}
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRC}
            strokeDashoffset={finished ? 0 : CIRC * (1 - remainFrac)}
            className={phase === "critical" ? "cd-pulse" : ""}
            style={{ transition: "stroke-dashoffset 1s linear, stroke .6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {finished ? (
            <>
              <i className="fa-solid fa-flag-checkered text-emerald-400 text-2xl"></i>
              <span className="mt-1.5 text-xs font-bold text-emerald-300">Waktu habis</span>
            </>
          ) : (
            <>
              <span className={`text-3xl font-black font-mono tracking-tight ${textCls} ${phase === "critical" ? "cd-pulse" : ""}`}>
                {clock(remaining)}
              </span>
              <span className="mt-1 text-[11px] font-bold text-slate-400">
                {total ? `${Math.floor(doneFrac * 100)}% berjalan` : "sisa waktu"}
              </span>
            </>
          )}
        </div>

        {/* Label diperpanjang */}
        {extended != null && (
          <span className="cd-pop absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 text-[11px] font-black shadow-lg shadow-amber-500/30">
            +{spanText(extended)} · diperpanjang
          </span>
        )}
      </div>

      <h2 className={`mt-4 text-xl md:text-2xl font-black ${textCls}`}>
        {finished ? "PROSES AKHIR" : phase === "critical" ? "HAMPIR SELESAI" : "SEDANG DIPROSES"}
      </h2>
      <p className="text-sm text-slate-400">
        {finished
          ? "Jokian kamu sudah dalam proses penyelesaian, mohon tunggu sebentar ya kak"
          : phase === "normal"
            ? "Jokian kamu sedang dikerjakan"
            : (
              <>
                Sebentar lagi selesai <i className="fa-solid fa-flag-checkered ml-1"></i>
              </>
            )}
      </p>

      {/* GARIS WAKTU */}
      <div className="mt-6 text-left">
        <div className="flex items-end justify-between text-[11px] mb-2">
          <div>
            <p className="uppercase tracking-wider font-bold text-slate-500">Mulai</p>
            <p className="font-mono font-bold text-slate-200 text-sm">{start != null ? timeWIB(start) : "—"}</p>
          </div>
          <div className="text-right">
            <p className="uppercase tracking-wider font-bold text-slate-500">Selesai</p>
            <p className="font-mono font-bold text-sm" style={{ color }}>
              ±{timeWIB(end)} WIB
            </p>
          </div>
        </div>
        <div className="relative h-2 rounded-full bg-slate-800">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${doneFrac * 100}%`, background: color, transition: "width 1s linear, background .6s ease" }}
          />
          <span
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-slate-950"
            style={{ left: `${doneFrac * 100}%`, background: color, boxShadow: `0 0 0 4px ${color}33`, transition: "left 1s linear" }}
          />
        </div>
        {elapsed != null && (
          <p className="text-[11px] text-slate-500 mt-2 text-center">
            Sudah berjalan {spanText(elapsed)}
            {!finished && ` · sisa ${spanText(remaining)}`}
          </p>
        )}
      </div>

      {/* AKSI ADMIN */}
      {isAdmin && (
        <div className="mt-5 pt-5 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2 flex items-center justify-center gap-1.5">
            <i className="fa-solid fa-shield-halved text-[9px]"></i>
            Tambah waktu
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              [15, "+15m"],
              [30, "+30m"],
              [60, "+1 jam"],
            ].map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => onQuickAdd(m as number)}
                disabled={saving}
                className="py-2.5 rounded-xl bg-slate-950/50 hover:bg-amber-500/15 border border-slate-800 hover:border-amber-500/50 text-amber-300 text-xs font-bold transition active:scale-95 disabled:opacity-50"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={onOpenAddTime}
              disabled={saving}
              className="py-2.5 rounded-xl bg-slate-950/50 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold transition active:scale-95 disabled:opacity-50"
              title="Atur jumlah waktu sendiri"
            >
              {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : "Lainnya"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
