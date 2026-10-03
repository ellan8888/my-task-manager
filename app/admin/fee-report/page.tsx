// app/admin/fee-report/page.tsx
"use client";

import { useEffect, useState } from "react";

export default function FeeReportPage() {
  const [user, setUser] = useState<any>(null);
  const [summary, setSummary] = useState<any[]>([]);
  const [detail, setDetail] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.user) setUser(data.user);
      });
  }, []);

  useEffect(() => {
    if (!user || user.username !== "ellan") {
      setLoading(false);
      return;
    }

    fetch(`/api/fee-report?username=${user.username}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setSummary(data.summary || []);
          setDetail(data.detail || []);
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  // ⭐ Guard — kalau bukan ellan, blokir
  if (!loading && user?.username !== "ellan") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-lock text-2xl"></i>
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            Akses Ditolak
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Halaman ini cuma buat owner
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-violet-600"></i>
      </div>
    );
  }

  const totalFee = summary.reduce((sum, r) => sum + r.total_fee, 0);
  const totalGross = summary.reduce((sum, r) => sum + r.total_gross, 0);
  const totalNet = summary.reduce((sum, r) => sum + r.total_net, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <i className="fa-solid fa-money-bill-trend-up text-emerald-600"></i>
            Laporan Fee (Rahasia)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Data ini cuma bisa dilihat owner
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-500 uppercase">Total Gross</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            Rp {totalGross.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-5">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">
            💰 Total Fee (Kamu)
          </p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
            Rp {totalFee.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-500 uppercase">Total Net (Joki)</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            Rp {totalNet.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      {/* Summary per Joki */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-black text-slate-900 dark:text-white">
            Breakdown per Joki
          </h3>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-950/50">
            <tr className="text-xs font-bold text-slate-500 uppercase">
              <th className="text-left p-3">Joki</th>
              <th className="text-right p-3">Gross</th>
              <th className="text-right p-3">Fee (Kamu)</th>
              <th className="text-right p-3">Net (Joki)</th>
              <th className="text-right p-3">Order</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row) => (
              <tr
                key={row.joki_name}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <td className="p-3 font-bold capitalize">{row.joki_name}</td>
                <td className="p-3 text-right font-mono">
                  Rp {row.total_gross.toLocaleString("id-ID")}
                </td>
                <td className="p-3 text-right font-mono font-black text-emerald-600">
                  Rp {row.total_fee.toLocaleString("id-ID")}
                </td>
                <td className="p-3 text-right font-mono">
                  Rp {row.total_net.toLocaleString("id-ID")}
                </td>
                <td className="p-3 text-right text-slate-500">
                  {row.total_orders}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}