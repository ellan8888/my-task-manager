"use client";

import { useState } from "react";

type Props = {
  withdrawal: {
    id: number;
    joki_name: string;
    amount: number;
    note: string | null;
    bank_name?: string | null;
    account_number?: string | null;
    account_holder?: string | null;
  };
  onClose: () => void;
  onSuccess: () => void;
};

export default function ApproveModal({ withdrawal, onClose, onSuccess }: Props) {
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [rejectReason, setRejectReason] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatRupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.type.startsWith("image/")) {
      setError("File harus gambar (JPG/PNG)");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("Max 5MB");
      return;
    }

    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    setError("");

    // ⭐ Validasi
    if (action === "reject" && !rejectReason.trim()) {
      setError("Alasan reject wajib diisi");
      return;
    }

    // ⭐ APPROVE: wajib upload bukti
    if (action === "approve" && !file) {
      setError("Upload bukti pembayaran dulu ya");
      return;
    }

    setLoading(true);
    try {
      let paymentProofUrl: string | null = null;

      // 1️⃣ Kalau approve → upload foto dulu
      if (action === "approve" && file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("withdrawalId", String(withdrawal.id));

        const uploadRes = await fetch("/api/upload/payment-proof", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();

        if (!uploadData.success) {
          setError(uploadData.message || uploadData.error || "Gagal upload bukti");
          setLoading(false);
          return;
        }

        paymentProofUrl = uploadData.url;
      }

      // 2️⃣ Kirim PATCH ke /api/withdrawals
      const res = await fetch("/api/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: withdrawal.id,
          action,
          reject_reason: action === "reject" ? rejectReason : undefined,
          transfer_note: action === "approve" ? transferNote : undefined,
          payment_proof_url: paymentProofUrl, // ⭐ baru
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message || data.error || "Gagal");
        return;
      }

      alert(
        action === "approve"
          ? `Request ${withdrawal.joki_name} disetujui!`
          : `Request ${withdrawal.joki_name} ditolak.`
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ⭐ REQUEST INFO */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Request
          </span>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 capitalize flex items-center gap-1.5">
            <i className="fa-solid fa-user text-[10px]"></i>
            {withdrawal.joki_name}
          </span>
        </div>
        <p className="text-2xl font-black text-slate-900 dark:text-white">
          {formatRupiah(withdrawal.amount)}
        </p>
        {withdrawal.note && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <i className="fa-regular fa-note-sticky text-[11px] text-violet-500 dark:text-violet-400"></i>
            {withdrawal.note}
          </p>
        )}
      </div>

      {/* ⭐ BANK INFO */}
      {withdrawal.bank_name && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
          <div className="flex items-center gap-2 mb-3">
            <i className="fa-solid fa-building-columns text-blue-600 dark:text-blue-400"></i>
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              Rekening Tujuan
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-600 dark:text-slate-400">Bank</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {withdrawal.bank_name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-600 dark:text-slate-400">Nomor</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                  {withdrawal.account_number}
                </span>
                <button
                  onClick={() => {
                    if (withdrawal.account_number) {
                      navigator.clipboard.writeText(withdrawal.account_number);
                      alert("Nomor rekening dicopy!");
                    }
                  }}
                  className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/20 hover:bg-blue-200 dark:hover:bg-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center transition"
                  title="Copy nomor rekening"
                >
                  <i className="fa-regular fa-copy text-xs"></i>
                </button>
              </div>
            </div>
            {withdrawal.account_holder && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600 dark:text-slate-400">Nama</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {withdrawal.account_holder}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              const text = `${withdrawal.bank_name} ${withdrawal.account_number}${
                withdrawal.account_holder ? ` a/n ${withdrawal.account_holder}` : ""
              }`;
              navigator.clipboard.writeText(text);
              alert("Detail rekening dicopy!");
            }}
            className="w-full mt-3 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center justify-center gap-1.5"
          >
            <i className="fa-regular fa-copy text-xs"></i>
            Copy Semua Detail Rekening
          </button>
        </div>
      )}

      {/* ⭐ ACTION TOGGLE */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setAction("approve")}
          className={`p-3 rounded-xl font-bold text-sm transition border-2 flex items-center justify-center gap-2 ${
            action === "approve"
              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300"
              : "bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-emerald-300"
          }`}
        >
          <i className="fa-solid fa-circle-check"></i>
          Approve
        </button>
        <button
          onClick={() => setAction("reject")}
          className={`p-3 rounded-xl font-bold text-sm transition border-2 flex items-center justify-center gap-2 ${
            action === "reject"
              ? "bg-rose-50 dark:bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-300"
              : "bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-rose-300"
          }`}
        >
          <i className="fa-solid fa-circle-xmark"></i>
          Reject
        </button>
      </div>

      {/* ⭐ FORM INPUT */}
      {action === "approve" ? (
        <>
          {/* ⭐ UPLOAD BUKTI PEMBAYARAN */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Bukti Pembayaran <span className="text-rose-500">*</span>
            </label>

            {preview ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-44 object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
                <div className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded truncate max-w-[80%]">
                  ✅ {file?.name}
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 transition">
                <i className="fa-solid fa-cloud-arrow-up text-2xl text-slate-400 mb-2"></i>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Klik untuk upload foto
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  JPG/PNG, max 5MB
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Catatan Transfer */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Catatan Transfer <span className="text-slate-400 font-normal normal-case">(opsional)</span>
            </label>
            <input
              type="text"
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="Contoh: BCA 123456 a/n Ridho"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
        </>
      ) : (
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
            Alasan Reject
          </label>
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Contoh: Saldo nggak cukup"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 transition"
          />
        </div>
      )}

      {/* ⭐ ERROR */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation"></i>
          {error}
        </div>
      )}

      {/* ⭐ FOOTER */}
      <div className="flex gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={onClose}
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
        >
          Batal
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || (action === "approve" && !file)}
          className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            action === "approve"
              ? "bg-linear-to-r from-emerald-600 to-green-600 shadow-emerald-600/30"
              : "bg-linear-to-r from-rose-600 to-red-600 shadow-rose-600/30"
          }`}
        >
          {loading ? (
            <>
              <i className="fa-solid fa-spinner fa-spin"></i>
              {action === "approve" && file ? "Mengupload..." : "Memproses..."}
            </>
          ) : (
            <>
              <i className={`fa-solid ${action === "approve" ? "fa-check" : "fa-times"}`}></i>
              {action === "approve" ? "Approve" : "Reject"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}