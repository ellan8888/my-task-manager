"use client";

import { useState } from "react";

type Props = {
  maxAmount: number;
  onClose: () => void;
  onSuccess: () => void;
};

export default function WithdrawFormModal({ maxAmount, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatRupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

  const handleSubmit = async () => {
    setError("");
    const num = parseInt(amount.replace(/\D/g, ""), 10);

    if (!num || num <= 0) {
      setError("Jumlah tidak valid");
      return;
    }
    if (num > maxAmount) {
      setError(`Maksimal ${formatRupiah(maxAmount)}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, note }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message || data.error || "Gagal");
        return;
      }

      alert(
        `✅ Request penarikan ${formatRupiah(num)} dicatat!\n\n` +
        `Uang akan ditransfer oleh admin setelah di-approve.`
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
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
          Jumlah Tarik
        </label>
        <input
          type="text"
          value={amount}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            setAmount(raw ? parseInt(raw, 10).toLocaleString("id-ID") : "");
          }}
          placeholder="0"
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 transition"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setAmount(maxAmount.toLocaleString("id-ID"))}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition"
          >
            Tarik Semua
          </button>
          <button
            onClick={() => setAmount(Math.floor(maxAmount / 2).toLocaleString("id-ID"))}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition"
          >
            Setengah
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
          Catatan (opsional)
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Contoh: cash, BCA 123456"
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 transition"
        />
      </div>

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
          disabled={loading || !amount}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-extrabold bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
        >
          {loading ? (
            <>
              <i className="fa-solid fa-spinner fa-spin mr-2"></i>
              Memproses...
            </>
          ) : (
            <>
              <i className="fa-solid fa-money-bill-transfer mr-2"></i>
              Request Tarik
            </>
          )}
        </button>
      </div>
    </div>
  );
}