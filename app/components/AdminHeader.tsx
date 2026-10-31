"use client";

import type { ReactNode } from "react";
import { useSidebar } from "@/app/admin/SidebarContext";

type Props = {
  /** Nama ikon Font Awesome, contoh "fa-wallet" */
  icon: string;
  /** Class gradien + bayangan kotak ikon */
  iconClassName?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Sembunyikan judul di layar kecil (dipakai halaman yang header-nya berisi search) */
  hideTitleOnMobile?: boolean;
  /** Class tambahan untuk <header>, contoh "gap-3" */
  className?: string;
  /** Isi sisi kanan header (tombol aksi, search, badge) */
  children?: ReactNode;
};

/**
 * Header standar halaman admin: tombol sidebar + ikon + judul/subjudul + aksi.
 * Dipakai semua halaman di /admin supaya tampilannya seragam.
 */
export default function AdminHeader({
  icon,
  iconClassName = "from-violet-600 via-indigo-600 to-purple-500 shadow-violet-600/30",
  title,
  subtitle,
  hideTitleOnMobile = false,
  className = "",
  children,
}: Props) {
  const { sidebarOpen, toggleSidebar } = useSidebar();

  return (
    <header
      className={`h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between ${className} z-20 shrink-0`}
    >
      <div className="flex items-center space-x-3 min-w-0 shrink-0">
        <button
          onClick={toggleSidebar}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
          title={sidebarOpen ? "Tutup Sidebar" : "Buka Sidebar"}
          aria-label={sidebarOpen ? "Tutup Sidebar" : "Buka Sidebar"}
        >
          <i className={`fa-solid ${sidebarOpen ? "fa-bars-staggered" : "fa-bars"} text-base`}></i>
        </button>

        <div
          className={`w-10 h-10 shrink-0 rounded-2xl bg-linear-to-tr ${iconClassName} flex items-center justify-center text-white shadow-lg`}
        >
          <i className={`fa-solid ${icon} text-base`}></i>
        </div>

        <div className={`min-w-0 ${hideTitleOnMobile ? "hidden md:block" : ""}`}>
          <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {children}
    </header>
  );
}
