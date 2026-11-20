"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

// ══════════════════════════════════════════════════════════════
// STAT CARD
// ══════════════════════════════════════════════════════════════

const STAT_COLORS = {
  violet: {
    hover: "hover:border-violet-500/50",
    /** warna spotlight (R G B) */
    spot: "139 92 246",
    label: "text-slate-500 dark:text-slate-400",
    value: "text-slate-900 dark:text-white",
    iconBox: "bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-500/20",
    footer: "text-violet-600 dark:text-violet-400",
  },
  amber: {
    hover: "hover:border-amber-500/50",
    /** warna spotlight (R G B) */
    spot: "245 158 11",
    label: "text-amber-600 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-300",
    iconBox: "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
    footer: "text-amber-600 dark:text-amber-400",
  },
  indigo: {
    hover: "hover:border-indigo-500/50",
    /** warna spotlight (R G B) */
    spot: "99 102 241",
    label: "text-indigo-600 dark:text-indigo-400",
    value: "text-indigo-600 dark:text-indigo-300",
    iconBox: "bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20",
    footer: "text-indigo-600 dark:text-indigo-400",
  },
  emerald: {
    hover: "hover:border-emerald-500/50",
    /** warna spotlight (R G B) */
    spot: "16 185 129",
    label: "text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
    iconBox: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
    footer: "text-emerald-600 dark:text-emerald-400",
  },
  rose: {
    hover: "hover:border-rose-500/50",
    /** warna spotlight (R G B) */
    spot: "244 63 94",
    label: "text-rose-600 dark:text-rose-400",
    value: "text-rose-600 dark:text-rose-300",
    iconBox: "bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
    footer: "text-rose-600 dark:text-rose-400",
  },
} as const;

export type UiColor = keyof typeof STAT_COLORS;

