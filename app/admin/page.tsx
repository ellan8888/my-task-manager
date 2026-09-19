"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import IncomeChart from "../components/IncomeChart";
import TopCustomers from "../components/TopCustomers";
import Sidebar from "../components/Sidebar";

type IncomeStats = {
  hariIni: number;
  mingguIni: number;
  bulanIni: number;
  perJoki: Record<string, number>;
  totalOrders: number;
};

export default function AdminPage() {
  const [stats, setStats] = useState<IncomeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const pathname = usePathname();

  // ══════════════════════════════════════════════════════
  // FETCH STATS
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/stats/income");
        const data = await res.json();
        if (data.success) setStats(data);
      } catch (err) {
        console.error("Error fetch stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // ══════════════════════════════════════════════════════
  // THEME + SIDEBAR STATE
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

  useEffect(() => {
    const savedSidebar = localStorage.getItem("sidebarOpen");
    if (savedSidebar !== null) {
      setSidebarOpen(savedSidebar === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarOpen", String(sidebarOpen));
  }, [sidebarOpen]);

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

  const formatRupiah = (num: number) => {
    return "Rp " + num.toLocaleString("id-ID");
  };

  // ══════════════════════════════════════════════════════
  // MENU ITEMS — biar gampang nambah
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
      <style>{`
  body, aside, main, header {
    transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease;
  }
`}</style>

      <div className="h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-violet-500 selection:text-white flex flex-col relative">

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

        {/* ══════════════════════════════════════════════════════ */}
        {/* MAIN CONTENT                                         */}
        {/* ══════════════════════════════════════════════════════ */}
        <main
          className={`flex-1 flex flex-col h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 transition-[margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            sidebarOpen ? "md:ml-72" : "md:ml-0"
          }`}
        >
          {/* Header */}
          <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-20 shrink-0">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
                title={sidebarOpen ? "Tutup Sidebar" : "Buka Sidebar"}
              >
                <i
                  className={`fa-solid ${
                    sidebarOpen ? "fa-bars-staggered" : "fa-bars"
                  } text-base`}
                ></i>
              </button>

              <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-violet-600/30">
                <i className="fa-solid fa-shield-halved text-base"></i>
              </div>

              <div>
                <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Dashboard Admin
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                  Statistik & laporan pendapatan
                </p>
              </div>
            </div>

          </header>

          {/* Content */}
          <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Hari Ini */}
              <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-green-500/50 transition-all duration-300">
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-green-500/10 dark:bg-green-600/10 rounded-full blur-xl"></div>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-money-bill-wave text-xs"></i>
                      <span>Hari Ini</span>
                    </p>
                    <h3 className="text-lg md:text-2xl font-black text-green-600 dark:text-green-400 mt-1 truncate">
                      {stats ? formatRupiah(stats.hariIni) : "—"}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center border border-green-200 dark:border-green-500/20 shrink-0">
                    <i className="fa-solid fa-coins text-base"></i>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-[11px] font-semibold text-green-600 dark:text-green-400">
                  <i className="fa-solid fa-arrow-trend-up mr-1.5"></i>
                  <span>Pendapatan Hari Ini</span>
                </div>
              </div>

              {/* Minggu Ini */}
              <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-blue-500/50 transition-all duration-300">
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-xl"></div>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-calendar-week text-xs"></i>
                      <span>7 Hari</span>
                    </p>
                    <h3 className="text-lg md:text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 truncate">
                      {stats ? formatRupiah(stats.mingguIni) : "—"}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-500/20 shrink-0">
                    <i className="fa-solid fa-chart-line text-base"></i>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  <i className="fa-solid fa-arrow-trend-up mr-1.5"></i>
                  <span>Pendapatan Minggu Ini</span>
                </div>
              </div>

              {/* Bulan Ini */}
              <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-purple-500/50 transition-all duration-300">
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-purple-500/10 dark:bg-purple-600/10 rounded-full blur-xl"></div>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-calendar text-xs"></i>
                      <span>Bulan Ini</span>
                    </p>
                    <h3 className="text-lg md:text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 truncate">
                      {stats ? formatRupiah(stats.bulanIni) : "—"}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-500/20 shrink-0">
                    <i className="fa-solid fa-calendar-check text-base"></i>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                  <i className="fa-solid fa-arrow-trend-up mr-1.5"></i>
                  <span>Pendapatan Bulan Ini</span>
                </div>
              </div>

              {/* Total Order */}
              <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-amber-500/50 transition-all duration-300">
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-amber-500/10 dark:bg-amber-600/10 rounded-full blur-xl"></div>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-boxes-stacked text-xs"></i>
                      <span>Total Order</span>
                    </p>
                    <h3 className="text-lg md:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 truncate">
                      {stats ? stats.totalOrders : "—"}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-500/20 shrink-0">
                    <i className="fa-solid fa-receipt text-base"></i>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <i className="fa-solid fa-hashtag mr-1.5"></i>
                  <span>Bulan Ini</span>
                </div>
              </div>
            </div>

            {/* Grafik Pendapatan */}
            <IncomeChart />

            <TopCustomers />

            {/* Breakdown Per Joki */}
            {stats && Object.keys(stats.perJoki).length > 0 && (
              <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                  <i className="fa-solid fa-users text-violet-600 dark:text-violet-400"></i>
                  <span>Breakdown Per Joki (Bulan Ini)</span>
                </h3>

                <div className="space-y-3">
                  {Object.entries(stats.perJoki)
                    .sort(([, a], [, b]) => b - a)
                    .map(([joki, amount]) => {
                      const total = Object.values(stats.perJoki).reduce(
                        (a, b) => a + b,
                        0
                      );
                      const percent = total > 0 ? (amount / total) * 100 : 0;
                      return (
                        <div key={joki}>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize">
                              {joki}
                            </span>
                            <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                              {formatRupiah(amount)}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-linear-to-r from-violet-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            {percent.toFixed(1)}% dari total
                          </p>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}