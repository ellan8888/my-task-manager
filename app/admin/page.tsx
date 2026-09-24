"use client";

import { useEffect, useState } from "react";
import IncomeChart from "../components/IncomeChart";
import TopCustomers from "../components/TopCustomers";
import { useSidebar } from "./SidebarContext";
import { SkeletonStatsCard } from "@/app/components/Skeleton";
import { PushNotificationButton } from "../components/PushNotificationButton";
import WithdrawFormModal from "../components/WithdrawFormModal";
import ApproveModal from "../components/ApproveModal";

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

  // ★ State buat show/hide pendapatan
  const [showIncome, setShowIncome] = useState(true);

  // Load preferensi dari localStorage
  useEffect(() => {
    const saved = localStorage.getItem("showIncome");
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

  // ⭐ SEMUA STATE DULU DI ATAS
const [currentUser, setCurrentUser] = useState<{
  username: string;
  role: string;
  display_name: string;
} | null>(null);

const [myBalance, setMyBalance] = useState<{
  totalIncome: number;
  totalWithdrawn: number;
  sisa: number;
} | null>(null);

const [withdrawals, setWithdrawals] = useState<any[]>([]);
const [pendingRequests, setPendingRequests] = useState<any[]>([]);
const [showWithdrawModal, setShowWithdrawModal] = useState(false);
const [approveModal, setApproveModal] = useState<any>(null);

// ⭐ BARU useEffect
useEffect(() => {
  fetch("/api/auth/me")
    .then((r) => r.json())
    .then((data) => {
      if (data.success && data.user) setCurrentUser(data.user);
    })
    .catch(console.error);
}, []);

// Fetch saldo sendiri (buat user biasa)
useEffect(() => {
  if (!currentUser || currentUser.role === "superadmin") return;

  const fetchBalance = async () => {
    try {
      const [incomeRes, withdrawRes] = await Promise.all([
        fetch("/api/stats/income/me"),
        fetch("/api/withdrawals"),
      ]);

      const incomeData = await incomeRes.json();
      const withdrawData = await withdrawRes.json();

      const totalIncome = incomeData.total || 0;
      const totalWithdrawn =
        (withdrawData.totals?.[currentUser.username] || 0) +
        (withdrawData.pendingTotals?.[currentUser.username] || 0);

      setMyBalance({
        totalIncome,
        totalWithdrawn,
        sisa: totalIncome - totalWithdrawn,
      });

      setWithdrawals(withdrawData.data || []);
    } catch (err) {
      console.error("Error fetch balance:", err);
    }
  };

  fetchBalance();
  const interval = setInterval(fetchBalance, 30000);
  return () => clearInterval(interval);
}, [currentUser]);

// Fetch pending requests (buat superadmin)
useEffect(() => {
  if (!currentUser || currentUser.role !== "superadmin") return;

  const fetchPending = async () => {
    try {
      const res = await fetch("/api/withdrawals?status=pending");
      const data = await res.json();
      if (data.success) {
        setPendingRequests(data.data || []);
        setWithdrawals(data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  fetchPending();
  const interval = setInterval(fetchPending, 30000);
  return () => clearInterval(interval);
}, [currentUser]);

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
                      {stats ? masked(stats.hariIni) : "—"}
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
                      {stats ? masked(stats.mingguIni) : "—"}
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
                      {stats ? masked(stats.bulanIni) : "—"}
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
                      {stats ? maskedCount(stats.totalOrders) : "—"}
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

        {/* ⭐ PENDAPATAN SAYA — cuma buat user biasa */}
{myBalance && currentUser?.role !== "superadmin" && (
  <div className="bg-linear-to-br from-emerald-500/10 to-violet-500/10 dark:from-emerald-500/5 dark:to-violet-500/5 backdrop-blur-xl border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-6">
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h3 className="font-extrabold text-xl text-slate-900 dark:text-white flex items-center gap-2">
          <i className="fa-solid fa-wallet text-emerald-600 dark:text-emerald-400"></i>
          Pendapatan Saya
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Ajukan penarikan — admin akan transfer setelah approve
        </p>
      </div>

      <button
        onClick={() => setShowWithdrawModal(true)}
        disabled={myBalance.sisa <= 0}
        className="px-5 py-3 rounded-xl bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed text-white font-bold shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 shrink-0"
      >
        <i className="fa-solid fa-money-bill-transfer"></i>
        Tarik
      </button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Total Pendapatan
        </p>
        <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">
          {showIncome ? formatRupiah(myBalance.totalIncome) : "Rp ••••••"}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
        <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
          Udah Ditarik
        </p>
        <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
          {showIncome ? formatRupiah(myBalance.totalWithdrawn) : "Rp ••••••"}
        </p>
      </div>

      <div className="bg-linear-to-br from-emerald-500 to-green-600 rounded-xl p-4 text-white shadow-lg shadow-emerald-600/30">
        <p className="text-xs font-bold uppercase tracking-wider opacity-90">
          💰 Sisa Saldo
        </p>
        <p className="text-2xl font-black mt-2">
          {showIncome ? formatRupiah(myBalance.sisa) : "Rp ••••••"}
        </p>
      </div>
    </div>
  </div>
)}

{/* ⭐ REQUEST PENDING — cuma buat superadmin */}
{currentUser?.role === "superadmin" && pendingRequests.length > 0 && (
  <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-amber-200 dark:border-amber-500/30 rounded-2xl p-5 shadow-sm">
    <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
      <i className="fa-solid fa-hourglass-half text-amber-600 dark:text-amber-400"></i>
      <span>Request Tarik Pending</span>
      <span className="ml-auto text-xs bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full font-bold">
        {pendingRequests.length}
      </span>
    </h3>

    <div className="space-y-2">
      {pendingRequests.map((w) => (
        <div
          key={w.id}
          className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20"
        >
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">
              {w.joki_name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {new Date(w.requested_at).toLocaleString("id-ID", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              })}
              {w.note && ` • ${w.note}`}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-3">
            <p className="text-base font-black text-amber-700 dark:text-amber-400">
              {formatRupiah(w.amount)}
            </p>
            <button
              onClick={() => setApproveModal(w)}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-md transition"
            >
              <i className="fa-solid fa-check mr-1"></i>
              Review
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

{withdrawals.length > 0 && currentUser?.role !== "superadmin" && (
  <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
    <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
      <i className="fa-solid fa-clock-rotate-left text-amber-600 dark:text-amber-400"></i>
      <span>History Penarikan Saya</span>
    </h3>

    <div className="space-y-2 max-h-96 overflow-y-auto">
      {withdrawals.map((w) => (
        <div
          key={w.id}
          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800"
        >
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {new Date(w.requested_at).toLocaleString("id-ID", {
                day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
              {w.note && ` • ${w.note}`}
            </p>
            {/* Status badge */}
            {w.status === "pending" && (
              <span className="inline-block mt-1 text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                ⏳ PENDING
              </span>
            )}
            {w.status === "approved" && (
              <span className="inline-block mt-1 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded">
                ✅ APPROVED
              </span>
            )}
            {w.status === "rejected" && (
              <span className="inline-block mt-1 text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded">
                ❌ REJECTED
              </span>
            )}
          </div>
          <p className="text-sm font-black text-rose-600 dark:text-rose-400 shrink-0 ml-3">
            -{showIncome ? formatRupiah(w.amount) : "Rp ••••••"}
          </p>
        </div>
      ))}
    </div>
  </div>
)}

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
      {/* Modal Tarik (user) */}
{showWithdrawModal && myBalance && (
  <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
            💰 Request Tarik
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sisa: {formatRupiah(myBalance.sisa)}
          </p>
        </div>
        <button
          onClick={() => setShowWithdrawModal(false)}
          className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <WithdrawFormModal
        maxAmount={myBalance.sisa}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={() => {
          setShowWithdrawModal(false);
          window.location.reload();
        }}
      />
    </div>
  </div>
)}

{/* Modal Approve (superadmin) */}
{approveModal && (
  <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl">
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
          Review Request
        </h3>
        <button
          onClick={() => setApproveModal(null)}
          className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <ApproveModal
        withdrawal={approveModal}
        onClose={() => setApproveModal(null)}
        onSuccess={() => {
          setApproveModal(null);
          window.location.reload();
        }}
      />
    </div>
  </div>
)}
    </>
  );
}