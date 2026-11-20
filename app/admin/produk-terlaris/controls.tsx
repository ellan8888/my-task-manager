"use client";

// Kontrol filter halaman Produk Terlaris — pengganti <select> bawaan browser:
//   PeriodTabs  : pilihan periode dengan penanda yang bergeser
//   Dropdown    : daftar pilihan (ikon, jumlah, centang) + keyboard (↑ ↓ Enter Esc), tutup saat klik di luar
//   DateRange   : panel pilih tanggal dengan pintasan (Minggu lalu, Bulan lalu, …)
//   Segment     : tombol berkelompok dengan jumlah per pilihan

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// ── PeriodTabs ─────────────────────────────────────────────────────────────
export function PeriodTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrap.current?.querySelector<HTMLButtonElement>(`[data-v="${value}"]`);
      setInd(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);   // "Pilih tanggal" aktif → tanpa penanda
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [value]);
  return (
    <div
      ref={wrap}
      role="tablist"
      aria-label="Periode"
      className="relative inline-flex max-w-full overflow-x-auto p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/70 ring-1 ring-inset ring-slate-200/80 dark:ring-slate-700/60 text-[13px] font-semibold"
    >
      {ind && (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-xl bg-white dark:bg-slate-950 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ left: ind.left, width: ind.width }}
        />
      )}
      {options.map(([v, label]) => (
        <button
          key={v}
          data-v={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={`relative z-10 px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
            value === v ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── popover dasar: tutup saat klik di luar / Esc ──────────────────────────
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const panelCls =
  "absolute z-40 mt-2 rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 shadow-2xl shadow-slate-900/15 dark:shadow-black/50 origin-top animate-[pop_.16s_ease-out]";

// ── Dropdown ───────────────────────────────────────────────────────────────
export type Opt<T extends string> = { value: T; label: string; hint?: string; count?: number; dot?: string; icon?: string };

export function Dropdown<T extends string>({
  label,
  icon,
  value,
  options,
  onChange,
  align = "left",
  width = "w-64",
}: {
  label: string;
  icon: string;
  value: T;
  options: Opt<T>[];
  onChange: (v: T) => void;
  align?: "left" | "right";
  width?: string;
}) {
  const { open, setOpen, ref } = usePopover();
  const [hi, setHi] = useState(0);
  const cur = options.find((o) => o.value === value) || options[0];
  const listRef = useRef<HTMLUListElement>(null);

  const openMenu = () => {
    setHi(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(options.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(options[hi].value);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
            e.preventDefault();
            openMenu();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`group w-full flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-xl text-left ring-1 ring-inset transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
          open
            ? "bg-white dark:bg-slate-900 ring-violet-400 dark:ring-violet-500"
            : "bg-white dark:bg-slate-900 ring-slate-200 dark:ring-slate-700 hover:ring-slate-300 dark:hover:ring-slate-600"
        }`}
      >
        <i className={`fa-solid ${icon} text-[12px] text-slate-400 w-3.5 text-center`}></i>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[10px] font-semibold text-slate-400">{label}</span>
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
            {cur?.dot && <span className={`w-2 h-2 rounded-full shrink-0 ${cur.dot}`} />}
            <span className="truncate">{cur?.label}</span>
          </span>
        </span>
        <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}></i>
      </button>
      {open && (
        <div className={`${panelCls} ${width} p-1.5 ${align === "right" ? "right-0" : "left-0"}`}>
          <ul ref={listRef} role="listbox" tabIndex={-1} onKeyDown={onKey} aria-label={label} className="max-h-80 overflow-y-auto focus:outline-none">
            {options.map((o, i) => {
              const sel = o.value === value;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={sel}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(o.value)}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer ${
                    i === hi ? "bg-slate-100 dark:bg-slate-800" : ""
                  }`}
                >
                  <span className="w-4 shrink-0 text-center">
                    {o.dot ? <span className={`inline-block w-2.5 h-2.5 rounded-full ${o.dot}`} /> : o.icon ? <i className={`fa-solid ${o.icon} text-[12px] text-slate-400`}></i> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] truncate ${sel ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-700 dark:text-slate-200"}`}>{o.label}</span>
                    {o.hint && <span className="block text-[11px] text-slate-400 truncate">{o.hint}</span>}
                  </span>
                  {o.count !== undefined && (
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">{o.count}</span>
                  )}
                  <i className={`fa-solid fa-check text-[11px] w-3 shrink-0 ${sel ? "text-violet-600 dark:text-violet-400" : "opacity-0"}`}></i>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Segment ────────────────────────────────────────────────────────────────
/** tombol berkelompok — latar putih menggeser ke pilihan yang aktif */
export function Segment<T extends string>({ value, options, onChange }: { value: T; options: Opt<T>[]; onChange: (v: T) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrap.current?.querySelector<HTMLButtonElement>(`[data-v="${value}"]`);
      setInd(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [value, options.length]);
  return (
    <div ref={wrap} role="radiogroup" className="relative flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/70 ring-1 ring-inset ring-slate-200/80 dark:ring-slate-700/60">
      {ind && (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-xl bg-white dark:bg-slate-950 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ left: ind.left, width: ind.width }}
        />
      )}
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <button
            key={o.value}
            data-v={o.value}
            role="radio"
            aria-checked={sel}
            onClick={() => onChange(o.value)}
            className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
              sel ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {o.dot && <span className={`w-2 h-2 rounded-full transition-transform duration-300 ${o.dot} ${sel ? "scale-125" : ""}`} />}
            {o.label}
            {o.count !== undefined && <span className="text-[11px] tabular-nums text-slate-400">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── DateRange ──────────────────────────────────────────────────────────────
const ymd = (d: Date) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
const addDays = (s: string, n: number) => ymd(new Date(Date.parse(s + "T00:00:00+07:00") + n * 86400e3));
const fmt = (s: string) =>
  new Date(s + "T00:00:00+07:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

function presets(): { label: string; from: string; to: string }[] {
  const today = ymd(new Date());
  const dow = new Date(today + "T00:00:00+07:00").getUTCDay(); // 0 Minggu
  const thisMon = addDays(today, -((dow + 6) % 7));
  const [y, m] = today.split("-").map(Number);
  const firstThis = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastPrev = addDays(firstThis, -1);
  const firstPrev = lastPrev.slice(0, 8) + "01";
  return [
    { label: "Kemarin", from: addDays(today, -1), to: addDays(today, -1) },
    { label: "Minggu ini", from: thisMon, to: today },
    { label: "Minggu lalu", from: addDays(thisMon, -7), to: addDays(thisMon, -1) },
    { label: "Bulan lalu", from: firstPrev, to: lastPrev },
    { label: "14 hari terakhir", from: addDays(today, -13), to: today },
    { label: "90 hari terakhir", from: addDays(today, -89), to: today },
  ];
}

export function DateRange({
  from,
  to,
  active,
  onApply,
}: {
  from: string;
  to: string;
  active: boolean;
  onApply: (from: string, to: string) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const today = ymd(new Date());
  const valid = f && t && f <= t && t <= today;
  const show = () => {
    setF(from);
    setT(to);
    setOpen(true);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => (open ? setOpen(false) : show())}
        aria-expanded={open}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-[13px] font-semibold ring-1 ring-inset transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
          active
            ? "bg-violet-600 text-white ring-violet-600 shadow-md shadow-violet-600/25"
            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-700 hover:ring-slate-300 dark:hover:ring-slate-600"
        }`}
      >
        <i className="fa-regular fa-calendar text-[12px]"></i>
        {active ? `${fmt(from)} – ${fmt(to)}` : "Pilih tanggal"}
      </button>
      {open && (
        <div className={`${panelCls} left-0 sm:left-auto sm:right-0 w-[min(22rem,calc(100vw-2rem))] p-4`}>
          <div className="text-[12px] font-semibold text-slate-500 mb-2">Pintasan</div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {presets().map((p) => {
              const on = p.from === f && p.to === t;
              return (
                <button
                  key={p.label}
                  onClick={() => {
                    setF(p.from);
                    setT(p.to);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold transition ${
                    on ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["Dari", f, setF, undefined, t],
                ["Sampai", t, setT, f, today],
              ] as const
            ).map(([lbl, v, set, min, max]) => (
              <label key={lbl} className="block">
                <span className="block text-[11px] font-semibold text-slate-400 mb-1">{lbl}</span>
                <input
                  type="date"
                  value={v}
                  min={min}
                  max={max}
                  onChange={(e) => set(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-inset ring-slate-200 dark:ring-slate-700 text-[13px] text-slate-900 dark:text-slate-100 [color-scheme:light] dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-[11px] text-slate-400">
              {valid ? `${Math.round((Date.parse(t) - Date.parse(f)) / 86400e3) + 1} hari` : "Tanggal akhir harus setelah tanggal awal"}
            </span>
            <button
              disabled={!valid}
              onClick={() => {
                onApply(f, t);
                setOpen(false);
              }}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Terapkan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** tombol kecil berisi filter aktif (bisa dihapus satu per satu) */
export function FilterChip({ children, onClear }: { children: ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 text-[12px] font-semibold ring-1 ring-inset ring-violet-200 dark:ring-violet-500/30">
      {children}
      <button onClick={onClear} aria-label="Hapus filter" className="w-5 h-5 rounded-full grid place-items-center hover:bg-violet-200/70 dark:hover:bg-violet-500/25">
        <i className="fa-solid fa-xmark text-[10px]"></i>
      </button>
    </span>
  );
}
