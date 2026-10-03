// app/admin/fee-report/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSidebar } from "../SidebarContext";

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

type FeeRule = {
  id: number;
  joki_name: string;
  fee_amount: number;
  is_active: boolean;
  description: string | null;
};

export default function FeeReportPage() {
  const { sidebarOpen, toggleSidebar } = useSidebar();

  const [user, setUser] = useState<any>(null);
  const [summary, setSummary] = useState<FeeSummary[]>([]);
  const [detail, setDetail] = useState<FeeDetail[]>([]);
  const [feeRules, setFeeRules] = useState<FeeRule[]>([]);
  const [loading, setLoading] = useState(true);

  // ⭐ Filter state
  const [filterJoki, setFilterJoki] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [searchOrderId, setSearchOrderId] = useState<string>("");

  // ⭐ Edit state — fee rules
  const [editingFee, setEditingFee] = useState<string | null>(null);
  const [editFeeValue, setEditFeeValue] = useState<number>(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newJokiName, setNewJokiName] = useState("");
  const [newFeeAmount, setNewFeeAmount] = useState(500);
  const [actionLoading, setActionLoading] = useState(false);

  // ══════════════════════════════════════════════════════
  // FETCH USER
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.user) setUser(data.user);
      });
  }, []);

  // ══════════════════════════════════════════════════════
  // FETCH DATA
  // ══════════════════════════════════════════════════════
  const fetchData = async () => {
    if (!user || user.username !== "ellan") {
      setLoading(false);
      return;
    }

    try {
      const [reportRes, rulesRes] = await Promise.all([
        fetch(`/api/fee-report?username=${user.username}`),
        fetch(`/api/fee-rules?username=${user.username}`),
      ]);

      const reportData = await reportRes.json();
      const rulesData = await rulesRes.json();

      if (reportData.success) {
        setSummary(reportData.summary || []);
        setDetail(reportData.detail || []);
      }
      if (rulesData.success) {
        setFeeRules(rulesData.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  // ══════════════════════════════════════════════════════
  // FEE RULES — HANDLERS
  // ══════════════════════════════════════════════════════
  const handleUpdateFee = async (jokiName: string, newFee: number) => {
    if (!user) return;
    setActionLoading(true);

    try {
      const res = await fetch("/api/fee-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          joki_name: jokiName,
          fee_amount: newFee,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setFeeRules((prev) =>
          prev.map((r) =>
            r.joki_name === jokiName ? { ...r, fee_amount: newFee } : r
          )
        );
        setEditingFee(null);
      } else {
        alert(data.message || "Gagal update fee");
      }
    } catch (err) {
      console.error(err);
      alert("Error update fee");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (jokiName: string, isActive: boolean) => {
    if (!user) return;
    setActionLoading(true);

    try {
      const res = await fetch("/api/fee-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          joki_name: jokiName,
          is_active: !isActive,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setFeeRules((prev) =>
          prev.map((r) =>
            r.joki_name === jokiName ? { ...r, is_active: !isActive } : r
          )
        );
      } else {
        alert(data.message || "Gagal toggle");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddJoki = async () => {
    if (!user || !newJokiName.trim()) return;
    setActionLoading(true);

    try {
      const res = await fetch("/api/fee-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          joki_name: newJokiName.trim().toLowerCase(),
          fee_amount: newFeeAmount,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setFeeRules((prev) => [...prev, data.data]);
        setNewJokiName("");
        setNewFeeAmount(500);
        setShowAddForm(false);
      } else {
        alert(data.message || "Gagal tambah joki");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteJoki = async (jokiName: string) => {
    if (!user) return;
    if (!confirm(`Hapus fee rule untuk "${jokiName}"?`)) return;
    setActionLoading(true);

    try {
      const res = await fetch(
        `/api/fee-rules?username=${user.username}&joki_name=${jokiName}`,
        { method: "DELETE" }
      );
      const data = await res.json();

      if (data.success) {
        setFeeRules((prev) => prev.filter((r) => r.joki_name !== jokiName));
      } else {
        alert(data.message || "Gagal hapus");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════
  // FILTER LOGIC
  // ══════════════════════════════════════════════════════
  const filteredDetail = useMemo(() => {
    return detail.filter((row) => {
      if (filterJoki !== "all" && row.joki_name.toLowerCase() !== filterJoki) {
        return false;
      }
      if (searchOrderId && !row.order_id.toLowerCase().includes(searchOrderId.toLowerCase())) {
        return false;
      }
      if (filterDateFrom) {
        const rowDate = new Date(row.created_at).toISOString().split("T")[0];
        if (rowDate < filterDateFrom) return false;
      }
      if (filterDateTo) {
        const rowDate = new Date(row.created_at).toISOString().split("T")[0];
        if (rowDate > filterDateTo) return false;
      }
      return true;
    });
  }, [detail, filterJoki, filterDateFrom, filterDateTo, searchOrderId]);

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

  const jokiList = useMemo(() => {
    const set = new Set(detail.map((d) => d.joki_name.toLowerCase()));
    return Array.from(set);
  }, [detail]);

  // ══════════════════════════════════════════════════════
  // GUARD
  // ══════════════════════════════════════════════════════
  if (!loading && user?.username !== "ellan") {
    return (
      <>
        <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleSidebar}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition"
            >
              <i className={`fa-solid ${sidebarOpen ? "fa-bars-staggered" : "fa-bars"} text-base`}></i>
            </button>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-500/20">
              <i className="fa-solid fa-lock text-2xl"></i>
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Akses Ditolak
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Halaman ini cuma buat owner
            </p>
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleSidebar}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition"
            >
              <i className={`fa-solid ${sidebarOpen ? "fa-bars-staggered" : "fa-bars"} text-base`}></i>
            </button>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-emerald-600"></i>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  return (
    <>
      {/* HEADER */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleSidebar}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
            title={sidebarOpen ? "Tutup Sidebar" : "Buka Sidebar"}
          >
            <i className={`fa-solid ${sidebarOpen ? "fa-bars-staggered" : "fa-bars"} text-base`}></i>
          </button>

          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-emerald-600 via-green-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
            <i className="fa-solid fa-money-bill-trend-up text-base"></i>
          </div>

          <div>
            <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Laporan Fee
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Data rahasia — cuma owner yang bisa akses
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
            <i className="fa-solid fa-shield-halved text-[10px]"></i>
            Owner Only
          </span>
        </div>
      </header>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8 space-y-6">

        {/* ═══════════════════════════════════════════════════ */}
        {/* SUMMARY CARDS */}
        {/* ═══════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-400/50 transition-all">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-slate-500/10 rounded-full blur-xl"></div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Gross
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  Rp {filteredTotals.gross.toLocaleString("id-ID")}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {filteredTotals.orders} order
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                <i className="fa-solid fa-chart-line text-base"></i>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-400/50 transition-all">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl"></div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Fee Kamu
                </p>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                  Rp {filteredTotals.fee.toLocaleString("id-ID")}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                  Total fee kekumpul
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30 shrink-0">
                <i className="fa-solid fa-coins text-base"></i>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-violet-400/50 transition-all">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-violet-500/10 rounded-full blur-xl"></div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Net
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  Rp {filteredTotals.net.toLocaleString("id-ID")}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Yang diterima joki
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-500/20 shrink-0">
                <i className="fa-solid fa-wallet text-base"></i>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* PENGATURAN FEE */}
        {/* ═══════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-sliders text-emerald-600"></i>
              Pengaturan Fee
            </h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm shadow-emerald-600/20"
            >
              <i className="fa-solid fa-plus text-[10px]"></i>
              Tambah Joki
            </button>
          </div>

          {/* Form tambah joki */}
          {showAddForm && (
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Nama joki (misal: budi)"
                  value={newJokiName}
                  onChange={(e) => setNewJokiName(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="number"
                  placeholder="Fee (Rp)"
                  value={newFeeAmount}
                  onChange={(e) => setNewFeeAmount(parseInt(e.target.value) || 0)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddJoki}
                    disabled={actionLoading || !newJokiName.trim()}
                    className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition"
                  >
                    {actionLoading ? (
                      <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                      "Simpan"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewJokiName("");
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* List fee rules */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {feeRules.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-sm">
                Belum ada fee rules
              </div>
            )}
            {feeRules.map((rule) => {
              const isEllan = rule.joki_name.toLowerCase() === "ellan";
              const isEditing = editingFee === rule.joki_name;

              return (
                <div
                  key={rule.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        rule.is_active
                          ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <i className="fa-solid fa-user-tie text-sm"></i>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-white capitalize">
                          {rule.joki_name}
                        </span>
                        {isEllan && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                            OWNER
                          </span>
                        )}
                        {!rule.is_active && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            NONAKTIF
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {isEllan ? "Nggak kena fee" : "Fee per order"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isEditing ? (
                      <>
                        <input
                          type="number"
                          value={editFeeValue}
                          onChange={(e) => setEditFeeValue(parseInt(e.target.value) || 0)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdateFee(rule.joki_name, editFeeValue);
                            if (e.key === "Escape") setEditingFee(null);
                          }}
                          className="w-24 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-emerald-500 text-xs font-mono font-bold focus:outline-none"
                        />
                        <button
                          onClick={() => handleUpdateFee(rule.joki_name, editFeeValue)}
                          disabled={actionLoading}
                          className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition"
                        >
                          <i className="fa-solid fa-check text-[10px]"></i>
                        </button>
                        <button
                          onClick={() => setEditingFee(null)}
                          className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center transition"
                        >
                          <i className="fa-solid fa-xmark text-[10px]"></i>
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                          Rp {rule.fee_amount.toLocaleString("id-ID")}
                        </span>

                        <button
                          onClick={() => {
                            setEditingFee(rule.joki_name);
                            setEditFeeValue(rule.fee_amount);
                          }}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center transition"
                          title="Edit fee"
                        >
                          <i className="fa-solid fa-pen text-[10px]"></i>
                        </button>

                        {!isEllan && (
                          <>
                            <button
                              onClick={() => handleToggleActive(rule.joki_name, rule.is_active)}
                              disabled={actionLoading}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                                rule.is_active
                                  ? "bg-amber-100 dark:bg-amber-500/10 hover:bg-amber-200 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                  : "bg-emerald-100 dark:bg-emerald-500/10 hover:bg-emerald-200 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              }`}
                              title={rule.is_active ? "Nonaktifkan" : "Aktifkan"}
                            >
                              <i className={`fa-solid ${rule.is_active ? "fa-toggle-on" : "fa-toggle-off"} text-xs`}></i>
                            </button>

                            <button
                              onClick={() => handleDeleteJoki(rule.joki_name)}
                              disabled={actionLoading}
                              className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center transition"
                              title="Hapus"
                            >
                              <i className="fa-regular fa-trash-can text-[10px]"></i>
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* BREAKDOWN PER JOKI */}
        {/* ═══════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-chart-pie text-violet-600"></i>
              Breakdown per Joki
            </h3>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full font-bold">
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

        {/* ═══════════════════════════════════════════════════ */}
        {/* FILTER BAR */}
        {/* ═══════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <i className="fa-solid fa-filter text-slate-400 text-xs"></i>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Filter Detail
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                placeholder="Cari Order ID..."
                value={searchOrderId}
                onChange={(e) => setSearchOrderId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={filterJoki}
              onChange={(e) => setFilterJoki(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Semua Joki</option>
              {jokiList.map((j) => (
                <option key={j} value={j} className="capitalize">
                  {j}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:border-emerald-500"
            />

            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

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
              className="mt-3 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition"
            >
              <i className="fa-solid fa-xmark"></i>
              Reset Filter
            </button>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* DETAIL PER ORDER */}
        {/* ═══════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-list text-amber-600"></i>
              Detail per Order
            </h3>
            <span className="text-[10px] bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full font-bold">
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
    </>
  );
}