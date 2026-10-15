"use client";

import { useEffect, useRef, useState } from "react";
import { useSidebar } from "../SidebarContext";

type RedeemCode = {
  id: number;
  code: string;
  username: string | null;
  status: "available" | "used";
  payment_method: string | null;
  used_at: string | null;
  created_at: string;
};

type PendingPurchase = {
  id: number;
  username: string;
  amount: number;
  proof_url: string;
  notes: string | null;
  requested_at: string;
};

export default function RedeemPage() {
  const { sidebarOpen, toggleSidebar } = useSidebar();
  const [user, setUser] = useState<any>(null);
  const [sisa, setSisa] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [myCodes, setMyCodes] = useState<RedeemCode[]>([]);
  const [newCode, setNewCode] = useState("");
  const [stockCount, setStockCount] = useState(0);
  const [addingStock, setAddingStock] = useState(false);
  const [pendingList, setPendingList] = useState<PendingPurchase[]>([]);
  const [proofModal, setProofModal] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = user?.username?.toLowerCase() === "ellan";

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => d.success && d.user && setUser(d.user));
  }, []);

  const fetchAll = async () => {
    if (!user) return;
    try {
      const [inc, wd] = await Promise.all([
        fetch("/api/stats/income/me").then((r) => r.json()),
        fetch("/api/withdrawals").then((r) => r.json()),
      ]);
      const totalIncome = inc.total || 0;
      const totalWithdrawn =
        (wd.totals?.[user.username] || 0) + (wd.pendingTotals?.[user.username] || 0);
      setSisa(totalIncome - totalWithdrawn);

      const codesRes = await fetch(`/api/redeem/my-codes?username=${user.username}`);
      const codesData = await codesRes.json();
      if (codesData.success) setMyCodes(codesData.data || []);

      if (isOwner) {
        const [stockRes, pendingRes] = await Promise.all([
          fetch(`/api/admin/redeem/stock?username=${user.username}`),
          fetch(`/api/admin/redeem/pending?username=${user.username}`),
        ]);
        const stockData = await stockRes.json();
        const pendingData = await pendingRes.json();
        if (stockData.success) setStockCount(stockData.data.length);
        if (pendingData.success) setPendingList(pendingData.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAll();
      const interval = setInterval(fetchAll, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const formatRupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setToast({ type: "error", msg: "File harus gambar (JPG/PNG)" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setToast({ type: "error", msg: "Maksimal 5 MB" });
      return;
    }

    setProofFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleBuyBalance = async () => {
    const msg = isOwner
      ? "Ambil 1 code gratis sebagai owner?"
      : "Beli 1 code pake saldo Rp 20.000?";
    if (!confirm(msg)) return;
    setBuying(true);
    try {
      const res = await fetch("/api/redeem/purchase-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", msg: `Code: ${data.data.code}` });
        fetchAll();
      } else {
        setToast({ type: "error", msg: data.message });
      }
    } catch {
      setToast({ type: "error", msg: "Error, coba lagi" });
    } finally {
      setBuying(false);
    }
  };

  const handleSubmitTransfer = async () => {
    if (!proofFile) {
      setToast({ type: "error", msg: "Pilih foto bukti transfer" });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", proofFile);
      formData.append("username", user.username);

      const uploadRes = await fetch("/api/upload/redeem-proof", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        setToast({ type: "error", msg: uploadData.message });
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/redeem/request-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          proof_url: uploadData.url,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setToast({ type: "success", msg: "Request terkirim. Tunggu admin verify." });
        setShowTransferModal(false);
        setProofFile(null);
        setProofPreview(null);
        setNotes("");
      } else {
        setToast({ type: "error", msg: data.message });
      }
    } catch {
      setToast({ type: "error", msg: "Error, coba lagi" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStock = async () => {
    if (!newCode.trim()) {
      setToast({ type: "error", msg: "Isi code-nya" });
      return;
    }
    setAddingStock(true);
    try {
      const res = await fetch("/api/admin/redeem/add-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          code: newCode.trim(),
          target_username: null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", msg: `Code ${data.data.code} masuk stock` });
        setNewCode("");
        fetchAll();
      } else {
        setToast({ type: "error", msg: data.message });
      }
    } catch {
      setToast({ type: "error", msg: "Error, coba lagi" });
    } finally {
      setAddingStock(false);
    }
  };

  const handleVerify = async (purchaseId: number, action: "approve" | "reject") => {
    if (!confirm(action === "approve" ? "Approve & assign code random?" : "Reject?")) return;
    setVerifyingId(purchaseId);
    try {
      const res = await fetch("/api/admin/redeem/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          purchase_id: purchaseId,
          action,
          reject_reason: action === "reject" ? "Bukti nggak valid" : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({
          type: "success",
          msg:
            action === "approve"
              ? `Approved! Code: ${data.data?.assigned_code}`
              : "Pembelian di-reject",
        });
        fetchAll();
      } else {
        setToast({ type: "error", msg: data.message });
      }
    } catch {
      setToast({ type: "error", msg: "Error, coba lagi" });
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <>
      {/* HEADER — sama kayak withdrawals */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleSidebar}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
          >
            <i className={`fa-solid ${sidebarOpen ? "fa-bars-staggered" : "fa-bars"} text-base`}></i>
          </button>

          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-violet-600/30">
            <i className="fa-solid fa-ticket text-base"></i>
          </div>

          <div>
            <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Redeem Code
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Beli code & lihat hasilnya
            </p>
          </div>
        </div>

        {isOwner && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-100 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-400 text-xs font-bold">
            <i className="fa-solid fa-crown text-[10px]"></i>
            Owner Mode
          </span>
        )}
      </header>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <i className="fa-solid fa-spinner fa-spin text-3xl text-violet-600"></i>
              <p className="text-sm text-slate-500 mt-3">Memuat data...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">

            {/* ═══════════ SECTION 1: SALDO & BELI ═══════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* LEFT (2/3): Saldo + Button */}
              <div className="lg:col-span-2 space-y-5">
                {/* ⭐ SUMMARY — 3 kartu sejajar */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Saldo */}
                  <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <i className="fa-solid fa-wallet text-xs"></i>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                        Saldo
                      </span>
                    </div>
                    <p className="text-base md:text-lg font-black text-emerald-700 dark:text-emerald-400 truncate">
                      {formatRupiah(sisa)}
                    </p>
                  </div>

                  {/* Harga */}
                  <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                        <i className="fa-solid fa-tag text-xs"></i>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Harga
                      </span>
                    </div>
                    <p className="text-base md:text-lg font-black text-slate-900 dark:text-white truncate">
                      {formatRupiah(20000)}
                    </p>
                  </div>

                  {/* Stock */}
                  <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <i className="fa-solid fa-boxes-stacked text-xs"></i>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Stock
                      </span>
                    </div>
                    <p className="text-base md:text-lg font-black text-slate-900 dark:text-white truncate">
                      {stockCount} code
                    </p>
                  </div>
                </div>

                {/* ⭐ TOMBOL BELI — 2 kolom */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  <button
    onClick={handleBuyBalance}
    disabled={buying || (!isOwner && sisa < 20000)}
    className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:border-slate-200 dark:disabled:border-slate-800 disabled:cursor-not-allowed text-emerald-700 dark:text-emerald-300 disabled:text-slate-400 px-5 py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2"
  >
    {buying ? (
      <i className="fa-solid fa-spinner fa-spin"></i>
    ) : isOwner ? (
      <>
        <i className="fa-solid fa-crown"></i>
        Ambil Code (Gratis)
      </>
    ) : sisa < 20000 ? (
      "Saldo Kurang"
    ) : (
      <>
        <i className="fa-solid fa-cart-shopping"></i>
        Beli pake Saldo
      </>
    )}
  </button>

  <button
    onClick={() => setShowTransferModal(true)}
    className="w-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 text-blue-700 dark:text-blue-300 px-5 py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2"
  >
    <i className="fa-solid fa-building-columns"></i>
    Beli pake Transfer
  </button>
</div>
              </div>

              {/* RIGHT (1/3): Info singkat */}
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center">
                    <i className="fa-solid fa-info-circle text-xs"></i>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Cara Beli
                  </h4>
                </div>
                <ol className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                      1
                    </span>
                    <span>Pilih metode bayar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                      2
                    </span>
                    <span>Saldo: instant</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                      3
                    </span>
                    <span>Transfer: upload bukti</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                      4
                    </span>
                    <span>Cek di Kode Saya</span>
                  </li>
                </ol>
              </div>
            </div>

            {/* ═══════════ SECTION 2: KODE SAYA ═══════════ */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                    <i className="fa-solid fa-list-check text-xs"></i>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Kode Saya
                  </h3>
                </div>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                  {myCodes.length}
                </span>
              </div>

              {myCodes.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <i className="fa-solid fa-ticket text-lg"></i>
                  </div>
                  <p className="text-sm font-semibold text-slate-500">
                    Belum ada kode
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {myCodes.map((c) => (
                    <div
                      key={c.id}
                      className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                          <i className="fa-solid fa-ticket text-xs"></i>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold font-mono text-slate-900 dark:text-white truncate">
                            {c.code}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                            {c.payment_method === "balance" ? (
                              <span className="flex items-center gap-1">
                                <i className="fa-solid fa-coins text-emerald-500 text-[9px]"></i>
                                Saldo
                              </span>
                            ) : c.payment_method === "transfer" ? (
                              <span className="flex items-center gap-1">
                                <i className="fa-solid fa-building-columns text-blue-500 text-[9px]"></i>
                                Transfer
                              </span>
                            ) : c.payment_method === "free_admin" ? (
                              <span className="flex items-center gap-1">
                                <i className="fa-solid fa-crown text-violet-500 text-[9px]"></i>
                                Free Owner
                              </span>
                            ) : null}
                            {c.used_at && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <span>
                                  {new Date(c.used_at).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(c.code);
                          setToast({ type: "success", msg: "Code dicopy!" });
                        }}
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition shrink-0"
                        title="Copy code"
                      >
                        <i className="fa-regular fa-copy text-xs"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ═══════════ SECTION 3: KELOLA (OWNER ONLY) ═══════════ */}
            {isOwner && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Card 1: Tambah Stock */}
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                        <i className="fa-solid fa-gift text-xs"></i>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        Tambah Stock
                      </h3>
                    </div>
                    <span className="text-[10px] bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full font-bold">
                      {stockCount} code
                    </span>
                  </div>

                  <div className="p-4">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                      Kode Baru
                    </label>
                    <input
                      type="text"
                      placeholder="mis. DIAMOND-003"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && handleAddStock()}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono focus:outline-none focus:border-violet-500 mb-3"
                    />
                    <button
                      onClick={handleAddStock}
                      disabled={addingStock || !newCode.trim()}
                      className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:from-slate-300 disabled:to-slate-400 dark:disabled:from-slate-800 dark:disabled:to-slate-700 disabled:cursor-not-allowed text-white disabled:text-slate-500 dark:disabled:text-slate-500 px-5 py-3 rounded-xl font-bold text-sm shadow-sm transition flex items-center justify-center gap-2"
                    >
                      {addingStock ? (
                        <i className="fa-solid fa-spinner fa-spin"></i>
                      ) : (
                        <>
                          <i className="fa-solid fa-floppy-disk text-xs"></i>
                          Simpan ke Stock
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Card 2: Pending Transfer */}
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <i className="fa-solid fa-hourglass-half text-xs"></i>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        Pending Transfer
                      </h3>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      pendingList.length > 0
                        ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    }`}>
                      {pendingList.length}
                    </span>
                  </div>

                  <div className="p-4">
                    {pendingList.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                          <i className="fa-solid fa-circle-check text-lg"></i>
                        </div>
                        <p className="text-sm font-semibold text-slate-500">
                          Semua beres — nggak ada pending
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-hide">
                        {pendingList.map((p) => (
                          <div
                            key={p.id}
                            className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950/30"
                          >
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                  <i className="fa-solid fa-user text-xs"></i>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-900 dark:text-white capitalize">
                                    {p.username}
                                  </p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {new Date(p.requested_at).toLocaleString("id-ID", {
                                      day: "numeric",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                </div>
                              </div>
                              <p className="text-sm font-black text-amber-700 dark:text-amber-400 font-mono shrink-0">
                                {formatRupiah(p.amount)}
                              </p>
                            </div>

                            {p.notes && (
                              <p className="text-[10px] text-slate-400 italic mb-2">
                                "{p.notes}"
                              </p>
                            )}

                            <div className="flex gap-2">
                              <button
                                onClick={() => setProofModal(p.proof_url)}
                                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center gap-1"
                              >
                                <i className="fa-solid fa-receipt text-[9px]"></i>
                                Bukti
                              </button>
                              <button
                                onClick={() => handleVerify(p.id, "approve")}
                                disabled={verifyingId === p.id}
                                className="flex-1 py-1.5 rounded-lg bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 text-white text-[10px] font-bold transition flex items-center justify-center gap-1"
                              >
                                {verifyingId === p.id ? (
                                  <i className="fa-solid fa-spinner fa-spin"></i>
                                ) : (
                                  <>
                                    <i className="fa-solid fa-check text-[9px]"></i>
                                    Verify
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleVerify(p.id, "reject")}
                                disabled={verifyingId === p.id}
                                className="w-8 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 disabled:opacity-50 transition flex items-center justify-center"
                              >
                                <i className="fa-regular fa-trash-can text-[9px]"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* MODAL TRANSFER */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <i className="fa-solid fa-building-columns text-base"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Bukti Transfer
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Transfer Rp 20.000
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setProofFile(null);
                  setProofPreview(null);
                  setNotes("");
                }}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl p-3 mb-4 space-y-2">
  <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5 mb-2">
    <i className="fa-solid fa-info-circle text-[10px]"></i>
    Transfer ke:
  </p>

  {/* Bank + Rek (1 baris) */}
  <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-200/50 dark:border-blue-500/20">
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <i className="fa-solid fa-building-columns text-blue-600 dark:text-blue-400 text-xs shrink-0"></i>
      <div className="min-w-0">
        <p className="text-[9px] text-blue-600 dark:text-blue-400 font-bold uppercase">
          Sea Bank
        </p>
        <p className="text-sm font-mono font-black text-blue-900 dark:text-blue-200 truncate tracking-wide">
          901647793874
        </p>
      </div>
    </div>
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText("901647793874");
        setToast({ type: "success", msg: "Nomor rekening dicopy!" });
      }}
      className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shrink-0"
      title="Copy"
    >
      <i className="fa-regular fa-copy text-[10px]"></i>
    </button>
  </div>

  {/* Atas Nama — tanpa tombol copy */}
  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-200/50 dark:border-blue-500/20">
    <i className="fa-solid fa-user text-blue-600 dark:text-blue-400 text-xs shrink-0"></i>
    <p className="text-xs font-bold text-blue-900 dark:text-blue-200 truncate">
      Ellan Arya Al Qohary
    </p>
  </div>
</div>

<div className="mt-4">
  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
    Foto Bukti Transfer
  </label>

            {!proofPreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50 dark:bg-slate-950/30 transition flex flex-col items-center justify-center gap-2 mb-3"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <i className="fa-solid fa-cloud-arrow-up text-lg"></i>
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Pilih Foto
                </p>
                <p className="text-[10px] text-slate-500">
                  JPG, PNG • Max 5 MB
                </p>
              </button>
            ) : (
              <div className="relative mb-3">
                <img
                  src={proofPreview}
                  alt="Preview"
                  className="w-full h-48 object-contain rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={() => {
                    setProofFile(null);
                    setProofPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center"
                >
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <textarea
              placeholder="Catatan (opsional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 mb-4 text-sm focus:outline-none focus:border-blue-500"
              rows={3}
            />

            <div className="flex gap-2">
              <button
                onClick={handleSubmitTransfer}
                disabled={submitting || !proofFile}
                className="flex-1 bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-slate-300 disabled:to-slate-400 dark:disabled:from-slate-800 dark:disabled:to-slate-700 disabled:cursor-not-allowed text-white disabled:text-slate-500 dark:disabled:text-slate-500 px-5 py-3 rounded-xl font-bold shadow-sm transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane text-xs"></i>
                    Kirim
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setProofFile(null);
                  setProofPreview(null);
                  setNotes("");
                }}
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition"
              >
                Batal
              </button>
            </div>
            </div> 
          </div>
        </div>
      )}

      {/* MODAL PROOF */}
      {proofModal && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setProofModal(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
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
                  Bukti Transfer
                </h3>
              </div>
              <img
                src={proofModal}
                alt="Bukti"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-xl shadow-2xl text-white font-bold z-50 cursor-pointer max-w-sm flex items-center gap-2 ${
            toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
          }`}
          onClick={() => setToast(null)}
        >
          <i
            className={`fa-solid ${
              toast.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"
            }`}
          ></i>
          {toast.msg}
        </div>
      )}
    </>
  );
}