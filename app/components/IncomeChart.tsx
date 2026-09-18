"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ChartData = {
  date: string;
  total: number;
  count: number;
};

type Period = "7d" | "14d" | "30d";

export default function IncomeChart() {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("7d");
  const [chartType, setChartType] = useState<"area" | "bar">("area");

  useEffect(() => {
    const days = period === "7d" ? 7 : period === "14d" ? 14 : 30;
    setLoading(true);
    fetch(`/api/stats/income/chart?days=${days}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .catch((err) => console.error("Error fetch chart:", err))
      .finally(() => setLoading(false));
  }, [period]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  const formatRupiah = (num: number) => {
    if (num >= 1000000) return `Rp ${(num / 1000000).toFixed(1)}jt`;
    if (num >= 1000) return `Rp ${(num / 1000).toFixed(0)}k`;
    return `Rp ${num}`;
  };

  const formatRupiahFull = (num: number) => {
    return "Rp " + num.toLocaleString("id-ID");
  };

  const totalPeriod = data.reduce((sum, d) => sum + d.total, 0);
  const totalOrders = data.reduce((sum, d) => sum + d.count, 0);
  const avgPerDay = data.length > 0 ? Math.round(totalPeriod / data.length) : 0;

  const tooltipStyle = {
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#f1f5f9",
    fontSize: "12px",
  };

  return (
    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-chart-line text-violet-600 dark:text-violet-400"></i>
            <span>Grafik Pendapatan</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {formatRupiahFull(totalPeriod)} dari {totalOrders} order • Rata-rata {formatRupiahFull(avgPerDay)}/hari
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {(["7d", "14d", "30d"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  period === p
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {p === "7d" ? "7 Hari" : p === "14d" ? "14 Hari" : "30 Hari"}
              </button>
            ))}
          </div>

          {/* Chart Type Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setChartType("area")}
              className={`p-1.5 rounded-lg text-xs transition ${
                chartType === "area"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Area Chart"
            >
              <i className="fa-solid fa-chart-area"></i>
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`p-1.5 rounded-lg text-xs transition ${
                chartType === "bar"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Bar Chart"
            >
              <i className="fa-solid fa-chart-column"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
          Belum ada data pendapatan
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          {chartType === "area" ? (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#94a3b8"
                style={{ fontSize: "11px" }}
              />
              <YAxis
                tickFormatter={formatRupiah}
                stroke="#94a3b8"
                style={{ fontSize: "11px" }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: any) => [formatRupiahFull(Number(value) || 0), "Pendapatan"]}
                labelFormatter={(label: any) => `Tanggal: ${formatDate(String(label))}`}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#8b5cf6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorIncome)"
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#94a3b8"
                style={{ fontSize: "11px" }}
              />
              <YAxis
                tickFormatter={formatRupiah}
                stroke="#94a3b8"
                style={{ fontSize: "11px" }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: any) => [formatRupiahFull(Number(value) || 0), "Pendapatan"]}
                labelFormatter={(label: any) => `Tanggal: ${formatDate(String(label))}`}
              />
              <Bar dataKey="total" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}