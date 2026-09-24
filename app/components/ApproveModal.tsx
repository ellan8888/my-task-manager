"use client";

import { useState } from "react";

type Props = {
  withdrawal: {
    id: number;
    joki_name: string;
    amount: number;
    note: string | null;
  };
  onClose: () => void;
  onSuccess: () => void;
};

export default function ApproveModal({ withdrawal, onClose, onSuccess }: Props) {
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [rejectReason, setRejectReason] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatRupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

  const handleSubmit = async () => {
    setError("");

    if (action === "reject" && !rejectReason.trim()) {
      setError("Alasan reject wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: withdrawal.id,
          action,
          reject_reason: action === "reject" ? rejectReason : undefined,
          transfer_note: action === "approve" ? transferNote : undefined,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message || data.error || "Gagal");
        return;
      }

      alert(
        action === "approve"
          ? `✅ Request ${withdrawal.joki_name} disetujui!`
          : `❌ Request ${withdrawal.joki_name} ditolak.`
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
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Request
          </span>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 capitalize">
            {withdrawal.joki_name}
          </span>
        </div>
        <p className="text-2xl font-black text-slate-900 dark:text-white">
          {formatRupiah(withdrawal.amount)}
        </p>
        {withdrawal.note && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            📝 {withdrawal.note}
          </p>
        )}
      </div>

      {/* Action Toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setAction("approve")}
          className={`p-3 rounded-xl font-bold text-sm transition border-2 ${
            action === "approve"
              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300"
              : "bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-emerald-300"
          }`}
        >
          <i className="fa-solid fa-check-circle mr-2"></i>
          Approve
        </button>
        <button
          onClick={() => setAction("reject")}
          className={`p-3 rounded-xl font-bold text-sm transition border-2 ${
            action === "reject"
              ? "bg-rose-50 dark:bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-300"
              : "bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-rose-300"
          }`}
        >
          <i className="fa-solid fa-times-circle mr-2"></i>
          Reject
        </button>
      </div>

      {action === "approve" ? (
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
            Catatan Transfer (opsional)
          </label>
          <input
            type="text"
            value={transferNote}
            onChange={(e) => setTransferNote(e.target.value)}
            placeholder="Contoh: BCA 123456 a/n Ridho"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition"
          />
        </div>
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

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-sm text-rose-700 dark:text-rose-300">
          <i className="fa-solid fa-circle-exclamation mr-2"></i>
          {error}
        </div>
      )}

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
          disabled={loading}
          className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white shadow-lg transition disabled:opacity-50 ${
            action === "approve"
              ? "bg-linear-to-r from-emerald-600 to-green-600 shadow-emerald-600/30"
              : "bg-linear-to-r from-rose-600 to-red-600 shadow-rose-600/30"
          }`}
        >
          {loading ? (
            <>
              <i className="fa-solid fa-spinner fa-spin mr-2"></i>
              Memproses...
            </>
          ) : (
            <>
              <i className={`fa-solid ${action === "approve" ? "fa-check" : "fa-times"} mr-2`}></i>
              {action === "approve" ? "Approve" : "Reject"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}