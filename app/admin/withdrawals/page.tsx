"use client";

import { useEffect, useState } from "react";
import WithdrawFormModal from "@/app/components/WithdrawFormModal";
import ApproveModal from "@/app/components/ApproveModal";
import AddBankModal from "@/app/components/AddBankModal";

import AdminHeader from "@/app/components/AdminHeader";
import { useToast } from "@/app/components/ToastProvider";
import { useConfirmAsync } from "@/app/components/ConfirmDialog";
type HistoryFilter = "all" | "pending" | "approved" | "rejected";

const HISTORY_TABS: { key: HistoryFilter; label: string; dot: string }[] = [
  { key: "all", label: "Semua", dot: "" },
  { key: "pending", label: "Menunggu", dot: "bg-amber-500" },
  { key: "approved", label: "Disetujui", dot: "bg-emerald-500" },
  { key: "rejected", label: "Ditolak", dot: "bg-rose-500" },
];

function HistoryTabs({
  value,
  onChange,
  counts,
}: {
  value: HistoryFilter;
  onChange: (v: HistoryFilter) => void;
  counts: Record<HistoryFilter, number>;
}) {
  return (
    <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex gap-1.5 overflow-x-auto scrollbar-hide">
      {HISTORY_TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
            value === t.key
              ? "bg-violet-600 text-white shadow-sm"
              : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          {t.dot && <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>}
          {t.label}
          <span className={`text-[10px] ${value === t.key ? "text-violet-200" : "text-slate-400"}`}>{counts[t.key]}</span>
        </button>
      ))}
    </div>
  );
}

/** Thumbnail bukti transfer — klik untuk buka modal bukti yang sudah ada */
function ProofThumb({ url, onOpen }: { url: string; onOpen: (url: string) => void }) {
  return (
    <button
      onClick={() => onOpen(url)}
      className="mt-1.5 inline-flex items-center gap-2 p-1 pr-2.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 hover:border-emerald-400 transition group"
      title="Lihat bukti pembayaran"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Bukti pembayaran" className="w-9 h-9 rounded-md object-cover bg-white" loading="lazy" />
      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
        <i className="fa-solid fa-receipt"></i>
        Bukti transfer
        <i className="fa-solid fa-up-right-and-down-left-from-center text-[8px] opacity-60 group-hover:opacity-100"></i>
      </span>
    </button>
  );
}