export function StatCard({
  label,
  value,
  icon,
  color,
  footerIcon,
  footerText,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  icon: string;
  color: UiColor;
  footerIcon: string;
  footerText: string;
  /** Angka lebih kecil — untuk nilai panjang seperti rupiah */
  compact?: boolean;
}) {
  const c = STAT_COLORS[color];
  const cardRef = useRef<HTMLDivElement>(null);

  // ⭐ Spotlight ikut posisi mouse — langsung ubah CSS variable, tanpa re-render
  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      className={`bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group transition-all duration-300 ${c.hover}`}
    >
      {/* ⭐ Spotlight — hanya muncul saat mouse di atas kartu (layar sentuh tetap polos) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(220px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgb(${c.spot} / 0.16), transparent 70%)`,
        }}
      ></div>
      <div className="relative flex justify-between items-start">
        <div className="min-w-0">
          <p className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${c.label}`}>
            <span>{label}</span>
          </p>
          <h3 className={`${compact ? "text-lg md:text-2xl" : "text-2xl md:text-3xl"} font-black mt-1 truncate ${c.value}`}>
            {value}
          </h3>
        </div>
        <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border ${c.iconBox}`}>
          <i className={`fa-solid ${icon} text-base`}></i>
        </div>
      </div>
      <div className={`relative mt-3 flex items-center text-[11px] font-semibold ${c.footer}`}>
        <i className={`fa-solid ${footerIcon} mr-1.5`}></i>
        <span>{footerText}</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TOOLBAR PARTS
// ══════════════════════════════════════════════════════════════

/** Dalam <PillTabs>, latar ungu digambar oleh indikator yang bergeser. */
const PillGroupCtx = createContext(false);

export function FilterPill({
  active,
  onClick,
  dot,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dot?: string; // contoh: "bg-amber-400"
  children: ReactNode;
}) {
  const inGroup = useContext(PillGroupCtx);
  return (
    <button
      onClick={onClick}
      data-active={active || undefined}
      aria-pressed={active}
      className={`press relative z-10 px-4 py-2 rounded-xl text-xs font-bold transition-colors duration-300 flex items-center gap-1.5 whitespace-nowrap ${
        active
          ? inGroup
            ? "text-white"
            : "bg-violet-600 text-white shadow-md shadow-violet-600/30"
          : inGroup
          ? "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/60"
          : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      {dot && (
        <span
          className={`w-2 h-2 rounded-full transition-transform duration-300 ${dot} ${active ? "scale-125 ring-2 ring-white/70" : ""}`}
        ></span>
      )}
      {children}
    </button>
  );
}

/**
 * Wadah FilterPill dengan latar aktif yang meluncur ke pil yang dipilih.
 * Ukur ulang tiap render & saat ukuran berubah (teks jumlah ikut berubah).
 */
export function PillTabs({
  className = "",
  indicatorClassName = "rounded-xl bg-violet-600 shadow-md shadow-violet-600/30",
  children,
}: {
  className?: string;
  /** bentuk/warna latar yang meluncur */
  indicatorClassName?: string;
  /** tombol yang aktif diberi atribut data-active */
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number; h: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const measure = () => {
      const el = box.querySelector<HTMLElement>("[data-active]");
      const next = el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null;
      setInd((cur) =>
        cur && next && cur.x === next.x && cur.w === next.w && cur.h === next.h && cur.y === next.y ? cur : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    box.querySelectorAll("button").forEach((b) => ro.observe(b));
    return () => ro.disconnect();
  });

  return (
    <PillGroupCtx.Provider value={true}>
      <div ref={ref} className={`relative ${className}`}>
        <span
          aria-hidden
          className={`pill-indicator absolute left-0 top-0 pointer-events-none ${indicatorClassName}`}
          style={
            ind
              ? { width: ind.w, height: ind.h, transform: `translate(${ind.x}px, ${ind.y}px)` }
              : { opacity: 0, width: 0, height: 0 }
          }
        />
        {children}
      </div>
    </PillGroupCtx.Provider>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex-1 md:w-64">
      <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs"></i>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 text-xs rounded-xl pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-violet-500 transition"
      />
    </div>
  );
}

export function ViewToggle({
  view,
  onChange,
}: {
  view: "list" | "kanban";
  onChange: (v: "list" | "kanban") => void;
}) {
  const btn = (v: "list" | "kanban", icon: string) => (
    <button
      onClick={() => onChange(v)}
      className={`p-2 rounded-lg text-xs transition ${
        view === v
          ? "bg-violet-600 text-white shadow-sm"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
      }`}
    >
      <i className={`fa-solid ${icon}`}></i>
    </button>
  );

  return (
    <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
      {btn("list", "fa-list-ul")}
      {btn("kanban", "fa-table-columns")}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION + EMPTY STATE
// ══════════════════════════════════════════════════════════════

export function SectionHeader({
  icon,
  title,
  count,
  color = "violet",
}: {
  icon: string;
  title: string;
  count?: number;
  color?: "violet" | "indigo";
}) {
  const iconColor = color === "indigo" ? "text-indigo-600 dark:text-indigo-400" : "text-violet-600 dark:text-violet-400";
  const badge =
    color === "indigo"
      ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
      : "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300";

  return (
    <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/60">
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
        <i className={`fa-solid ${icon} ${iconColor}`}></i>
        <span>{title}</span>
        {count !== undefined && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge}`}>{count}</span>
        )}
      </h3>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  desc,
  color = "violet",
}: {
  icon: string;
  title: string;
  desc: string;
  color?: "violet" | "amber";
}) {
  const box =
    color === "amber"
      ? "bg-amber-100 dark:bg-amber-600/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
      : "bg-violet-100 dark:bg-violet-600/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-500/20";

  return (
    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 border ${box}`}>
        <i className={`${icon} text-2xl`}></i>
      </div>
      <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">{title}</h4>
      <p className="text-xs text-slate-500 mt-1">{desc}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// KANBAN COLUMN
// ══════════════════════════════════════════════════════════════

const KANBAN_COLORS = {
  amber: { dot: "bg-amber-500 animate-pulse", title: "text-amber-600 dark:text-amber-400", badge: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300" },
  indigo: { dot: "bg-indigo-500", title: "text-indigo-600 dark:text-indigo-400", badge: "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" },
  emerald: { dot: "bg-emerald-500", title: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" },
} as const;

export function KanbanColumn({
  title,
  icon,
  color,
  count,
  children,
}: {
  title: string;
  icon: string;
  color: keyof typeof KANBAN_COLORS;
  count: number;
  children: ReactNode;
}) {
  const c = KANBAN_COLORS[color];
  return (
    <div className="bg-white dark:bg-slate-900/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-800/80 space-y-3 flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <span className={`w-3 h-3 rounded-full ${c.dot}`}></span>
          <h4 className={`font-extrabold text-sm flex items-center gap-1.5 ${c.title}`}>
            <i className={`fa-solid ${icon} text-xs`}></i> {title}
          </h4>
        </div>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${c.badge}`}>{count}</span>
      </div>
      <div className="space-y-3 flex-1 min-h-50">{children}</div>
    </div>
  );
}
