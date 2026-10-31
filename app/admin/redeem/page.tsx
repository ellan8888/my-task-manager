"use client";

import { useEffect, useRef, useState } from "react";

import AdminHeader from "@/app/components/AdminHeader";
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

// ⭐ Tipe buat confirm modal
type ConfirmState = {
  title: string;
  message: string;
  detail?: { label: string; value: string; highlight?: boolean }[];
  // ⭐ List opsional (buat preview kode bulk)
  list?: {
    title: string;
    items: string[];
    emptyText?: string;
  };
  confirmText: string;
  confirmColor: "emerald" | "rose" | "violet" | "blue";
  onConfirm: () => void;
} | null;

export default function RedeemPage() {

  const [user, setUser] = useState<any>(null);
  const [sisa, setSisa] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [myCodes, setMyCodes] = useState<RedeemCode[]>([]);
  const [newCodes, setNewCodes] = useState("");
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

  // ⭐ State buat confirm modal
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

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

      // ⭐ Fetch stock count buat SEMUA user (bukan cuma owner)
      const stockCountRes = await fetch("/api/redeem/stock-count");
      const stockCountData = await stockCountRes.json();
      if (stockCountData.success) setStockCount(stockCountData.count);

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

  // ⭐ Function buat actual beli pake saldo
  const doBuyBalance = async () => {
    setConfirmState(null);
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

  // ⭐ Buka confirm modal dulu, baru process
  const handleBuyBalance = () => {
    if (isOwner) {
      setConfirmState({
        title: "Ambil Code Gratis",
        message: "Sebagai owner, kamu bisa ambil 1 code dari stock tanpa bayar. Stok tetap berkurang.",
        detail: [
          { label: "Harga Normal", value: formatRupiah(20000) },
          { label: "Harga Kamu", value: "Gratis (Owner)", highlight: true },
          { label: "Stock Tersedia", value: `${stockCount} code` },
        ],
        confirmText: "Ambil Sekarang",
        confirmColor: "violet",
        onConfirm: doBuyBalance,
      });
    } else {
      setConfirmState({
        title: "Beli Code pake Saldo",
        message: "Saldo kamu bakal berkurang dan code langsung masuk ke Kode Saya.",
        detail: [
          { label: "Harga Code", value: formatRupiah(20000) },
          { label: "Saldo Sekarang", value: formatRupiah(sisa) },
          { label: "Sisa Setelah Beli", value: formatRupiah(sisa - 20000), highlight: true },
        ],
        confirmText: "Konfirmasi Beli",
        confirmColor: "emerald",
        onConfirm: doBuyBalance,
      });
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
  fetchAll();   // ⭐ refresh list "Pending Transfer" langsung
} else {
        setToast({ type: "error", msg: data.message });
      }
    } catch {
      setToast({ type: "error", msg: "Error, coba lagi" });
    } finally {
      setSubmitting(false);
    }
  };

  // ⭐ Function actual add stock
  const doAddStock = async () => {
  setConfirmState(null);
  setAddingStock(true);
  try {
    // ⭐ Parse: split per baris atau koma, trim, buang kosong, dedupe
    const codes = newCodes
      .split(/[\n,]/)               // split by newline atau koma
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length > 0);
    
    const uniqueCodes = Array.from(new Set(codes)); // hapus duplikat

    if (uniqueCodes.length === 0) {
      setToast({ type: "error", msg: "Nggak ada code valid" });
      setAddingStock(false);
      return;
    }

    const res = await fetch("/api/admin/redeem/add-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: user.username,
        codes: uniqueCodes,             // ⭐ kirim array
        target_username: null,
      }),
    });
    const data = await res.json();

    if (data.success) {
      const inserted = data.data?.inserted ?? uniqueCodes.length;
      const skipped = data.data?.skipped ?? 0;
      
      let msg = `${inserted} code masuk stock`;
      if (skipped > 0) msg += ` (${skipped} duplikat di-skip)`;
      
      setToast({ type: "success", msg });
      setNewCodes("");
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

  const handleAddStock = () => {
  const codes = newCodes
    .split(/[\n,]/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c.length > 0);

  const uniqueCodes = Array.from(new Set(codes));

  if (uniqueCodes.length === 0) {
    setToast({ type: "error", msg: "Isi minimal 1 code" });
    return;
  }

  setConfirmState({
    title: "Simpan Code ke Stock",
    message: `${uniqueCodes.length} code bakal masuk ke stock dan bisa dibeli user.`,
    detail: [
      { label: "Jumlah Code", value: `${uniqueCodes.length} code`, highlight: true },
      { label: "Harga Jual", value: formatRupiah(20000) + " / code" },
    ],
    // ⭐ List kode lengkap
    list: {
      title: "Preview Code",
      items: uniqueCodes,
      emptyText: "Belum ada code",
    },
    confirmText: `Simpan ${uniqueCodes.length} Code`,
    confirmColor: "violet",
    onConfirm: doAddStock,
  });
};

  // ⭐ Function actual verify
  const doVerify = async (purchaseId: number, action: "approve" | "reject") => {
    setConfirmState(null);
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

  const handleVerify = (purchaseId: number, action: "approve" | "reject") => {
    if (action === "approve") {
      setConfirmState({
        title: "Approve Pembelian",
        message: "Code random dari stock bakal otomatis di-assign ke user ini.",
        detail: [
          { label: "Aksi", value: "Approve", highlight: true },
          { label: "Stock Tersedia", value: `${stockCount} code` },
        ],
        confirmText: "Approve",
        confirmColor: "emerald",
        onConfirm: () => doVerify(purchaseId, action),
      });
    } else {
      setConfirmState({
        title: "Reject Pembelian",
        message: "Pembelian ini bakal di-reject dan user nggak dapet code.",
        detail: [{ label: "Aksi", value: "Reject", highlight: true }],
        confirmText: "Reject",
        confirmColor: "rose",
        onConfirm: () => doVerify(purchaseId, action),
      });
    }
  };

  return (
    <>
      {/* HEADER — sama kayak withdrawals */}
      <AdminHeader
        icon="fa-ticket"
        iconClassName="from-violet-600 via-indigo-600 to-purple-500 shadow-violet-600/30"
        title="Redeem Code"
        subtitle="Beli code & lihat hasilnya"
      >

        {isOwner && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-100 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-400 text-xs font-bold">
            <i className="fa-solid fa-crown text-[10px]"></i>
            Owner Mode
          </span>
        )}
      </AdminHeader>

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
              <div className="lg:col-span-2 space-y-5">
                <div className="grid grid-cols-3 gap-3">
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
  Kode Baru (1 per baris)
</label>
<textarea
  placeholder={"CODE-001\nCODE-002\nCODE-003"}
  value={newCodes}
  onChange={(e) => setNewCodes(e.target.value.toUpperCase())}
  rows={6}
  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono focus:outline-none focus:border-violet-500 mb-3 resize-none"
/>
<p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3">
  Bisa juga pakai koma: <span className="font-mono">CODE-001, CODE-002</span>
</p>
                    <button
  onClick={handleAddStock}
  disabled={addingStock || !newCodes.trim()}
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

      {/* ⭐ CONFIRM MODAL — ganti confirm() browser */}
      {confirmState && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-100 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full shadow-2xl overflow-hidden">
            {/* Header */}
            <div className={`px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-linear-to-br ${
              confirmState.confirmColor === "emerald" ? "from-emerald-50 to-green-50 dark:from-emerald-500/5 dark:to-green-500/5" :
              confirmState.confirmColor === "rose" ? "from-rose-50 to-red-50 dark:from-rose-500/5 dark:to-red-500/5" :
              confirmState.confirmColor === "blue" ? "from-blue-50 to-cyan-50 dark:from-blue-500/5 dark:to-cyan-500/5" :
              "from-violet-50 to-indigo-50 dark:from-violet-500/5 dark:to-indigo-500/5"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  confirmState.confirmColor === "emerald" ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                  confirmState.confirmColor === "rose" ? "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400" :
                  confirmState.confirmColor === "blue" ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" :
                  "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400"
                }`}>
                  <i className={`fa-solid ${
                    confirmState.confirmColor === "rose" ? "fa-triangle-exclamation" :
                    confirmState.confirmColor === "emerald" ? "fa-circle-check" :
                    confirmState.confirmColor === "blue" ? "fa-circle-info" :
                    "fa-circle-question"
                  } text-base`}></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {confirmState.title}
                  </h3>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                {confirmState.message}
              </p>

              {/* Detail list */}
              {confirmState.detail && confirmState.detail.length > 0 && (
                <div className="space-y-2 mb-4">
                  {confirmState.detail.map((d, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-2.5 rounded-xl border ${
                        d.highlight
                          ? confirmState.confirmColor === "emerald" ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20" :
                            confirmState.confirmColor === "rose" ? "bg-rose-50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/20" :
                            confirmState.confirmColor === "blue" ? "bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20" :
                            "bg-violet-50 dark:bg-violet-500/5 border-violet-200 dark:border-violet-500/20"
                          : "bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {d.label}
                      </span>
                      <span className={`text-sm font-black ${
                        d.highlight
                          ? confirmState.confirmColor === "emerald" ? "text-emerald-700 dark:text-emerald-400" :
                            confirmState.confirmColor === "rose" ? "text-rose-700 dark:text-rose-400" :
                            confirmState.confirmColor === "blue" ? "text-blue-700 dark:text-blue-400" :
                            "text-violet-700 dark:text-violet-400"
                          : "text-slate-900 dark:text-white"
                      }`}>
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

                            {/* ⭐ Preview list (buat bulk add stock) */}
              {confirmState.list && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {confirmState.list.title}
                  </p>

                  {confirmState.list.items.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800">
                      {confirmState.list.emptyText || "Kosong"}
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 divide-y divide-slate-200 dark:divide-slate-800">
                      {confirmState.list.items.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-3 py-2 text-xs"
                        >
                          <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[9px] font-bold shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white truncate">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                    {confirmState.list.items.length} kode
                    {confirmState.list.items.length > 8 && " • scroll untuk lihat semua"}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={confirmState.onConfirm}
                  className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm text-white transition shadow-sm ${
                    confirmState.confirmColor === "emerald" ? "bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-emerald-600/20" :
                    confirmState.confirmColor === "rose" ? "bg-linear-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-600/20" :
                    confirmState.confirmColor === "blue" ? "bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-600/20" :
                    "bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-600/20"
                  }`}
                >
                  {confirmState.confirmText}
                </button>
                <button
                  onClick={() => setConfirmState(null)}
                  className="px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-sm transition"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-xl shadow-2xl text-white font-bold z-110 cursor-pointer max-w-sm flex items-center gap-2 ${
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