export default function WithdrawalsPage() {
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirmAsync();

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

  const [withdrawals, setWithdrawals] = useState<any[]>([]); // withdraw beneran
  const [purchases, setPurchases] = useState<any[]>([]);         // belanja code
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [approveModal, setApproveModal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [showBankModal, setShowBankModal] = useState(false);
  const [proofModal, setProofModal] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.user) setCurrentUser(data.user);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.role === "superadmin") return;

    const fetchBanks = async () => {
      try {
        const res = await fetch("/api/bank-accounts");
        const data = await res.json();
        if (data.success) setBankAccounts(data.data || []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchBanks();
    const interval = setInterval(fetchBanks, 60000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const reloadBanks = async () => {
    try {
      const res = await fetch("/api/bank-accounts");
      const data = await res.json();
      if (data.success) setBankAccounts(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

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

        const allRows = withdrawData.data || [];

        // ⭐ Pisahin: withdraw beneran vs belanja code
        const isPurchase = (w: any) => (w.note || "").startsWith("[BELI CODE]");

        const withdrawRows = allRows.filter((w: any) => !isPurchase(w));
        const purchaseRows = allRows.filter((w: any) => isPurchase(w));

        // Total withdraw beneran (cuma dari row non-purchase)
        const totalWithdrawn = withdrawRows
          .filter((w: any) => w.status === "approved" || w.status === "pending")
          .reduce((s: number, w: any) => s + (w.amount || 0), 0);

        // Total belanja code (dari row purchase)
        const totalPurchases = purchaseRows
          .filter((w: any) => w.status === "approved" || w.status === "pending")
          .reduce((s: number, w: any) => s + (w.amount || 0), 0);

        setMyBalance({
          totalIncome,
          totalWithdrawn,
          sisa: totalIncome - totalWithdrawn - totalPurchases, // ⭐ sisa = income - ditarik - belanja
        });

        setWithdrawals(withdrawRows);
        setPurchases(purchaseRows);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "superadmin") return;

    const fetchPending = async () => {
      try {
        const [pendingRes, allRes] = await Promise.all([
          fetch("/api/withdrawals?status=pending"),
          fetch("/api/withdrawals"),
        ]);

        const pendingData = await pendingRes.json();
        const allData = await allRes.json();

        if (pendingData.success)
          setPendingRequests(
            (pendingData.data || []).filter(
              (w: any) => !(w.note || "").startsWith("[BELI CODE]")
            )
          );
        if (allData.success)
          setWithdrawals(
            (allData.data || []).filter(
              (w: any) => !(w.note || "").startsWith("[BELI CODE]")
            )
          );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const formatRupiah = (num: number) => "Rp " + num.toLocaleString("id-ID");

  // ⭐ Tab status — hanya menyaring tampilan dari data yang sudah dimuat
  const historyCounts: Record<HistoryFilter, number> = {
    all: withdrawals.length,
    pending: withdrawals.filter((w) => w.status === "pending").length,
    approved: withdrawals.filter((w) => w.status === "approved").length,
    rejected: withdrawals.filter((w) => w.status === "rejected").length,
  };
  const filteredHistory =
    historyFilter === "all" ? withdrawals : withdrawals.filter((w) => w.status === historyFilter);
    // ⭐ Helper: filter belanja code dari list withdrawals
  const isPurchaseCode = (w: any) =>
    (w.note || "").startsWith("[BELI CODE]");

  const filterDisplayable = (list: any[]) =>
    list.filter((w) => !isPurchaseCode(w));

  return (
    <>
      {/* Header */}
      <AdminHeader
        icon="fa-wallet"
        iconClassName="from-emerald-600 via-green-600 to-teal-500 shadow-emerald-600/30"
        title="Penarikan Pendapatan"
        subtitle={<>{currentUser?.role === "superadmin" ? "Review & approve request penarikan" : "Ajukan penarikan pendapatan kamu"}</>}
      />

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <i className="fa-solid fa-spinner fa-spin text-3xl text-violet-600"></i>
              <p className="text-sm text-slate-500 mt-3">Memuat data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* ═══════════ USER BIASA ═══════════ */}
            {currentUser?.role !== "superadmin" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* LEFT COLUMN (2/3) */}
                <div className="lg:col-span-2 space-y-5">
                  {/* ⭐ SUMMARY — 3 kartu sejajar (ganti hero) */}
                  {myBalance && (
                    <div className="grid grid-cols-3 gap-3">
                      {/* Total */}
                      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                            <i className="fa-solid fa-chart-line text-xs"></i>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Total
                          </span>
                        </div>
                        <p className="text-base md:text-lg font-black text-slate-900 dark:text-white truncate">
                          {formatRupiah(myBalance.totalIncome)}
                        </p>
                      </div>

                      {/* Ditarik */}
                      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                            <i className="fa-solid fa-arrow-up-from-bracket text-xs"></i>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Ditarik
                          </span>
                        </div>
                        <p className="text-base md:text-lg font-black text-rose-600 dark:text-rose-400 truncate">
                          {formatRupiah(myBalance.totalWithdrawn)}
                        </p>
                      </div>

                      {/* Sisa */}
                      <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <i className="fa-solid fa-wallet text-xs"></i>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                            Sisa
                          </span>
                        </div>
                        <p className="text-base md:text-lg font-black text-emerald-700 dark:text-emerald-400 truncate">
                          {formatRupiah(myBalance.sisa)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ⭐ TARIK BUTTON — Full width */}
                  {myBalance && (
                    <button
  onClick={() => setShowWithdrawModal(true)}
  disabled={myBalance.sisa <= 0 || bankAccounts.length === 0}
  className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:border-slate-200 dark:disabled:border-slate-800 disabled:cursor-not-allowed text-emerald-700 dark:text-emerald-300 disabled:text-slate-400 px-5 py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2"
>
  <i className="fa-solid fa-money-bill-transfer"></i>
  <span>
    {bankAccounts.length === 0
      ? "Tambah Rekening Dulu"
      : myBalance.sisa <= 0
      ? "Saldo Kosong"
      : "Tarik Sekarang"}
  </span>
</button>
                  )}

                  {/* ⭐ HISTORY */}
                  <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                          <i className="fa-solid fa-clock-rotate-left text-xs"></i>
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                          History Penarikan
                        </h3>
                      </div>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                        {withdrawals.length}
                      </span>
                    </div>

                    <HistoryTabs value={historyFilter} onChange={setHistoryFilter} counts={historyCounts} />

                    {filteredHistory.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                          <i className="fa-solid fa-inbox text-lg"></i>
                        </div>
                        <p className="text-sm font-semibold text-slate-500">
                          {historyFilter === "all" ? "Belum ada penarikan" : "Tidak ada penarikan dengan status ini"}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredHistory.map((w) => (
                          <div
                            key={w.id}
                            className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                  w.status === "approved"
                                    ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                                    : w.status === "rejected"
                                    ? "bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20"
                                    : "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                                }`}
                              >
                                {w.status === "approved" && <i className="fa-solid fa-check text-[10px]"></i>}
                                {w.status === "rejected" && <i className="fa-solid fa-xmark text-[10px]"></i>}
                                {w.status === "pending" && <i className="fa-solid fa-hourglass-half text-[10px]"></i>}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {w.status === "approved"
                                      ? "Disetujui"
                                      : w.status === "rejected"
                                      ? "Ditolak"
                                      : "Menunggu"}
                                  </span>
                                  {w.bank_name && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                      • {w.bank_name}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                  {new Date(w.requested_at).toLocaleString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>

                                {/* ⭐ BUKTI PEMBAYARAN — cuma muncul kalau approved & ada URL */}
                                {w.status === "approved" && w.payment_proof_url && (
                                  <ProofThumb url={w.payment_proof_url} onOpen={setProofModal} />
                                )}
                              </div>
                            </div>

                            <p className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono shrink-0">
                              -{formatRupiah(w.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                                        )}
                  </div>

                  {/* ⭐ PENGELUARAN — SECTION BARU */}
                  <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                          <i className="fa-solid fa-ticket text-xs"></i>
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                          Pengeluaran (Beli Code)
                        </h3>
                      </div>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                        {purchases.length}
                      </span>
                    </div>

                    {purchases.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                          <i className="fa-solid fa-ticket text-lg"></i>
                        </div>
                        <p className="text-sm font-semibold text-slate-500">
                          Belum ada beli code
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {purchases.map((w) => (
                          <div
                            key={w.id}
                            className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 border border-violet-200 dark:border-violet-500/20">
                                <i className="fa-solid fa-ticket text-[10px]"></i>
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    Beli Code
                                  </span>
                                  <span className="text-[10px] font-mono text-violet-600 dark:text-violet-400 truncate">
                                    • {(w.note || "").replace("[BELI CODE] ", "")}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                  {new Date(w.approved_at || w.requested_at).toLocaleString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>

                            <p className="text-sm font-black text-violet-600 dark:text-violet-400 font-mono shrink-0">
                              -{formatRupiah(w.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN (1/3) */}
                <div className="space-y-5">
                  {/* ⭐ REKENING */}
                  <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                          <i className="fa-solid fa-building-columns text-xs"></i>
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                          Rekening
                        </h3>
                      </div>
                      <button
                        onClick={() => setShowBankModal(true)}
                        className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition"
                      >
                        <i className="fa-solid fa-plus text-xs"></i>
                      </button>
                    </div>

                    {bankAccounts.length === 0 ? (
                      <div className="text-center py-10 px-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
                          <i className="fa-solid fa-building-columns text-base"></i>
                        </div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                          Belum ada rekening
                        </p>
                        <p className="text-[10px] text-slate-500 mb-3">
                          Tambah dulu buat bisa tarik
                        </p>
                        <button
                          onClick={() => setShowBankModal(true)}
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          + Tambah Rekening
                        </button>
                      </div>
                    ) : (
                      <div className="p-2.5 space-y-2">
                        {bankAccounts.map((bank) => (
                          <div
                            key={bank.id}
                            className={`rounded-lg p-3 border transition ${
                              bank.is_default
                                ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/30"
                                : "bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                  {bank.bank_name}
                                </p>
                                <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 truncate">
                                  {bank.account_number}
                                </p>
                                {bank.account_holder && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    a/n {bank.account_holder}
                                  </p>
                                )}
                              </div>
                              {bank.is_default && (
                                <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded shrink-0">
                                  DEFAULT
                                </span>
                              )}
                            </div>

                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(bank.account_number);
                                  toast.success("Nomor rekening dicopy");
                                }}
                                className="flex-1 py-1 rounded text-[10px] font-bold bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center gap-1"
                              >
                                <i className="fa-regular fa-copy text-[9px]"></i>
                                Copy
                              </button>
                              {!bank.is_default && (
                                <button
                                  onClick={async () => {
                                    await fetch("/api/bank-accounts", {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ id: bank.id, is_default: true }),
                                    });
                                    reloadBanks();
                                  }}
                                  className="flex-1 py-1 rounded text-[10px] font-bold bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center gap-1"
                                >
                                  <i className="fa-solid fa-star text-[9px]"></i>
                                  Set
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  if (
                                    !(await confirm({
                                      title: "Hapus rekening?",
                                      message: `Rekening ${bank.bank_name} akan dihapus.`,
                                      variant: "danger",
                                      confirmText: "Ya, hapus",
                                    }))
                                  )
                                    return;
                                  await fetch(`/api/bank-accounts?id=${bank.id}`, { method: "DELETE" });
                                  reloadBanks();
                                }}
                                className="w-7 py-1 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition flex items-center justify-center"
                              >
                                <i className="fa-regular fa-trash-can text-[9px]"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ⭐ INFO */}
                  <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center">
                        <i className="fa-solid fa-info-circle text-xs"></i>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Cara Tarik
                      </h4>
                    </div>
                    <ol className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                          1
                        </span>
                        <span>Tambah rekening dulu</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                          2
                        </span>
                        <span>Klik "Tarik Sekarang"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                          3
                        </span>
                        <span>Tunggu admin approve</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                          4
                        </span>
                        <span>Uang masuk ke rekening</span>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════ SUPERADMIN ═══════════ */}
            {currentUser?.role === "superadmin" && (
              <div className="space-y-5">
                {/* PENDING */}
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <i className="fa-solid fa-hourglass-half text-xs"></i>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        Request Pending
                      </h3>
                    </div>
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                      {pendingRequests.length}
                    </span>
                  </div>

                  {pendingRequests.length === 0 ? (
                    <div className="text-center py-14">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                        <i className="fa-solid fa-circle-check text-lg"></i>
                      </div>
                      <p className="text-sm font-semibold text-slate-500">
                        Semua beres — nggak ada pending
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pendingRequests.map((w) => (
                        <div
                          key={w.id}
                          className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                              <i className="fa-solid fa-user text-xs"></i>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-900 dark:text-white capitalize">
                                {w.joki_name}
                              </p>
                              {w.bank_name && w.account_number && (
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 truncate">
                                  {w.bank_name} • {w.account_number}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {new Date(w.requested_at).toLocaleString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <p className="text-sm font-black text-amber-700 dark:text-amber-400 font-mono">
                              {formatRupiah(w.amount)}
                            </p>
                            <button
                              onClick={() => setApproveModal(w)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-sm transition flex items-center gap-1"
                            >
                              <i className="fa-solid fa-clipboard-check text-[10px]"></i>
                              Review
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ALL HISTORY */}
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                        <i className="fa-solid fa-list text-xs"></i>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        Semua History
                      </h3>
                    </div>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                      {withdrawals.length}
                    </span>
                  </div>

                  <HistoryTabs value={historyFilter} onChange={setHistoryFilter} counts={historyCounts} />

                  {filteredHistory.length === 0 ? (
                    <div className="text-center py-14">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                        <i className="fa-solid fa-inbox text-lg"></i>
                      </div>
                      <p className="text-sm font-semibold text-slate-500">
                        {historyFilter === "all" ? "Belum ada penarikan" : "Tidak ada penarikan dengan status ini"}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredHistory.map((w) => (
                        <div
                          key={w.id}
                          className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                w.status === "approved"
                                  ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                                  : w.status === "rejected"
                                  ? "bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20"
                                  : "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                              }`}
                            >
                              {w.status === "approved" && <i className="fa-solid fa-check text-[10px]"></i>}
                              {w.status === "rejected" && <i className="fa-solid fa-xmark text-[10px]"></i>}
                              {w.status === "pending" && <i className="fa-solid fa-hourglass-half text-[10px]"></i>}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-900 dark:text-white capitalize">
                                {w.joki_name}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {w.bank_name && `${w.bank_name} • `}
                                {new Date(w.requested_at).toLocaleString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                })}
                                {w.approved_by && ` • by ${w.approved_by}`}
                              </p>

                              {/* ⭐ BUKTI PEMBAYARAN — buat superadmin juga */}
                              {w.status === "approved" && w.payment_proof_url && (
                                <ProofThumb url={w.payment_proof_url} onOpen={setProofModal} />
                              )}
                            </div>
                          </div>

                          <p className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono shrink-0">
                            -{formatRupiah(w.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Tarik */}
      {showWithdrawModal && myBalance && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <i className="fa-solid fa-money-bill-transfer text-base"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Request Tarik
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sisa: {formatRupiah(myBalance.sisa)}
                  </p>
                </div>
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

      {/* Modal Approve */}
      {approveModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <i className="fa-solid fa-clipboard-check text-base"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Review Request
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Approve atau reject penarikan
                  </p>
                </div>
              </div>
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

      {/* Modal Tambah Rekening */}
      {showBankModal && (
        <AddBankModal
          onClose={() => setShowBankModal(false)}
          onSuccess={async () => {
            setShowBankModal(false);
            reloadBanks();
          }}
        />
      )}
{/* ⭐ Modal Bukti Pembayaran */}
{proofModal && (
  <div
    className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
    onClick={() => setProofModal(null)}
  >
    <div
      className="relative max-w-2xl w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setProofModal(null)}
        className="absolute -top-12 right-0 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition"
      >
        <i className="fa-solid fa-xmark text-lg"></i>
      </button>

      <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <i className="fa-solid fa-receipt text-xs"></i>
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Bukti Pembayaran
          </h3>
        </div>
        <img
          src={proofModal}
          alt="Bukti Pembayaran"
          className="w-full h-auto max-h-[80vh] object-contain"
        />
      </div>
    </div>
  </div>
)}
      {confirmDialog}
    </>
  );
}