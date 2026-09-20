"use client";

import { useEffect, useState } from "react";
import IncomeChart from "../components/IncomeChart";
import TopCustomers from "../components/TopCustomers";
import { useSidebar } from "./SidebarContext";
import { SkeletonStatsCard } from "@/app/components/Skeleton";
import { PushNotificationButton } from "../components/PushNotificationButton";

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
  const { sidebarOpen, toggleSidebar } = useSidebar();

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

  const formatRupiah = (num: number) => {
    return "Rp " + num.toLocaleString("id-ID");
  };

  return (
    <>
      {/* Header */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleSidebar}
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
        <PushNotificationButton />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <SkeletonStatsCard />
              <SkeletonStatsCard />
              <SkeletonStatsCard />
              <SkeletonStatsCard />
            </>
          ) : (
            <>
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
          </>
          )}
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
    </>
  );
}