"use client";

import { useEffect, useState } from "react";

type Customer = {
  buyer_name: string;
  total_amount: number;
  order_count: number;
  first_order: string;
  last_order: string;
  order_ids: string[];
};

type Stats = {
  totalCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
};

type Period = "month" | "all";

export default function TopCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");
  const [limit, setLimit] = useState(5);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stats/customers?period=${period}&limit=${limit}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setCustomers(res.customers);
          setStats(res.stats);
        }
      })
      .catch((err) => console.error("Error fetch customers:", err))
      .finally(() => setLoading(false));
  }, [period, limit]);

  const formatRupiah = (num: number) => {
    return "Rp " + num.toLocaleString("id-ID");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };



  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (index: number) => {
    const colors = [
      "from-yellow-500 to-amber-500",
      "from-slate-400 to-slate-500",
      "from-orange-500 to-amber-600",
      "from-violet-500 to-indigo-500",
      "from-blue-500 to-cyan-500",
      "from-emerald-500 to-green-500",
      "from-pink-500 to-rose-500",
      "from-purple-500 to-fuchsia-500",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-crown text-yellow-500"></i>
            <span>Top Customers</span>
          </h3>
          {stats && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {stats.totalCustomers} customer • {stats.repeatCustomers} repeat (
              {stats.repeatRate}%)
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setPeriod("month")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                period === "month"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setPeriod("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                period === "all"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Semua
            </button>
          </div>

          {/* Limit Selector */}
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-violet-500 transition cursor-pointer"
          >
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : customers.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
          Belum ada data customer
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map((customer, index) => {
            const isExpanded = expandedCustomer === customer.buyer_name;
            return (
              <div
                key={customer.buyer_name}
                className={`rounded-xl border transition-all duration-200 ${
                  index < 3
                    ? "bg-linear-to-r from-yellow-50 to-amber-50 dark:from-yellow-500/5 dark:to-amber-500/5 border-yellow-200 dark:border-yellow-500/20"
                    : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800"
                }`}
              >
                {/* Customer Row */}
                <button
                  onClick={() =>
                    setExpandedCustomer(isExpanded ? null : customer.buyer_name)
                  }
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition rounded-xl"
                >
                                    {/* Medal / Rank Badge */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border-2 shadow-sm ${
                      index === 0
                        ? "bg-linear-to-br from-yellow-400 to-amber-500 border-yellow-300 text-white"
                        : index === 1
                        ? "bg-linear-to-br from-slate-300 to-slate-400 border-slate-200 text-white"
                        : index === 2
                        ? "bg-linear-to-br from-orange-400 to-amber-600 border-orange-300 text-white"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {index < 3 ? (
                      <i className="fa-solid fa-crown text-xs"></i>
                    ) : (
                      index + 1
                    )}
                  </div>

                  {/* Avatar */}
                  <div
                    className={`w-10 h-10 rounded-xl bg-linear-to-br ${getAvatarColor(
                      index
                    )} flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0`}
                  >
                    {getInitials(customer.buyer_name)}
                  </div>

                  {/* Name + Order Count */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {customer.buyer_name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <i className="fa-solid fa-receipt text-[10px]"></i>
                      <span>{customer.order_count}x order</span>
                      {customer.order_count > 1 && (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded text-[9px] font-bold">
                          <i className="fa-solid fa-repeat text-[8px]"></i>
                          Repeat
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Total Amount */}
                  <div className="text-right shrink-0">
                    <p className="font-black text-sm text-violet-600 dark:text-violet-400">
                      {formatRupiah(customer.total_amount)}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {formatDate(customer.last_order)}
                    </p>
                  </div>

                  {/* Chevron */}
                  <i
                    className={`fa-solid fa-chevron-down text-slate-400 text-xs transition-transform shrink-0 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  ></i>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-200 dark:border-slate-800/60">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-white dark:bg-slate-950/50 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
                          Order Pertama
                        </p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                          {formatDate(customer.first_order)}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-slate-950/50 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
                          Order Terakhir
                        </p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                          {formatDate(customer.last_order)}
                        </p>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-2">
                      Order ID ({customer.order_ids.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {customer.order_ids.slice(0, 8).map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-md text-[10px] font-mono border border-slate-200 dark:border-slate-700/50"
                        >
                          <i className="fa-regular fa-copy text-[9px]"></i>
                          {id}
                        </span>
                      ))}
                      {customer.order_ids.length > 8 && (
                        <span className="inline-flex items-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-md text-[10px] font-bold">
                          +{customer.order_ids.length - 8} lagi
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}