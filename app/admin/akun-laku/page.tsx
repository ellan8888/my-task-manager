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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
            <h2 className="font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-list text-emerald-600 dark:text-emerald-400"></i>
              <span>Daftar Akun Laku ({accounts.length})</span>
            </h2>

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
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-mono font-bold text-sm truncate text-slate-900 dark:text-white">
                          {acc.username}
                        </p>
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded flex items-center gap-1">
                          <i className="fa-solid fa-check text-[9px]"></i>
                          SOLD
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 flex-wrap">
                        <i className="fa-solid fa-tag text-[10px]"></i>
                        <span>{acc.kategori}</span>
                        <span className="opacity-50">•</span>
                        <i className="fa-solid fa-user text-[10px]"></i>
                        <span>{acc.added_by}</span>
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                        <i className="fa-solid fa-calendar text-[10px]"></i>
                        <span>Laku: {formatDate(acc.logged_out_at)}</span>
                      </p>
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