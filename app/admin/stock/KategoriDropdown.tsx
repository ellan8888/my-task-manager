"use client";

import { useEffect, useRef, useState } from "react";

type Kategori = {
  id: number;
  kategori: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: Kategori[];
  loading?: boolean;
  placeholder?: string;
  hideLabel?: boolean;
};

const OPTION_HEIGHT = 42; // perkiraan tinggi 1 opsi (px)
const SEARCH_HEIGHT = 52; // tinggi kotak pencarian (px)
const MAX_LIST_HEIGHT = 240; // sama dengan max-h-60
const GAP = 8; // jarak panel dari tombol (px)

/**
 * Batas area yang terlihat untuk elemen: viewport dipotong oleh setiap
 * pembungkus yang punya overflow (misalnya modal yang bisa di-scroll).
 */
function getVisibleBounds(el: HTMLElement) {
  let top = 0;
  let bottom = window.innerHeight;
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    const { overflowY } = window.getComputedStyle(parent);
    if (/(auto|scroll|hidden|clip)/.test(overflowY)) {
      const r = parent.getBoundingClientRect();
      top = Math.max(top, r.top);
      bottom = Math.min(bottom, r.bottom);
    }
    parent = parent.parentElement;
  }
  return { top, bottom };
}

export default function KategoriDropdown({
  value,
  onChange,
  options,
  loading = false,
  placeholder = "Pilih kategori...",
  hideLabel = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // ⭐ Panel menempel di tombol (absolute) — ikut bergerak saat layar di-scroll.
  //    Arah buka (bawah/atas) & tinggi list dihitung sekali saat dibuka.
  const [dropUp, setDropUp] = useState(false);
  const [listMaxHeight, setListMaxHeight] = useState(MAX_LIST_HEIGHT);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const showSearch = options.length > 5;

  const closeDropdown = () => {
    setOpen(false);
    setSearch("");
  };

  const openDropdown = () => {
    const trigger = triggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const bounds = getVisibleBounds(trigger);
      const spaceBelow = bounds.bottom - rect.bottom - GAP * 2;
      const spaceAbove = rect.top - bounds.top - GAP * 2;
      const searchH = showSearch ? SEARCH_HEIGHT : 0;
      const wanted = Math.min(MAX_LIST_HEIGHT, Math.max(options.length, 1) * OPTION_HEIGHT + 8) + searchH;

      const up = spaceBelow < wanted && spaceAbove > spaceBelow;
      const available = (up ? spaceAbove : spaceBelow) - searchH;
      setDropUp(up);
      setListMaxHeight(Math.max(120, Math.min(MAX_LIST_HEIGHT, available)));
    }
    setOpen(true);
  };

  // ★ Klik / sentuh di luar → tutup.  Esc → tutup.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // ★ Auto-focus kotak cari — hanya di perangkat ber-mouse.
  //    Di HP, keyboard yang muncul bikin layar bergeser.
  useEffect(() => {
    if (!open || !searchInputRef.current) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const t = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  // ★ Filter opsi berdasarkan search
  const filtered = options.filter((o) => o.kategori.toLowerCase().includes(search.toLowerCase()));

  const selectedOption = options.find((o) => o.kategori.toLowerCase() === (value || "").toLowerCase());

  return (
    <div ref={dropdownRef}>
      {/* ⭐ Label — cuma muncul kalau hideLabel = false */}
      {!hideLabel && (
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 h-5">
          <i className="fa-solid fa-tag text-[10px]"></i>
          <span>Kategori *</span>
        </label>
      )}

      {/* Tombol + panel dalam satu pembungkus relative, jadi panel selalu menempel di tombol */}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            if (loading) return;
            if (open) closeDropdown();
            else openDropdown();
          }}
          disabled={loading}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={{ height: "46px" }}
          className={`w-full flex items-center justify-between gap-2 bg-white dark:bg-slate-950 border rounded-xl px-4 text-sm transition-all ${
            open
              ? "border-violet-500 ring-2 ring-violet-500/20"
              : "border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-500/50"
          } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span
            className={`flex items-center gap-2 truncate ${
              selectedOption ? "text-slate-900 dark:text-white font-semibold" : "text-slate-400 dark:text-slate-500"
            }`}
          >
            <i className="fa-solid fa-tag text-[10px] text-violet-500 dark:text-violet-400"></i>
            <span className="truncate">{loading ? "Loading..." : selectedOption?.kategori || placeholder}</span>
          </span>

          <i
            className={`fa-solid fa-chevron-down text-xs text-slate-400 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          ></i>
        </button>

        {/* ⭐ Panel — absolute, menempel di bawah (atau atas) tombol */}
        {open && (
          <div
            role="listbox"
            className={`absolute left-0 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl shadow-slate-950/20 dark:shadow-slate-950/50 overflow-hidden ${
              dropUp ? "bottom-full mb-2" : "top-full mt-2"
            }`}
            style={{ animation: `${dropUp ? "dropdown-up" : "dropdown-in"} 0.15s ease-out` }}
          >
            {showSearch && (
              <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari kategori..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="overflow-y-auto overscroll-contain scrollbar-hide py-1" style={{ maxHeight: listMaxHeight }}>
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-slate-400">
                  {search ? "Kategori nggak ketemu" : "Belum ada kategori"}
                </div>
              ) : (
                filtered.map((opt) => {
                  const isSelected = opt.kategori.toLowerCase() === (value || "").toLowerCase();
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(opt.kategori);
                        closeDropdown();
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left transition ${
                        isSelected
                          ? "bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-200 font-bold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <i
                          className={`fa-solid fa-tag text-[10px] ${
                            isSelected ? "text-violet-500 dark:text-violet-400" : "text-slate-400 dark:text-slate-500"
                          }`}
                        ></i>
                        <span className="truncate">{opt.kategori}</span>
                      </span>
                      {isSelected && <i className="fa-solid fa-check text-violet-500 dark:text-violet-400 text-xs"></i>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes dropdown-in {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dropdown-up {
          from { opacity: 0; transform: translateY(4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
