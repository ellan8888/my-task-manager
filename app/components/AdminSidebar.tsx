"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
};

export default function AdminSidebar({ sidebarOpen, setSidebarOpen }: Props) {
  const [isDark, setIsDark] = useState(true);
  const pathname = usePathname();

  // ══════════════════════════════════════════════════════
  // THEME STATE — sync dengan localStorage
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const darkMode = savedTheme ? savedTheme === "dark" : prefersDark;
    setIsDark(darkMode);

    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem("theme", newMode ? "dark" : "light");

    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // ══════════════════════════════════════════════════════
  // MENU ITEMS — tambah menu baru di sini aja
  // ══════════════════════════════════════════════════════
  const menuItems = [
    {
      href: "/",
      icon: "fa-house",
      label: "Task Manager",
      active: pathname === "/",
    },
    {
      href: "/admin",
      icon: "fa-chart-line",
      label: "Dashboard Admin",
      active: pathname === "/admin",
    },
    {
      href: "/admin/stock",
      icon: "fa-boxes-stacked",
      label: "Stock Akun",
      active: pathname === "/admin/stock",
    },
    {
      href: "/admin/kategori",
      icon: "fa-folder-tree",
      label: "Kategori Link",
      active: pathname === "/admin/kategori",
    },
    {
      href: "/queue",
      icon: "fa-list-ol",
      label: "Queue Jokian",
      active: pathname === "/queue",
      badge: "Live",
    },
  ];

  return (
    <>
      {/* ══════════════════════════════════════════════════════ */}
      {/* MOBILE OVERLAY                                       */}
      {/* ══════════════════════════════════════════════════════ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* SIDEBAR                                              */}
      {/* ══════════════════════════════════════════════════════ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 h-screen bg-white dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between p-5 transform-gpu will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Logo */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-linear-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-violet-600/30 ring-2 ring-violet-500/20">
                <i className="fa-solid fa-shield-halved text-xl"></i>
              </div>
              <div>
                <h1 className="font-extrabold text-lg leading-tight tracking-tight text-slate-900 dark:text-white">
                  Admin Panel
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Captain Hook Sync
                </p>
              </div>
            </div>
          </div>

          {/* Menu */}
          <nav className="mt-6 space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all group ${
                  item.active
                    ? "bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-200 border border-violet-200 dark:border-violet-500/40"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <i
                  className={`fa-solid ${item.icon} w-5 text-center ${
                    item.active
                      ? "text-violet-600 dark:text-violet-300"
                      : "group-hover:text-violet-500 dark:group-hover:text-violet-400"
                  } transition`}
                ></i>
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded font-mono">
                    {item.badge}
                  </span>
                )}
                {item.active && !item.badge && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-violet-500"></span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom: User + Theme */}
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800/80">
          <Link
            href="/"
            className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 hover:border-violet-500/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all group cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                  E
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition">
                  Ellan Worker
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <i className="fa-solid fa-shield-halved text-[9px]"></i>
                  Administrator
                </p>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all text-xs"></i>
          </Link>

          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center space-x-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            title={isDark ? "Mode Terang" : "Mode Gelap"}
          >
            <i
              className={`fa-solid ${
                isDark ? "fa-sun" : "fa-moon"
              } text-sm text-slate-700 dark:text-slate-300`}
            ></i>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isDark ? "Mode Terang" : "Mode Gelap"}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}