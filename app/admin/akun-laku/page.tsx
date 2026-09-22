"use client";

import { useEffect, useState } from "react";
import { useSidebar } from "../SidebarContext";
import { useToast } from "@/app/components/ToastProvider";
import { SkeletonList } from "@/app/components/Skeleton";

type StockAccount = {
  id: number;
  username: string;
  password: string | null;
  roblox_cookie: string | null;
  kategori: string | null;
  added_by: string | null;
  status: string;
  used: boolean;
  logged_out: boolean;
  logged_out_at: string | null;
  created_at: string;
  used_at: string | null;
  listed_at: string | null;
};

export default function AkunLakuPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<StockAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const { sidebarOpen, toggleSidebar } = useSidebar();
  const [searchQuery, setSearchQuery] = useState("");

  // ══════════════════════════════════════════════════════
  // LOAD DATA — cuma akun yang logged_out = true
  // ══════════════════════════════════════════════════════
  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts/stock?logged_out=true");
      const data = await res.json();
      if (data.success) setAccounts(data.data || []);
    } catch (err) {
      toast.error("Gagal load akun laku");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ══════════════════════════════════════════════════════
  // GROUP ACCOUNTS BY KATEGORI + FILTER SEARCH
  // ══════════════════════════════════════════════════════
  const groupedAccounts = (() => {
  const filtered = accounts.filter((acc) =>
    acc.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groups: Record<string, StockAccount[]> = {};
  filtered.forEach((acc) => {
    const kat = acc.kategori || "tanpa-kategori";
    if (!groups[kat]) groups[kat] = [];
    groups[kat].push(acc);
  });

  // ★ Sort NUMERIK: ambil angka awal dari nama kategori
  return Object.entries(groups)
    .map(([kategori, accounts]) => ({ kategori, accounts }))
    .sort((a, b) => {
      // Ambil angka awal: "10b-15b/s" → 10, "1b-5b/s" → 1
      const numA = parseInt(a.kategori.match(/^\d+/)?.[0] || "999999", 10);
      const numB = parseInt(b.kategori.match(/^\d+/)?.[0] || "999999", 10);

      // Kalau angka beda → sort by angka
      if (numA !== numB) return numA - numB;

      // Kalau angka sama → sort alfabetis (fallback)
      return a.kategori.localeCompare(b.kategori);
    });
})();

  return (
    <>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { display: none; }
        .custom-scrollbar { scrollbar-width: none; }
      `}</style>

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

          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
            <i className="fa-solid fa-circle-check text-base"></i>
          </div>

          <div>
            <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Akun Laku
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Riwayat akun yang sudah terjual
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Summary Card */}
          <div className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-check-double text-xs"></i>
                  <span>Total Akun Laku</span>
                </p>
                <h3 className="text-3xl md:text-4xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {accounts.length}
                </h3>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20">
                <i className="fa-solid fa-trophy text-2xl"></i>
              </div>
            </div>
          </div>

          {/* List Akun Laku */}
          <div className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* Header + Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-table text-emerald-600 dark:text-emerald-400"></i>
                <span>Daftar Akun Laku ({accounts.length})</span>
              </h2>
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari username..."
                  className="w-full md:w-56 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {loading ? (
              <SkeletonList count={5} />
            ) : accounts.length === 0 ? (
              <div className="text-center py-8">
                <i className="fa-solid fa-inbox text-4xl text-slate-300 dark:text-slate-700 mb-3"></i>
                <p className="text-slate-500 text-sm">Belum ada akun yang laku</p>
                <p className="text-slate-400 text-xs mt-1">
                  Akun yang terjual akan muncul di sini
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {groupedAccounts.map((group) => (
                  <div key={group.kategori}>
                    {/* Group Header */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
                          <i className="fa-solid fa-tag text-xs"></i>
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm capitalize">
                            {group.kategori}
                          </h3>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {group.accounts.length} akun terjual
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-lg">
                        {group.accounts.length} SOLD
                      </span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-sm table-fixed">
                        <thead className="bg-slate-50 dark:bg-slate-950/50">
                          <tr className="text-left text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">
                            <th className="px-3 py-2.5 w-[5%] text-center">#</th>
                            <th className="px-3 py-2.5 w-[28%]">Username</th>
                            <th className="px-3 py-2.5 w-[15%] hidden md:table-cell">Added By</th>
                            <th className="px-3 py-2.5 w-[18%] hidden lg:table-cell">Created</th>
                            <th className="px-3 py-2.5 w-[24%]">Tanggal Laku</th>
                            <th className="px-3 py-2.5 w-[10%] text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.accounts.map((acc, idx) => (
                            <tr
                              key={acc.id}
                              className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition"
                            >
                              <td className="px-3 py-2.5 w-[5%] text-xs text-slate-400 font-mono text-center">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2.5 w-[28%]">
                                <span
                                  className="font-mono font-bold text-xs text-slate-900 dark:text-white truncate block"
                                  title={acc.username}
                                >
                                  {acc.username}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 w-[15%] hidden md:table-cell">
                                <span className="text-xs text-slate-600 dark:text-slate-300 truncate block">
                                  {acc.added_by || "—"}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 w-[18%] hidden lg:table-cell">
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                  {formatDate(acc.created_at)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 w-[24%]">
                                <div className="flex items-center gap-1.5">
                                  <i className="fa-solid fa-calendar-check text-emerald-500 text-[10px]"></i>
                                  <span className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                    {formatDateTime(acc.logged_out_at)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 w-[10%] text-right">
                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-md inline-flex items-center gap-1 whitespace-nowrap">
                                  <i className="fa-solid fa-check text-[9px]"></i>
                                  SOLD
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}