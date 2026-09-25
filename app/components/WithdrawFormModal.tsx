"use client";

import { useEffect, useState } from "react";

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

  // ⭐ State bank
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [loadingBanks, setLoadingBanks] = useState(true);

  const formatRupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

  // ⭐ Fetch bank accounts
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const res = await fetch("/api/bank-accounts");
        const data = await res.json();
        if (data.success) {
          setBankAccounts(data.data || []);
          // Auto-select default atau yang pertama
          const defaultBank = (data.data || []).find((b: any) => b.is_default);
          if (defaultBank) setSelectedBankId(defaultBank.id);
          else if (data.data?.length > 0) setSelectedBankId(data.data[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingBanks(false);
      }
    };
    fetchBanks();
  }, []);

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
    if (!selectedBankId) {
      setError("Pilih rekening dulu");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: num,
          note,
          bank_account_id: selectedBankId,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message || data.error || "Gagal");
        return;
      }

      alert(
        `Request penarikan ${formatRupiah(num)} dicatat!\n\n` +
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
      {/* ⭐ Rekening Tujuan */}
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
          Rekening Tujuan
        </label>

        {loadingBanks ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <i className="fa-solid fa-spinner fa-spin"></i>
            Memuat rekening...
          </div>
        ) : bankAccounts.length === 0 ? (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i>
              Belum ada rekening. Tutup modal ini dan tambah rekening dulu di halaman Penarikan.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {bankAccounts.map((bank) => (
              <button
                key={bank.id}
                onClick={() => setSelectedBankId(bank.id)}
                className={`w-full text-left p-3 rounded-xl border transition flex items-center gap-3 ${
                  selectedBankId === bank.id
                    ? "bg-violet-50 dark:bg-violet-500/10 border-violet-300 dark:border-violet-500/50 ring-1 ring-violet-500/30"
                    : "bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-500/30"
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedBankId === bank.id
                    ? "border-violet-600 dark:border-violet-400 bg-violet-600 dark:bg-violet-500"
                    : "border-slate-300 dark:border-slate-600"
                }`}>
                  {selectedBankId === bank.id && (
                    <i className="fa-solid fa-check text-[10px] text-white"></i>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {bank.bank_name}
                    </span>
                    {bank.is_default && (
                      <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate">
                    {bank.account_number}
                  </p>
                  {bank.account_holder && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-500 truncate">
                      a/n {bank.account_holder}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Jumlah */}
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

      {/* Note */}
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
          Catatan <span className="text-slate-400 font-normal normal-case">(opsional)</span>
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Contoh: buat bayar kos"
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 transition"
        />
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation"></i>
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
          disabled={loading || !amount || !selectedBankId}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-extrabold bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <i className="fa-solid fa-spinner fa-spin"></i>
              Memproses...
            </>
          ) : (
            <>
              <i className="fa-solid fa-money-bill-transfer"></i>
              Request Tarik
            </>
          )}
        </button>
      </div>
    </div>
  );
}