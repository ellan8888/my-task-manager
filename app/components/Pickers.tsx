"use client";

// app/components/Pickers.tsx — komponen pilihan bersama (pengganti <select> & <input type="date"> bawaan browser)
//   • SegmentedChoice : 2–5 pilihan sebagai tombol chip/segmen (sekali klik)
//   • SelectMenu      : dropdown kustom — avatar + nama, dengan kotak cari untuk daftar panjang
//   • DatePicker      : kalender kustom (format nilai "YYYY-MM-DD"), seragam di semua HP/PC

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

// ══════════════════════════════════════════════════════════════
// AVATAR
// ══════════════════════════════════════════════════════════════

const AVATAR_PALETTE = [
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
];

/** Warna avatar tetap untuk teks yang sama */
export function avatarClassFor(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export function Avatar({
  label,
  icon,
  className,
  size = "md",
}: {
  label: string;
  /** Ikon Font Awesome (misal "fa-users") — dipakai ganti huruf awal */
  icon?: string;
  /** Override warna, contoh "bg-violet-500 text-white" */
  className?: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-5 h-5 text-[10px] rounded-md" : "w-7 h-7 text-xs rounded-lg";
  return (
    <span className={`${dim} shrink-0 inline-flex items-center justify-center font-black ${className || avatarClassFor(label)}`}>
      {icon ? <i className={`fa-solid ${icon} text-[0.85em]`}></i> : label.trim().charAt(0).toUpperCase()}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════
// SEGMENTED CHOICE
// ══════════════════════════════════════════════════════════════

export type ChoiceOption<T extends string | number> = {
  value: T;
  label: string;
  /** Ikon Font Awesome di depan label */
  icon?: string;
  /** Tampilkan avatar huruf awal di depan label */
  avatar?: boolean;
  /** Warna avatar (tidak aktif) */
  avatarClass?: string;
  /** Class saat AKTIF, contoh "bg-rose-500 text-white border-rose-500 shadow-rose-500/30" */
  activeClass?: string;
};

export function SegmentedChoice<T extends string | number>({
  options,
  value,
  onChange,
  size = "md",
  fullWidth = false,
  ariaLabel,
}: {
  options: ChoiceOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  fullWidth?: boolean;
  ariaLabel?: string;
}) {
  const pad = size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2 text-xs";
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`flex flex-wrap gap-1.5 ${fullWidth ? "w-full" : ""}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`${pad} ${fullWidth ? "flex-1 justify-center" : ""} inline-flex items-center gap-1.5 rounded-xl border font-bold transition-all duration-200 active:scale-95 ${
              active
                ? `${o.activeClass || "bg-violet-600 text-white border-violet-600 shadow-violet-600/30"} shadow-md`
                : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-px"
            }`}
          >
            {o.avatar && (
              <Avatar
                label={o.label}
                icon={o.icon}
                size="sm"
                className={active ? "bg-white/25 text-white" : o.avatarClass}
              />
            )}
            {!o.avatar && o.icon && <i className={`fa-solid ${o.icon} text-[0.9em]`}></i>}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// POPOVER POSITION (dipakai SelectMenu & DatePicker)
// ══════════════════════════════════════════════════════════════

/** Batas area terlihat: viewport dipotong pembungkus yang bisa di-scroll */
function visibleBounds(el: HTMLElement) {
  let top = 0;
  let bottom = window.innerHeight;
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    if (/(auto|scroll|hidden|clip)/.test(window.getComputedStyle(parent).overflowY)) {
      const r = parent.getBoundingClientRect();
      top = Math.max(top, r.top);
      bottom = Math.min(bottom, r.bottom);
    }
    parent = parent.parentElement;
  }
  return { top, bottom };
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openWith = (wantedHeight: number) => {
    const t = triggerRef.current;
    if (t) {
      const r = t.getBoundingClientRect();
      const b = visibleBounds(t);
      const below = b.bottom - r.bottom;
      const above = r.top - b.top;
      setDropUp(below < wantedHeight && above > below);
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, openWith, dropUp, wrapRef, triggerRef };
}

const POPOVER_STYLE = `
@keyframes pk-in { from { opacity: 0; transform: translateY(-4px) scale(.98) } to { opacity: 1; transform: none } }
@keyframes pk-up { from { opacity: 0; transform: translateY(4px) scale(.98) } to { opacity: 1; transform: none } }
@media (prefers-reduced-motion: reduce) { .pk-anim { animation: none !important } }
`;

// ══════════════════════════════════════════════════════════════
// SELECT MENU
// ══════════════════════════════════════════════════════════════

export type MenuOption<T extends string | number> = {
  value: T;
  label: string;
  /** Ikon Font Awesome menggantikan huruf awal di avatar */
  icon?: string;
  /** Warna avatar khusus */
  avatarClass?: string;
};

export function SelectMenu<T extends string | number>({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  searchable,
  searchPlaceholder = "Cari...",
  accent = "violet",
  className = "",
  ariaLabel,
}: {
  options: MenuOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  placeholder?: string;
  /** Default: otomatis kalau pilihan > 6 */
  searchable?: boolean;
  searchPlaceholder?: string;
  accent?: "violet" | "emerald" | "blue";
  className?: string;
  ariaLabel?: string;
}) {
  const { open, setOpen, openWith, dropUp, wrapRef, triggerRef } = usePopover();
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const showSearch = searchable ?? options.length > 6;

  const ring = {
    violet: "border-violet-500 ring-violet-500/20",
    emerald: "border-emerald-500 ring-emerald-500/20",
    blue: "border-blue-500 ring-blue-500/20",
  }[accent];
  const selBg = {
    violet: "bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-200",
    emerald: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
    blue: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-200",
  }[accent];

  const selected = options.find((o) => o.value === value) || null;
  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query]
  );

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const toggle = () => {
    if (open) return close();
    setHover(Math.max(0, options.findIndex((o) => o.value === value)));
    openWith(Math.min(300, options.length * 44 + (showSearch ? 56 : 12)));
  };

  // Fokus kotak cari — hanya di perangkat ber-mouse (di HP keyboard bikin layar bergeser)
  useEffect(() => {
    if (!open || !showSearch) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const t = setTimeout(() => searchRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open, showSearch]);

  const choose = (o: MenuOption<T>) => {
    onChange(o.value);
    close();
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHover((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHover((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[hover]) choose(filtered[hover]);
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <style>{POPOVER_STYLE}</style>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        className={`w-full flex items-center gap-2.5 bg-white dark:bg-slate-950 border rounded-xl pl-2.5 pr-3 py-2 text-sm transition ${
          open ? `${ring} ring-2` : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        }`}
      >
        {selected ? (
          <>
            <Avatar label={selected.label} icon={selected.icon} className={selected.avatarClass} />
            <span className="truncate font-semibold text-slate-900 dark:text-white">{selected.label}</span>
          </>
        ) : (
          <span className="truncate text-slate-400 pl-1">{placeholder}</span>
        )}
        <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 ml-auto transition-transform duration-200 ${open ? "rotate-180" : ""}`}></i>
      </button>

      {open && (
        <div
          className={`pk-anim absolute left-0 right-0 z-50 min-w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-950/20 dark:shadow-slate-950/60 overflow-hidden ${
            dropUp ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          style={{ animation: `${dropUp ? "pk-up" : "pk-in"} .15s ease-out` }}
        >
          {showSearch && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHover(0);
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>
          )}
          <div id={listId} role="listbox" className="max-h-64 overflow-y-auto overscroll-contain p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-5 text-center text-xs text-slate-400">Tidak ditemukan</p>
            ) : (
              filtered.map((o, i) => {
                const isSel = o.value === value;
                return (
                  <button
                    key={String(o.value)}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setHover(i)}
                    onClick={() => choose(o)}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm text-left transition ${
                      isSel
                        ? `${selBg} font-bold`
                        : i === hover
                          ? "bg-slate-100 dark:bg-slate-800/70 text-slate-900 dark:text-white"
                          : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <Avatar label={o.label} icon={o.icon} className={o.avatarClass} />
                    <span className="truncate">{o.label}</span>
                    {isSel && <i className="fa-solid fa-check text-xs ml-auto"></i>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// DATE PICKER
// ══════════════════════════════════════════════════════════════

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const toKey = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

function formatDisplay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

export function DatePicker({
  value: rawValue,
  onChange,
  placeholder = "Pilih tanggal",
  min,
  max,
  clearable = false,
  accent = "violet",
  size = "md",
  align = "left",
  className = "",
  ariaLabel,
}: {
  /** "YYYY-MM-DD" atau "" */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  clearable?: boolean;
  accent?: "violet" | "emerald";
  size?: "sm" | "md";
  /** Sisi rata kalender terhadap tombol (pakai "right" kalau tombol di tepi kanan layar) */
  align?: "left" | "right";
  className?: string;
  ariaLabel?: string;
}) {
  const { open, setOpen, openWith, dropUp, wrapRef, triggerRef } = usePopover();
  // Terima juga "YYYY-MM-DDTHH:mm..." — yang dipakai hanya bagian tanggal
  const value = /^\d{4}-\d{2}-\d{2}/.test(rawValue || "") ? rawValue.slice(0, 10) : "";
  const base = value || todayKey();
  const [view, setView] = useState(() => ({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 }));

  const fill = accent === "emerald" ? "bg-emerald-600 text-white" : "bg-violet-600 text-white";
  const ring = accent === "emerald" ? "border-emerald-500 ring-emerald-500/20" : "border-violet-500 ring-violet-500/20";
  const todayRing = accent === "emerald" ? "ring-emerald-500/60" : "ring-violet-500/60";
  const today = todayKey();

  const toggle = () => {
    if (open) return setOpen(false);
    const b = value || todayKey();
    setView({ y: Number(b.slice(0, 4)), m: Number(b.slice(5, 7)) - 1 });
    openWith(340);
  };

  const shift = (delta: number) =>
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });

  // Senin sebagai hari pertama
  const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const lead = (first + 6) % 7;
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const disabled = (key: string) => (min && key < min) || (max && key > max);
  const pick = (key: string) => {
    if (disabled(key)) return;
    onChange(key);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const h = size === "sm" ? "py-2 text-xs" : "py-3 text-sm";

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <style>{POPOVER_STYLE}</style>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`w-full flex items-center gap-2 bg-white dark:bg-slate-950 border rounded-xl px-3.5 ${h} transition ${
          open ? `${ring} ring-2` : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        }`}
      >
        <i className="fa-regular fa-calendar text-slate-400 text-[0.95em]"></i>
        <span className={`truncate ${value ? "text-slate-900 dark:text-slate-100 font-semibold" : "text-slate-400"}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        {clearable && value ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Hapus tanggal"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                onChange("");
              }
            }}
            className="ml-auto w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <i className="fa-solid fa-xmark text-[10px]"></i>
          </span>
        ) : (
          <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 ml-auto transition-transform ${open ? "rotate-180" : ""}`}></i>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Kalender"
          className={`pk-anim absolute ${align === "right" ? "right-0" : "left-0"} z-50 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-950/20 dark:shadow-slate-950/60 p-3 ${
            dropUp ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          style={{ animation: `${dropUp ? "pk-up" : "pk-in"} .15s ease-out` }}
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Bulan sebelumnya"
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {MONTHS[view.m]} {view.y}
            </span>
            <button
              type="button"
              onClick={() => shift(1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Bulan berikutnya"
            >
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS.map((d) => (
              <span key={d} className="text-[10px] font-bold uppercase text-slate-400 py-1">
                {d}
              </span>
            ))}
            {cells.map((d, i) => {
              if (d == null) return <span key={`e${i}`} />;
              const key = toKey(view.y, view.m, d);
              const isSel = key === value;
              const isToday = key === today;
              const off = disabled(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!!off}
                  onClick={() => pick(key)}
                  className={`h-9 rounded-lg text-xs font-semibold transition ${
                    isSel
                      ? `${fill} shadow-md`
                      : off
                        ? "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                        : `text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 ${isToday ? `ring-1 ${todayRing}` : ""}`
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => pick(today)}
              disabled={!!disabled(today)}
              className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40"
            >
              Hari ini
            </button>
            {clearable && value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-xs font-bold text-rose-500 hover:text-rose-600"
              >
                Hapus
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TIME PICKER
// ══════════════════════════════════════════════════════════════

const QUICK_TIMES = ["07:00", "12:00", "18:00", "20:00", "21:00"];

export function TimePicker({
  value: rawValue,
  onChange,
  placeholder = "Pilih jam",
  minuteStep = 5,
  clearable = false,
  quickTimes = QUICK_TIMES,
  accent = "violet",
  size = "md",
  align = "left",
  className = "",
  ariaLabel,
}: {
  /** "HH:MM" (juga menerima "HH:MM:SS") atau "" */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minuteStep?: number;
  clearable?: boolean;
  quickTimes?: string[];
  accent?: "violet" | "emerald";
  size?: "sm" | "md";
  align?: "left" | "right";
  className?: string;
  ariaLabel?: string;
}) {
  const { open, setOpen, openWith, dropUp, wrapRef, triggerRef } = usePopover();
  const value = /^\d{2}:\d{2}/.test(rawValue || "") ? rawValue.slice(0, 5) : "";
  const [hh, mm] = value ? value.split(":") : ["", ""];
  const hourCol = useRef<HTMLDivElement>(null);
  const minCol = useRef<HTMLDivElement>(null);

  const fill = accent === "emerald" ? "bg-emerald-600 text-white" : "bg-violet-600 text-white";
  const ring = accent === "emerald" ? "border-emerald-500 ring-emerald-500/20" : "border-violet-500 ring-violet-500/20";

  const hours = Array.from({ length: 24 }, (_, i) => pad2(i));
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => pad2(i * minuteStep));
  if (mm && !minutes.includes(mm)) minutes.push(mm);
  minutes.sort();

  // Gulir ke jam/menit yang dipilih saat dibuka
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      hourCol.current?.querySelector<HTMLElement>("[data-sel='1']")?.scrollIntoView({ block: "center" });
      minCol.current?.querySelector<HTMLElement>("[data-sel='1']")?.scrollIntoView({ block: "center" });
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  const set = (h: string, m: string) => onChange(`${h}:${m}`);
  const h = size === "sm" ? "py-2 text-xs" : "py-3 text-sm";

  const cell = (active: boolean) =>
    `w-full h-9 rounded-lg text-sm font-semibold transition shrink-0 ${
      active ? `${fill} shadow-md` : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
    }`;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <style>{POPOVER_STYLE}</style>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openWith(330))}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`w-full flex items-center gap-2 bg-white dark:bg-slate-950 border rounded-xl px-3.5 ${h} transition ${
          open ? `${ring} ring-2` : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        }`}
      >
        <i className="fa-regular fa-clock text-slate-400 text-[0.95em]"></i>
        <span className={`truncate font-mono ${value ? "text-slate-900 dark:text-slate-100 font-semibold" : "text-slate-400 font-sans"}`}>
          {value ? `${value} WIB` : placeholder}
        </span>
        {clearable && value ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Hapus jam"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                onChange("");
              }
            }}
            className="ml-auto w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <i className="fa-solid fa-xmark text-[10px]"></i>
          </span>
        ) : (
          <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 ml-auto transition-transform ${open ? "rotate-180" : ""}`}></i>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Pilih jam"
          className={`pk-anim absolute ${align === "right" ? "right-0" : "left-0"} z-50 w-60 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-950/20 dark:shadow-slate-950/60 p-3 ${
            dropUp ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          style={{ animation: `${dropUp ? "pk-up" : "pk-in"} .15s ease-out` }}
        >
          <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            <span>Jam</span>
            <span>Menit</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div ref={hourCol} className="h-44 overflow-y-auto overscroll-contain scrollbar-hide flex flex-col gap-1 pr-0.5">
              {hours.map((x) => (
                <button key={x} type="button" data-sel={x === hh ? "1" : "0"} onClick={() => set(x, mm || "00")} className={cell(x === hh)}>
                  {x}
                </button>
              ))}
            </div>
            <div ref={minCol} className="h-44 overflow-y-auto overscroll-contain scrollbar-hide flex flex-col gap-1 pl-0.5">
              {minutes.map((x) => (
                <button key={x} type="button" data-sel={x === mm ? "1" : "0"} onClick={() => set(hh || "20", x)} className={cell(x === mm)}>
                  {x}
                </button>
              ))}
            </div>
          </div>

          {quickTimes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
              {quickTimes.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    onChange(q);
                    setOpen(false);
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold font-mono transition ${
                    q === value
                      ? fill
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-2.5">
            {clearable && value ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-xs font-bold text-rose-500 hover:text-rose-600"
              >
                Hapus
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${fill}`}
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Pembungkus label kecil standar (opsional) */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">{children}</label>;
}
