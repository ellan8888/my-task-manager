"use client";

import { useState } from "react";

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

const BANKS = [
  "BCA", "BRI", "BNI", "Mandiri", "BSI", "CIMB Niaga", "Permata",
  "Dana", "OVO", "GoPay", "ShopeePay", "LinkAja",
  "Lainnya",
];

export default function AddBankModal({ onClose, onSuccess }: Props) {
  const [bankName, setBankName] = useState("BCA");
  const [customBankName, setCustomBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [setDefault, setSetDefault] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");

    const finalBankName =
      bankName === "Lainnya" ? customBankName.trim() : bankName;

    if (!finalBankName) {
      setError("Nama bank wajib diisi");
      return;
    }
    if (!accountNumber.trim()) {
      setError("Nomor rekening wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_name: finalBankName,
          account_number: accountNumber.trim(),
          account_holder: accountHolder.trim() || null,
          set_default: setDefault,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message || data.error || "Gagal");
        return;
      }

      alert("Rekening berhasil ditambahkan!");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 md:p-7 shadow-2xl relative animate-in">
        {/* Header */}
        <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-500/20">
              <i className="fa-solid fa-building-columns text-base"></i>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Tambah Rekening
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rekening tujuan transfer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="space-y-4">
          {/* Bank Name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Nama Bank / E-Wallet
            </label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-violet-500 transition"
            >
              {BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {bankName === "Lainnya" && (
              <input
                type="text"
                value={customBankName}
                onChange={(e) => setCustomBankName(e.target.value)}
                placeholder="Ketik nama bank..."
                className="w-full mt-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-violet-500 transition"
              />
            )}
          </div>

          {/* Account Number */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Nomor Rekening
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="1234567890"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:border-violet-500 transition"
            />
          </div>

          {/* Account Holder */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Nama Pemilik <span className="text-slate-400 font-normal normal-case">(opsional)</span>
            </label>
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              placeholder="Sesuai nama di rekening"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-violet-500 transition"
            />
          </div>

          {/* Set Default */}
          <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-500/50 transition">
            <input
              type="checkbox"
              checked={setDefault}
              onChange={(e) => setSetDefault(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-violet-600 focus:ring-violet-500"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <i className="fa-solid fa-star text-xs text-amber-500"></i>
                Set sebagai default
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rekening ini otomatis dipake waktu tarik
              </p>
            </div>
          </label>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !accountNumber}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-extrabold bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                Menyimpan...
              </>
            ) : (
              <>
                <i className="fa-solid fa-plus"></i>
                Tambah Rekening
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}