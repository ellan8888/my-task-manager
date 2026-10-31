"use client";

import { useEffect, useState } from "react";
import IncomeChart from "../components/IncomeChart";
import TopCustomers from "../components/TopCustomers";
import { SkeletonStatsCard } from "@/app/components/Skeleton";
import { PushNotificationButton } from "../components/PushNotificationButton";

import AdminHeader from "@/app/components/AdminHeader";
import { StatCard } from "@/app/components/ui";
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

  // ★ State buat show/hide pendapatan
  const [showIncome, setShowIncome] = useState(true);

  // Load preferensi dari localStorage (setelah mount, biar nggak hydration mismatch)
  useEffect(() => {
    const saved = localStorage.getItem("showIncome");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved !== null) setShowIncome(saved === "true");
  }, []);

  const toggleIncome = () => {
    setShowIncome((prev) => {
      const next = !prev;
      localStorage.setItem("showIncome", String(next));
      return next;
    });
  };

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

  const masked = (num: number) =>
    showIncome ? formatRupiah(num) : "Rp ••••••";

  const maskedCount = (num: number) =>
    showIncome ? String(num) : "•••";

  return (
    <>
      {/* Header */}
      <AdminHeader
        icon="fa-shield-halved"
        iconClassName="from-violet-600 via-indigo-600 to-purple-500 shadow-violet-600/30"
        title="Dashboard Admin"
        subtitle="Statistik & laporan pendapatan"
      >

        <div className="flex items-center gap-2">
          <button
            onClick={toggleIncome}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
            title={showIncome ? "Sembunyikan Pendapatan" : "Tampilkan Pendapatan"}
          >
            <i
              className={`fa-solid ${
                showIncome ? "fa-eye" : "fa-eye-slash"
              } text-base`}
            ></i>
          </button>

          <PushNotificationButton />
        </div>
      </AdminHeader>

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
              <StatCard
                label="Hari ini"
                value={stats ? masked(stats.hariIni) : "—"}
                icon="fa-coins"
                color="emerald"
                footerIcon="fa-arrow-trend-up"
                footerText="Pendapatan hari ini"
                compact
              />
              <StatCard
                label="7 hari"
                value={stats ? masked(stats.mingguIni) : "—"}
                icon="fa-chart-line"
                color="indigo"
                footerIcon="fa-arrow-trend-up"
                footerText="Pendapatan 7 hari terakhir"
                compact
              />
              <StatCard
                label="Bulan ini"
                value={stats ? masked(stats.bulanIni) : "—"}
                icon="fa-calendar-check"
                color="violet"
                footerIcon="fa-arrow-trend-up"
                footerText="Pendapatan bulan ini"
                compact
              />
              <StatCard
                label="Total order"
                value={stats ? maskedCount(stats.totalOrders) : "—"}
                icon="fa-receipt"
                color="amber"
                footerIcon="fa-hashtag"
                footerText="Bulan ini"
              />
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
                          {showIncome ? formatRupiah(amount) : "Rp ••••••"}
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