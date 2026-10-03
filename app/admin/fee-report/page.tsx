// app/admin/fee-report/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type FeeDetail = {
  id: number;
  order_id: string;
  joki_name: string;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  created_at: string;
};

type FeeSummary = {
  joki_name: string;
  total_gross: number;
  total_fee: number;
  total_net: number;
  total_orders: number;
};

export default function FeeReportPage() {
  const [user, setUser] = useState<any>(null);
  const [summary, setSummary] = useState<FeeSummary[]>([]);
  const [detail, setDetail] = useState<FeeDetail[]>([]);
  const [loading, setLoading] = useState(true);

  // ⭐ Filter state
  const [filterJoki, setFilterJoki] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [searchOrderId, setSearchOrderId] = useState<string>("");

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

  // ══════════════════════════════════════════════════════
  // FILTER LOGIC
  // ══════════════════════════════════════════════════════
  const filteredDetail = useMemo(() => {
    return detail.filter((row) => {
      // Filter joki
      if (filterJoki !== "all" && row.joki_name.toLowerCase() !== filterJoki) {
        return false;
      }

      // Filter search order_id
      if (searchOrderId && !row.order_id.toLowerCase().includes(searchOrderId.toLowerCase())) {
        return false;
      }

      // Filter date from
      if (filterDateFrom) {
        const rowDate = new Date(row.created_at).toISOString().split("T")[0];
        if (rowDate < filterDateFrom) return false;
      }

      // Filter date to
      if (filterDateTo) {
        const rowDate = new Date(row.created_at).toISOString().split("T")[0];
        if (rowDate > filterDateTo) return false;
      }

      return true;
    });
  }, [detail, filterJoki, filterDateFrom, filterDateTo, searchOrderId]);

  // ⭐ Total dari data yang udah difilter
  const filteredTotals = useMemo(() => {
    return filteredDetail.reduce(
      (acc, row) => ({
        gross: acc.gross + (row.gross_amount || 0),
        fee: acc.fee + (row.fee_amount || 0),
        net: acc.net + (row.net_amount || 0),
        orders: acc.orders + 1,
      }),
      { gross: 0, fee: 0, net: 0, orders: 0 }
    );
  }, [filteredDetail]);

  // ⭐ List joki unik buat dropdown
  const jokiList = useMemo(() => {
    const set = new Set(detail.map((d) => d.joki_name.toLowerCase()));
    return Array.from(set);
  }, [detail]);

  // ══════════════════════════════════════════════════════
  // GUARD — cuma ellan
  // ══════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <i className="fa-solid fa-money-bill-trend-up text-emerald-600"></i>
            Laporan Fee
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            🔒 Data rahasia — cuma owner yang bisa akses
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">
            <i className="fa-solid fa-shield-halved mr-1"></i>
            Owner Only
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* SUMMARY CARDS — TOTAL SEMUA */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-500 uppercase">
            Total Gross
          </p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            Rp {filteredTotals.gross.toLocaleString("id-ID")}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            {filteredTotals.orders} order
          </p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-5">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">
            💰 Fee Kamu
          </p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
            Rp {filteredTotals.fee.toLocaleString("id-ID")}
          </p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
            Total fee kekumpul
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-500 uppercase">
            Total Net (Joki)
          </p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            Rp {filteredTotals.net.toLocaleString("id-ID")}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            Yang diterima joki
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* BREAKDOWN PER JOKI */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-chart-pie text-violet-600"></i>
            Breakdown per Joki
          </h3>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded font-bold">
            {summary.length} joki
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-950/50">
              <tr className="text-xs font-bold text-slate-500 uppercase">
                <th className="text-left p-3">Joki</th>
                <th className="text-right p-3">Gross</th>
                <th className="text-right p-3">Fee</th>
                <th className="text-right p-3">Net</th>
                <th className="text-right p-3">Order</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr
                  key={row.joki_name}
                  className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition"
                >
                  <td className="p-3 font-bold capitalize text-slate-900 dark:text-white">
                    {row.joki_name}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                    Rp {row.total_gross.toLocaleString("id-ID")}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                    Rp {row.total_fee.toLocaleString("id-ID")}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-900 dark:text-white">
                    Rp {row.total_net.toLocaleString("id-ID")}
                  </td>
                  <td className="p-3 text-right text-slate-500 dark:text-slate-400">
                    {row.total_orders}
                  </td>
                </tr>
              ))}
              {summary.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-slate-500">
                    Belum ada data fee
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* FILTER BAR */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <i className="fa-solid fa-filter text-slate-400 text-xs"></i>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
            Filter Detail
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search order_id */}
          <div className="relative">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder="Cari Order ID..."
              value={searchOrderId}
              onChange={(e) => setSearchOrderId(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Filter joki */}
          <select
            value={filterJoki}
            onChange={(e) => setFilterJoki(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Semua Joki</option>
            {jokiList.map((j) => (
              <option key={j} value={j} className="capitalize">
                {j}
              </option>
            ))}
          </select>

          {/* Date from */}
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            placeholder="Dari tanggal"
            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:border-emerald-500"
          />

          {/* Date to */}
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            placeholder="Sampai tanggal"
            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Reset button */}
        {(filterJoki !== "all" ||
          filterDateFrom ||
          filterDateTo ||
          searchOrderId) && (
          <button
            onClick={() => {
              setFilterJoki("all");
              setFilterDateFrom("");
              setFilterDateTo("");
              setSearchOrderId("");
            }}
            className="mt-3 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
          >
            <i className="fa-solid fa-xmark"></i>
            Reset Filter
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* DETAIL PER ORDER */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-list text-amber-600"></i>
            Detail per Order
          </h3>
          <span className="text-[10px] bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded font-bold">
            {filteredDetail.length} order
          </span>
        </div>

        <div className="overflow-x-auto max-h-150 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-950/50 sticky top-0">
              <tr className="text-xs font-bold text-slate-500 uppercase">
                <th className="text-left p-3">Tanggal</th>
                <th className="text-left p-3">Order ID</th>
                <th className="text-left p-3">Joki</th>
                <th className="text-right p-3">Gross</th>
                <th className="text-right p-3">Fee</th>
                <th className="text-right p-3">Net</th>
              </tr>
            </thead>
            <tbody>
              {filteredDetail.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition"
                >
                  <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-3 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {row.order_id}
                  </td>
                  <td className="p-3 text-xs font-bold capitalize text-slate-900 dark:text-white">
                    {row.joki_name}
                  </td>
                  <td className="p-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                    Rp {row.gross_amount.toLocaleString("id-ID")}
                  </td>
                  <td className="p-3 text-right font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                    Rp {row.fee_amount.toLocaleString("id-ID")}
                  </td>
                  <td className="p-3 text-right font-mono text-xs text-slate-900 dark:text-white">
                    Rp {row.net_amount.toLocaleString("id-ID")}
                  </td>
                </tr>
              ))}
              {filteredDetail.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-slate-500">
                    {detail.length === 0
                      ? "Belum ada data fee"
                      : "Nggak ada order yang match filter"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer total */}
        {filteredDetail.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Total {filteredDetail.length} order
            </span>
            <div className="flex items-center gap-4 font-mono">
              <span className="text-slate-600 dark:text-slate-400">
                Gross: <strong className="text-slate-900 dark:text-white">
                  Rp {filteredTotals.gross.toLocaleString("id-ID")}
                </strong>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400">
                Fee: <strong>Rp {filteredTotals.fee.toLocaleString("id-ID")}</strong>
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                Net: <strong className="text-slate-900 dark:text-white">
                  Rp {filteredTotals.net.toLocaleString("id-ID")}
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}