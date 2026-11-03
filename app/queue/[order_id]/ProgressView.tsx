"use client";

// Tampilan order PROGRESS (egg / income) di halaman detail queue:
//   • ProgressHero  — cincin progress besar + penanda 25/50/75% + kecepatan & perkiraan selesai
//   • EggFeed       — egg terbaru (live, badge BARU, animasi masuk + notifikasi)
//   • EggBreakdown  — rarity target selalu terbuka, rarity lain jadi "Bonus" yang bisa dibuka

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/app/components/ToastProvider";
import { formatShortNumber, getRealTarget } from "@/lib/queueUtils";

export type EggLog = {
  egg_name: string;
  area: string | null;
  size: string | null;
  weight: string | null;
  counted: boolean;
  created_at: string;
};

export type ProgressData = {
  order: {
    progress_keyword: string;
    progress_count: number;
    target_count: number;
    target_unit: string | null;
    is_complete: boolean;
  };
  eggs: { total: number; counted: number; by_rarity: Record<string, EggLog[]> };
};

// ══════════════════════════════════════════════════════════════
// WARNA RARITY
// ══════════════════════════════════════════════════════════════

type Tone = { text: string; chip: string; box: string; ring: string; hex: string; icon: string };

const TONES: Record<string, Tone> = {
  eternal: { text: "text-violet-300", chip: "bg-violet-500/15 text-violet-300 border-violet-500/30", box: "border-violet-500/40 bg-violet-500/10", ring: "#8b5cf6", hex: "#a78bfa", icon: "fa-star" },
  secret: { text: "text-cyan-300", chip: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30", box: "border-cyan-500/30 bg-cyan-500/5", ring: "#06b6d4", hex: "#67e8f9", icon: "fa-gem" },
  divine: { text: "text-yellow-300", chip: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", box: "border-yellow-500/30 bg-yellow-500/5", ring: "#eab308", hex: "#fde047", icon: "fa-sun" },
  cosmic: { text: "text-indigo-300", chip: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30", box: "border-indigo-500/30 bg-indigo-500/5", ring: "#6366f1", hex: "#a5b4fc", icon: "fa-meteor" },
  mythic: { text: "text-fuchsia-300", chip: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30", box: "border-fuchsia-500/30 bg-fuchsia-500/5", ring: "#d946ef", hex: "#f0abfc", icon: "fa-dragon" },
  mythical: { text: "text-fuchsia-300", chip: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30", box: "border-fuchsia-500/30 bg-fuchsia-500/5", ring: "#d946ef", hex: "#f0abfc", icon: "fa-dragon" },
  legendary: { text: "text-amber-300", chip: "bg-amber-500/15 text-amber-300 border-amber-500/30", box: "border-amber-500/30 bg-amber-500/5", ring: "#f59e0b", hex: "#fcd34d", icon: "fa-crown" },
  epic: { text: "text-purple-300", chip: "bg-purple-500/15 text-purple-300 border-purple-500/30", box: "border-purple-500/30 bg-purple-500/5", ring: "#a855f7", hex: "#d8b4fe", icon: "fa-bolt" },
  rare: { text: "text-blue-300", chip: "bg-blue-500/15 text-blue-300 border-blue-500/30", box: "border-blue-500/30 bg-blue-500/5", ring: "#3b82f6", hex: "#93c5fd", icon: "fa-diamond" },
};
const DEFAULT_TONE: Tone = {
  text: "text-slate-300",
  chip: "bg-slate-700/40 text-slate-300 border-slate-600/40",
  box: "border-slate-700 bg-slate-800/40",
  ring: "#64748b",
  hex: "#cbd5e1",
  icon: "fa-egg",
};
const toneOf = (rarity: string) => TONES[rarity.toLowerCase()] || DEFAULT_TONE;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const timeWIB = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
const ago = (ms: number) => {
  if (ms < 60_000) return "baru saja";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} menit lalu`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} jam lalu`;
  return `${Math.floor(ms / 86_400_000)} hari lalu`;
};
const durationText = (ms: number) => {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  if (h >= 24) return `±${Math.round(h / 24)} hari`;
  if (h > 0) return `±${h} jam${m >= 10 ? ` ${m} mnt` : ""}`;
  return `±${Math.max(1, m)} menit`;
};
const eggKey = (e: EggLog) => `${e.created_at}|${e.egg_name}`;

// ══════════════════════════════════════════════════════════════
// HERO — cincin progress
// ══════════════════════════════════════════════════════════════

const R = 54;
const CIRC = 2 * Math.PI * R;

export function ProgressHero({
  data,
  fallbackTargetCount,
  fallbackTargetUnit,
  now,
  isCompleted,
}: {
  data: ProgressData;
  fallbackTargetCount: number | null;
  fallbackTargetUnit: string | null;
  now: number;
  isCompleted: boolean;
}) {
  const keyword = data.order.progress_keyword || "egg";
  const isIncome = keyword.toLowerCase().includes("income");
  const tone = toneOf(keyword);
  const targetUnit = data.order.target_unit ?? fallbackTargetUnit;
  const real = getRealTarget({
    progress_count: data.order.progress_count,
    target_count: data.order.target_count || fallbackTargetCount,
    target_unit: targetUnit,
  });
  const pct = Math.min(100, Math.max(0, ((data.order.progress_count ?? 0) / real) * 100));
  const displayTarget =
    targetUnit && targetUnit !== "Joki" ? targetUnit : String(data.order.target_count || fallbackTargetCount || 0);
  const done = isCompleted || pct >= 100;

  // Kecepatan & perkiraan selesai (khusus egg, dari waktu egg yang masuk hitungan)
  const counted = Object.values(data.eggs.by_rarity)
    .flat()
    .filter((e) => e.counted)
    .map((e) => new Date(e.created_at).getTime())
    .sort((a, b) => a - b);
  const allTimes = Object.values(data.eggs.by_rarity)
    .flat()
    .map((e) => new Date(e.created_at).getTime());
  const lastEgg = allTimes.length ? Math.max(...allTimes) : null;

  let ratePerHour: number | null = null;
  let eta: number | null = null;
  if (!isIncome && counted.length >= 2) {
    const span = Math.max(now - counted[0], 15 * 60_000);
    ratePerHour = (counted.length / span) * 3_600_000;
    const left = Math.max(0, (data.order.target_count || 0) - (data.order.progress_count || 0));
    if (left > 0 && ratePerHour > 0) eta = (left / ratePerHour) * 3_600_000;
  }

  return (
    <div className="text-center">
      <div className="relative w-40 h-40 mx-auto">
        <svg viewBox="0 0 128 128" className="w-40 h-40 -rotate-90" aria-hidden="true">
          <circle cx="64" cy="64" r={R} stroke="#1e293b" strokeWidth="10" fill="none" />
          <circle
            cx="64"
            cy="64"
            r={R}
            stroke={done ? "#10b981" : tone.ring}
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - pct / 100)}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black font-mono text-white leading-none">
            {formatShortNumber(data.order.progress_count ?? 0)}
            <span className="text-base text-slate-500">/{displayTarget}</span>
          </span>
          <span className={`mt-1 text-sm font-black ${done ? "text-emerald-400" : tone.text}`}>{Math.floor(pct)}%</span>
        </div>
      </div>

      <h2 className={`mt-4 text-xl md:text-2xl font-black ${done ? "text-emerald-300" : tone.text}`}>
        {done ? "TARGET TERCAPAI" : "SEDANG DIPROSES"}
      </h2>
      <p className="text-sm text-slate-400">
        Target {keyword.toUpperCase()} {isIncome ? "" : "egg"}
      </p>

      {/* Penanda 25 / 50 / 75 % */}
      <div className="mt-5 grid grid-cols-4 gap-1.5 max-w-xs mx-auto" aria-label="Pencapaian">
        {[25, 50, 75, 100].map((m) => {
          const passed = pct >= m;
          return (
            <div key={m} className="text-center">
              <div
                className={`h-1.5 rounded-full transition-all duration-700 ${passed ? "" : "bg-slate-800"}`}
                style={passed ? { background: done ? "#10b981" : tone.ring, boxShadow: `0 0 8px ${done ? "#10b981" : tone.ring}` } : undefined}
              />
              <span className={`text-[10px] font-bold ${passed ? "text-slate-200" : "text-slate-600"}`}>{m}%</span>
            </div>
          );
        })}
      </div>

      {/* Statistik */}
      {!isIncome && (
        <div className="mt-5 grid grid-cols-3 gap-2 text-left">
          <Stat icon="fa-gauge-high" label="Kecepatan" value={ratePerHour ? `${ratePerHour.toFixed(1)}/jam` : "—"} />
          <Stat icon="fa-hourglass-half" label="Perkiraan selesai" value={done ? "Selesai" : eta ? durationText(eta) : "—"} />
          <Stat icon="fa-clock-rotate-left" label="Egg terakhir" value={lastEgg ? ago(now - lastEgg) : "—"} />
        </div>
      )}
      {!isIncome && (
        <p className="mt-3 text-[11px] text-slate-500">
          {data.eggs.total} egg terkumpul · {data.eggs.counted} masuk hitungan target
        </p>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-950/50 border border-slate-800 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
        <i className={`fa-solid ${icon} text-[9px]`}></i>
        {label}
      </p>
      <p className="text-sm font-black text-white mt-0.5 truncate">{value}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// FEED TERBARU + DAFTAR EGG
// ══════════════════════════════════════════════════════════════

const NEW_WINDOW_MS = 10 * 60_000;

export function EggSection({ data, now }: { data: ProgressData; now: number }) {
  const toast = useToast();
  const keyword = (data.order.progress_keyword || "").toLowerCase();

  const all = Object.entries(data.eggs.by_rarity).flatMap(([rarity, eggs]) => eggs.map((e) => ({ ...e, rarity })));
  const latest = [...all].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  // Deteksi egg baru selama halaman terbuka → animasi + notifikasi
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const allKeys = all.map(eggKey).join(",");
  useEffect(() => {
    const keys = new Set(allKeys ? allKeys.split(",") : []);
    if (known.current === null) {
      known.current = keys;
      return;
    }
    const added = [...keys].filter((k) => !known.current!.has(k));
    known.current = keys;
    if (!added.length) return;
    const t0 = setTimeout(() => setFresh(new Set(added)), 0);
    const newest = all.find((e) => eggKey(e) === added[added.length - 1]);
    if (newest) toast.success(`Egg baru: ${newest.egg_name} (${cap(newest.rarity)})`);
    const t1 = setTimeout(() => setFresh(new Set()), 4000);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKeys]);

  const rarities = Object.keys(data.eggs.by_rarity);
  const target = rarities.filter((r) => r.toLowerCase() === keyword);
  const bonus = rarities.filter((r) => r.toLowerCase() !== keyword);
  const bonusCount = bonus.reduce((s, r) => s + data.eggs.by_rarity[r].length, 0);
  const [openBonus, setOpenBonus] = useState<Record<string, boolean>>({});

  if (all.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
        <i className="fa-solid fa-egg text-2xl text-slate-700 mb-2 block"></i>
        Belum ada egg yang didapat. Halaman ini update otomatis.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes egg-in { from { opacity: 0; transform: translateY(-10px) scale(.97) } to { opacity: 1; transform: none } }
        .egg-in { animation: egg-in .5s cubic-bezier(.22,1,.36,1) both }
        @keyframes egg-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0) } 50% { box-shadow: 0 0 0 3px rgba(16,185,129,.35) } }
        .egg-glow { animation: egg-glow 1.2s ease-in-out 2 }
        @media (prefers-reduced-motion: reduce) { .egg-in, .egg-glow { animation: none } }
      `}</style>

      {/* TERBARU */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Terbaru
        </p>
        <ul className="space-y-1.5">
          {latest.map((e) => {
            const t = toneOf(e.rarity);
            const isNew = now - new Date(e.created_at).getTime() < NEW_WINDOW_MS;
            const isFresh = fresh.has(eggKey(e));
            return (
              <li
                key={eggKey(e)}
                className={`egg-in flex items-center gap-3 rounded-xl bg-slate-950/50 border border-slate-800 px-3 py-2 ${isFresh ? "egg-glow" : ""}`}
              >
                <span className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${t.chip}`}>
                  <i className={`fa-solid ${t.icon} text-xs`}></i>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-white truncate block">
                    {e.egg_name}
                    {isNew && (
                      <span className="ml-2 align-middle text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">BARU</span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-500 truncate block">
                    <span className={t.text}>{cap(e.rarity)}</span>
                    {e.area ? ` · ${e.area}` : ""}
                    {e.counted ? " · masuk target" : ""}
                  </span>
                </span>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">{timeWIB(e.created_at)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* RARITY TARGET — selalu terbuka */}
      {target.map((r) => (
        <RarityBlock key={r} rarity={r} eggs={data.eggs.by_rarity[r]} highlight now={now} />
      ))}

      {/* BONUS — tertutup, bisa dibuka */}
      {bonus.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <i className="fa-solid fa-gift text-[10px]"></i>
            Bonus · {bonusCount} egg <span className="normal-case font-semibold text-slate-600">(tidak dihitung ke target)</span>
          </p>
          {bonus.map((r) => {
            const open = !!openBonus[r];
            const t = toneOf(r);
            const eggs = data.eggs.by_rarity[r];
            return (
              <div key={r} className={`rounded-xl border ${t.box} overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => setOpenBonus((o) => ({ ...o, [r]: !o[r] }))}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition"
                >
                  <span className={`text-sm font-extrabold capitalize flex items-center gap-2 ${t.text}`}>
                    <i className={`fa-solid ${t.icon} text-xs`}></i>
                    {r}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    {eggs.length} egg
                    <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-300 ${open ? "rotate-180" : ""}`}></i>
                  </span>
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <EggList eggs={eggs} now={now} className="px-4 pb-3" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RarityBlock({ rarity, eggs, highlight, now }: { rarity: string; eggs: EggLog[]; highlight?: boolean; now: number }) {
  const t = toneOf(rarity);
  return (
    <div className={`rounded-xl border ${t.box} ${highlight ? "ring-1 ring-inset ring-white/5" : ""}`}>
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <span className={`text-sm font-extrabold capitalize flex items-center gap-2 ${t.text}`}>
          <i className={`fa-solid ${t.icon} text-xs`}></i>
          {rarity}
          {highlight && (
            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white">Target</span>
          )}
        </span>
        <span className="text-xs font-mono text-slate-400">{eggs.length} egg</span>
      </div>
      <EggList eggs={eggs} now={now} className="px-4 pb-3.5" />
    </div>
  );
}

function EggList({ eggs, now, className = "" }: { eggs: EggLog[]; now: number; className?: string }) {
  const sorted = [...eggs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <ul className={`space-y-1 ${className}`}>
      {sorted.map((egg, idx) => {
        const isNew = now - new Date(egg.created_at).getTime() < NEW_WINDOW_MS;
        return (
          <li key={eggKey(egg)} className="text-xs text-slate-300 flex items-center gap-2 py-1 border-b border-white/5 last:border-0">
            <span className="text-slate-600 font-mono w-5 shrink-0 text-right">{sorted.length - idx}.</span>
            <span className="flex-1 min-w-0">
              <span className="font-semibold text-slate-100">{egg.egg_name}</span>
              {egg.area && <span className="text-slate-500"> · {egg.area}</span>}
              {isNew && <span className="ml-1.5 text-[9px] font-black px-1 py-px rounded bg-emerald-500 text-slate-950">BARU</span>}
            </span>
            <span className="hidden sm:flex items-center gap-1 shrink-0">
              {egg.size && <Chip>{egg.size}</Chip>}
              {egg.weight && <Chip>{egg.weight}</Chip>}
            </span>
            <span className="text-[10px] font-mono text-slate-500 shrink-0">{timeWIB(egg.created_at)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800/80 text-slate-400 font-medium">{children}</span>;
}
