"use client";

import { useEffect, useState } from "react";
import { useSidebar } from "../SidebarContext";

type FailedOrder = {
  order_id: string;
  product_title?: string;
  joki_name?: string;
  roblox_username?: string;
  bot_failed_reason?: string;
  bot_failed_at?: string;
  bot_failed_source?: string;
  manual_retry_count?: number;
  bot_failed_context?: {
    product_title?: string;
    total_pendapatan?: string;
    username_roblox?: string;
    nama_pembeli?: string;
    attempts?: number;
  };
};

type IncomeLog = {
  id?: number | string;
  order_id: string;
  joki_name?: string;
  product_title?: string;
  amount?: number;
  completed_at?: string;
  roblox_username?: string;
  buyer_name?: string;
};

export default function OrderGagalPage() {
  const [orders, setOrders] = useState<FailedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { sidebarOpen, toggleSidebar } = useSidebar();

  // ══════════════════════════════════════════════════════
  // ⭐ SEARCH STATE
  // ══════════════════════════════════════════════════════
  const [searchQuery, setSearchQuery] = useState("");
  const [incomeSearch, setIncomeSearch] = useState("");
  const [incomeResults, setIncomeResults] = useState<IncomeLog[]>([]);
  const [incomeSearching, setIncomeSearching] = useState(false);
  const [showIncomePanel, setShowIncomePanel] = useState(false);
  const [incomeSearched, setIncomeSearched] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/queue/failed");
      const data = await res.json();
      if (data.success) setOrders(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = async (order_id: string) => {
    setActionLoading(order_id);
    const res = await fetch("/api/queue/failed/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id }),
    });
    const data = await res.json();
    if (!data.success) alert(data.error);
    await fetchOrders();
    setActionLoading(null);
  };

  const handleDelete = async (order: FailedOrder, insertIncome: boolean) => {
    const amount =
      parseInt(
        (order.bot_failed_context?.total_pendapatan || "0").replace(/\D/g, ""),
        10
      ) || 0;

    const confirmMsg = insertIncome
      ? `Hapus order ${order.order_id} DAN insert income Rp ${amount.toLocaleString(
          "id-ID"
        )}?`
      : `Hapus order ${order.order_id} TANPA insert income?`;

    if (!confirm(confirmMsg)) return;

    setActionLoading(order.order_id);
    await fetch("/api/queue/failed/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: order.order_id,
        insert_income: insertIncome,
        amount,
        joki_name: order.joki_name || "ellan",
        product_title:
          order.bot_failed_context?.product_title || order.product_title,
      }),
    });
    await fetchOrders();
    setActionLoading(null);
  };

  // ══════════════════════════════════════════════════════
  // ⭐ SEARCH INCOME LOG
  // ══════════════════════════════════════════════════════
  const searchIncomeLog = async () => {
    const q = incomeSearch.trim();
    if (!q) return;
    setIncomeSearching(true);
    setIncomeSearched(true);
    try {
      const res = await fetch(`/api/income/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) {
        setIncomeResults(data.data || []);
        setShowIncomePanel(true);
      } else {
        alert(data.error || "Gagal search income log");
        setIncomeResults([]);
        setShowIncomePanel(true);
      }
    } catch (err) {
      console.error(err);
      alert("Error search income log");
      setIncomeResults([]);
      setShowIncomePanel(true);
    } finally {
      setIncomeSearching(false);
    }
  };

  const resetIncomeSearch = () => {
    setShowIncomePanel(false);
    setIncomeResults([]);
    setIncomeSearch("");
    setIncomeSearched(false);
  };

  // ══════════════════════════════════════════════════════
  // SUMMARY STATS
  // ══════════════════════════════════════════════════════
  const totalFailed = orders.length;
  const totalAmount = orders.reduce((sum, o) => {
    const amt =
      parseInt(
        (o.bot_failed_context?.total_pendapatan || "0").replace(/\D/g, ""),
        10
      ) || 0;
    return sum + amt;
  }, 0);
  const totalRetries = orders.reduce(
    (sum, o) => sum + (o.manual_retry_count ?? 0),
    0
  );
  const sourceCount = orders.reduce((acc, o) => {
    const src = o.bot_failed_source || "unknown";
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ⭐ Filter orders berdasarkan searchQuery
  const filteredOrders = orders.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.order_id.toLowerCase().includes(q) ||
      (o.bot_failed_context?.username_roblox || o.roblox_username || "")
        .toLowerCase()
        .includes(q) ||
      (o.bot_failed_context?.nama_pembeli || "").toLowerCase().includes(q) ||
      (o.bot_failed_context?.product_title || o.product_title || "")
        .toLowerCase()
        .includes(q)
    );
  });

  return (
    <>
      {/* ══════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════ */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between gap-3 z-20 shrink-0">
        <div className="flex items-center space-x-3 shrink-0">
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

          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-rose-600 via-red-600 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-rose-600/30">
            <i className="fa-solid fa-triangle-exclamation text-base"></i>
          </div>

          <div className="hidden md:block">
            <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Order Gagal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Order yang bot gagal proses setelah 3x retry
            </p>
          </div>
        </div>

        {/* ⭐ SEARCH BAR — filter list order gagal */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
            <input
              type="text"
              placeholder="Filter list order gagal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-red-500/50 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Clear"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            )}
          </div>
        </div>

        {/* Badge total failed */}
        {totalFailed > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-xs font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
              {totalFailed} perlu dicek
            </span>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════════
          CONTENT
      ══════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8 space-y-6">
        {/* ─────────────────────────────────────
            SUMMARY CARDS
        ───────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 animate-pulse"
                >
                  <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded mb-3"></div>
                  <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
              ))}
            </>
          ) : (
            <>
              {/* Total Gagal */}
              <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-red-500/50 transition-all duration-300">
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-red-500/10 dark:bg-red-600/10 rounded-full blur-xl"></div>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                      <span>Total Gagal</span>
                    </p>
                    <h3 className="text-lg md:text-2xl font-black text-red-600 dark:text-red-400 mt-1 truncate">
                      {totalFailed}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-200 dark:border-red-500/20 shrink-0">
                    <i className="fa-solid fa-circle-xmark text-base"></i>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-[11px] font-semibold text-red-600 dark:text-red-400">
                  <i className="fa-solid fa-list mr-1.5"></i>
                  <span>Perlu tindakan manual</span>
                </div>
              </div>

              {/* Total Amount */}
              <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-green-500/50 transition-all duration-300">
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-green-500/10 dark:bg-green-600/10 rounded-full blur-xl"></div>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-money-bill-wave text-xs"></i>
                      <span>Potensi Income</span>
                    </p>
                    <h3 className="text-lg md:text-2xl font-black text-green-600 dark:text-green-400 mt-1 truncate">
                      Rp {totalAmount.toLocaleString("id-ID")}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center border border-green-200 dark:border-green-500/20 shrink-0">
                    <i className="fa-solid fa-coins text-base"></i>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-[11px] font-semibold text-green-600 dark:text-green-400">
                  <i className="fa-solid fa-calculator mr-1.5"></i>
                  <span>Belum masuk income_log</span>
                </div>
              </div>

              {/* Total Retry */}
              <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-amber-500/50 transition-all duration-300">
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-amber-500/10 dark:bg-amber-600/10 rounded-full blur-xl"></div>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-rotate-right text-xs"></i>
                      <span>Total Retry</span>
                    </p>
                    <h3 className="text-lg md:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 truncate">
                      {totalRetries}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-500/20 shrink-0">
                    <i className="fa-solid fa-arrows-rotate text-base"></i>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <i className="fa-solid fa-clock-rotate-left mr-1.5"></i>
                  <span>Percobaan manual</span>
                </div>
              </div>

              {/* Source Breakdown */}
              <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-blue-500/50 transition-all duration-300">
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-xl"></div>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-code-branch text-xs"></i>
                      <span>Sumber</span>
                    </p>
                    <h3 className="text-lg md:text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 truncate">
                      {Object.keys(sourceCount).length}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-500/20 shrink-0">
                    <i className="fa-solid fa-diagram-project text-base"></i>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  <i className="fa-solid fa-tags mr-1.5"></i>
                  <span className="truncate">
                    {Object.entries(sourceCount)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ") || "—"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ─────────────────────────────────────
            LIST ORDERS
        ───────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animate-pulse"
              >
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-3"></div>
                <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded mb-3"></div>
                <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded"></div>
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 md:p-12 text-center">
            <div
              className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${
                searchQuery
                  ? "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  : "bg-green-100 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20"
              }`}
            >
              <i
                className={`fa-solid ${
                  searchQuery ? "fa-search" : "fa-circle-check"
                } text-2xl ${
                  searchQuery
                    ? "text-slate-400"
                    : "text-green-600 dark:text-green-400"
                }`}
              ></i>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1">
              {searchQuery ? "Order Tidak Ditemukan" : "Semua Order Lancar"}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {searchQuery
                ? `Nggak ada order gagal yang match dengan "${searchQuery}"`
                : "Tidak ada order yang gagal diproses bot. Kerja bagus!"}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition"
              >
                <i className="fa-solid fa-xmark mr-1.5"></i>
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const ctx = order.bot_failed_context || {};
              const amount =
                parseInt((ctx.total_pendapatan || "0").replace(/\D/g, ""), 10) ||
                0;
              const retryCount = order.manual_retry_count ?? 0;
              const maxRetry = 5;
              const retryDisabled = retryCount >= maxRetry;
              const isLoading = actionLoading === order.order_id;

              return (
                <div
                  key={order.order_id}
                  className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 hover:border-red-500/30 transition-all duration-300"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    {/* ── Left: Info ── */}
                    <div className="flex-1 space-y-3 min-w-0">
                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 flex items-center gap-1.5">
                          <i className="fa-solid fa-triangle-exclamation text-[9px]"></i>
                          BOT GAGAL
                        </span>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                          <i className="fa-solid fa-code-branch text-[9px]"></i>
                          {order.bot_failed_source || "unknown"}
                        </span>
                        {retryCount > 0 && (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 flex items-center gap-1.5">
                            <i className="fa-solid fa-rotate-right text-[9px]"></i>
                            Retry: {retryCount}/{maxRetry}
                          </span>
                        )}
                      </div>

                      {/* Order ID */}
                      <h3 className="font-extrabold text-lg md:text-xl text-slate-900 dark:text-white tracking-tight truncate">
                        #{order.order_id}
                      </h3>

                      {/* Grid Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <i className="fa-solid fa-box text-slate-400 dark:text-slate-500 text-xs mt-1 w-4"></i>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                              Produk
                            </p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {ctx.product_title || order.product_title || "-"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <i className="fa-solid fa-user-tie text-slate-400 dark:text-slate-500 text-xs mt-1 w-4"></i>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                              Joki
                            </p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 capitalize truncate">
                              {order.joki_name || "ellan"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <i className="fa-solid fa-gamepad text-slate-400 dark:text-slate-500 text-xs mt-1 w-4"></i>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                              Username Roblox
                            </p>
                            <p className="font-mono text-slate-800 dark:text-slate-200 truncate">
                              {ctx.username_roblox ||
                                order.roblox_username ||
                                "-"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <i className="fa-solid fa-user text-slate-400 dark:text-slate-500 text-xs mt-1 w-4"></i>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                              Pembeli
                            </p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {ctx.nama_pembeli || "-"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 sm:col-span-2">
                          <i className="fa-solid fa-money-bill-wave text-green-500 text-xs mt-1 w-4"></i>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                              Total Pendapatan
                            </p>
                            <p className="font-black text-green-600 dark:text-green-400 text-base">
                              Rp {amount.toLocaleString("id-ID")}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Reason + Timestamp */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <i className="fa-solid fa-circle-info text-[10px]"></i>
                          <span className="italic">
                            {order.bot_failed_reason || "Unknown reason"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <i className="fa-solid fa-clock text-[10px]"></i>
                          <span>
                            {order.bot_failed_at
                              ? new Date(order.bot_failed_at).toLocaleString(
                                  "id-ID",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
                              : "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ── Right: Actions ── */}
                    <div className="flex flex-col gap-2 lg:w-48 shrink-0">
                      {/* Retry */}
                      <button
                        onClick={() => handleRetry(order.order_id)}
                        disabled={isLoading || retryDisabled}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-600/20"
                        title={
                          retryDisabled
                            ? `Max ${maxRetry}x retry tercapai`
                            : "Minta bot retry order ini"
                        }
                      >
                        <i
                          className={`fa-solid ${
                            isLoading ? "fa-spinner fa-spin" : "fa-rotate-right"
                          } text-xs`}
                        ></i>
                        <span>Retry{retryDisabled ? " (max)" : ""}</span>
                      </button>

                      {/* Hapus */}
                      <button
                        onClick={() => handleDelete(order, false)}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-red-600/20"
                        title="Hapus order tanpa insert income"
                      >
                        <i className="fa-solid fa-trash text-xs"></i>
                        <span>Hapus</span>
                      </button>

                      {/* Hapus + Income */}
                      <button
                        onClick={() => handleDelete(order, true)}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-green-600/20"
                        title="Hapus order dan insert income"
                      >
                        <i className="fa-solid fa-coins text-xs"></i>
                        <span>Hapus + Income</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            ⭐ SEARCH INCOME LOG PANEL — PINDAH KE BAWAH
        ══════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/5 dark:bg-blue-600/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex flex-col md:flex-row md:items-center gap-3 relative">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                <i className="fa-solid fa-database text-sm"></i>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Cek Income Log
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Search langsung ke Supabase
                </p>
              </div>
            </div>

            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
                <input
                  type="text"
                  placeholder="Order ID / username / joki..."
                  value={incomeSearch}
                  onChange={(e) => setIncomeSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") searchIncomeLog();
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/50 transition"
                />
              </div>
              <button
                onClick={searchIncomeLog}
                disabled={incomeSearching || !incomeSearch.trim()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-600/20 flex items-center gap-2"
              >
                <i
                  className={`fa-solid ${
                    incomeSearching ? "fa-spinner fa-spin" : "fa-search"
                  } text-xs`}
                ></i>
                <span className="hidden sm:inline">Cari</span>
              </button>
              {showIncomePanel && (
                <button
                  onClick={resetIncomeSearch}
                  className="px-3 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                  title="Tutup hasil"
                >
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              )}
            </div>
          </div>

          {/* Hasil search */}
          {showIncomePanel && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Hasil: {incomeResults.length} entry
                </p>
                {incomeResults.length > 0 && (
                  <p className="text-[11px] font-semibold text-green-600 dark:text-green-400">
                    Total: Rp{" "}
                    {incomeResults
                      .reduce((s, r) => s + (r.amount || 0), 0)
                      .toLocaleString("id-ID")}
                  </p>
                )}
              </div>

              {incomeResults.length === 0 && incomeSearched ? (
                <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">
                  <i className="fa-solid fa-inbox text-2xl mb-2 opacity-40"></i>
                  <p>Nggak ada data yang match</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
                  {incomeResults.map((item, idx) => (
                    <div
                      key={item.id ?? idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 hover:border-blue-500/30 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                              #{item.order_id}
                            </span>
                            {item.joki_name && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 capitalize">
                                {item.joki_name}
                              </span>
                            )}
                            {item.roblox_username && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {item.roblox_username}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                            {item.product_title || "-"}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            <i className="fa-solid fa-clock mr-1"></i>
                            {item.completed_at
                              ? new Date(item.completed_at).toLocaleString(
                                  "id-ID",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
                              : "-"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-green-600 dark:text-green-400 text-sm">
                            Rp {(item.amount || 0).toLocaleString("id-ID")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}