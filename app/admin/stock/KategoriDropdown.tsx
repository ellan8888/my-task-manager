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
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // ⭐ State untuk posisi dropdown melayang
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  // Hitung posisi dropdown saat dibuka atau saat layar di-scroll
  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  // ★ Click outside → close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // ★ Auto-focus search input saat dropdown buka
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open]);

  // ★ Filter opsi berdasarkan search
  const filtered = options.filter((o) =>
    o.kategori.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(
    (o) => o.kategori.toLowerCase() === (value || "").toLowerCase()
  );

  return (
    <div ref={dropdownRef} className="relative">
      {/* ⭐ Label — cuma muncul kalau hideLabel = false */}
      {!hideLabel && (
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 h-5">
          <i className="fa-solid fa-tag text-[10px]"></i>
          <span>Kategori *</span>
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !loading && setOpen(!open)}
        disabled={loading}
        style={{ height: "46px" }}
        className={`w-full flex items-center justify-between gap-2 bg-white dark:bg-slate-950 border rounded-xl px-4 text-sm transition-all ${
          open
            ? "border-violet-500 ring-2 ring-violet-500/20"
            : "border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-500/50"
        } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`flex items-center gap-2 truncate ${
            selectedOption
              ? "text-slate-900 dark:text-white font-semibold"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          <i className="fa-solid fa-tag text-[10px] text-violet-500 dark:text-violet-400"></i>
          <span className="truncate">
            {loading ? "Loading..." : selectedOption?.kategori || placeholder}
          </span>
        </span>

        <i
          className={`fa-solid fa-chevron-down text-xs text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        ></i>
      </button>

      {/* ⭐ Dropdown Panel — Pake FIXED biar tembus ke atas */}
      {open && (
        <div
          className="fixed z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl shadow-slate-950/20 dark:shadow-slate-950/50 overflow-hidden animate-[dropdown-in_0.15s_ease-out]"
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            animation: "dropdown-in 0.15s ease-out",
            paddingTop: "8px", // jarak dari tombol
          }}
        >
          {/* Konten Dropdown dibungkus div baru untuk background penuh */}
          <div className="bg-white dark:bg-slate-900 rounded-xl">
            {options.length > 5 && (
              <div className="p-2 border-b border-slate-100 dark:border-slate-800 scrollbar-hide">
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
            <div className="max-h-60 overflow-y-auto scrollbar-hide py-1">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-slate-400">
                  {search ? "Kategori nggak ketemu" : "Belum ada kategori"}
                </div>
              ) : (
                filtered.map((opt) => {
                  const isSelected =
                    opt.kategori.toLowerCase() === (value || "").toLowerCase();
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onChange(opt.kategori);
                        setOpen(false);
                        setSearch("");
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
                            isSelected
                              ? "text-violet-500 dark:text-violet-400"
                              : "text-slate-400 dark:text-slate-500"
                          }`}
                        ></i>
                        <span className="truncate">{opt.kategori}</span>
                      </span>
                      {isSelected && (
                        <i className="fa-solid fa-check text-violet-500 dark:text-violet-400 text-xs"></i>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Animation Keyframe — Ganti style jsx ke style biasa agar terbaca Next.js */}
      <style>{`
        @keyframes dropdown-in {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}