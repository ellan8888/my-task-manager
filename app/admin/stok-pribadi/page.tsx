// app/admin/stok-pribadi/page.tsx
"use client";

import { useEffect, useState } from "react";
import KategoriDropdown from "../stock/KategoriDropdown";
import { useToast } from "@/app/components/ToastProvider";
import { useSidebar } from "../SidebarContext";

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
  created_at: string;
};

export default function StokPribadiPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<StockAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [kategoriList, setKategoriList] = useState<any[]>([]);
  const [selling, setSelling] = useState<Set<number>>(new Set());
  const { sidebarOpen, toggleSidebar } = useSidebar();

  // Form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cookie, setCookie] = useState("");
  const [kategori, setKategori] = useState("");
  const [addedBy, setAddedBy] = useState("lan4337");
  const [saving, setSaving] = useState(false);

  // Load kategori
  const loadKategori = async () => {
    try {
      const res = await fetch("/api/kategori/links");
      const data = await res.json();
      if (data.success) {
        setKategoriList(data.list || []);
        if (!kategori && data.list?.length > 0) setKategori(data.list[0].kategori);
      }
    } catch {}
  };

  // Load akun dengan status personal
  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts/stock?status=personal");
      const data = await res.json();
      if (data.success) setAccounts(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKategori();
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Submit — tambah akun
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username) {
      toast.warning("Username wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/accounts/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          roblox_cookie: cookie,
          kategori,
          added_by: addedBy,
          status: "personal", // ← ★ default personal
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setUsername("");
        setPassword("");
        setCookie("");
        loadAccounts();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  // ★ Klik "Jual" → update status → bot detect
  const handleSell = async (uname: string) => {
    if (!confirm(`Jual akun "${uname}"?\n\nBot akan otomatis input ke itemku.`)) return;

    setSelling((prev) =>
      new Set(prev).add(accounts.find((a) => a.username === uname)!.id)
    );

    try {
      const res = await fetch("/api/accounts/stock/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: uname }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setAccounts((current) => current.filter((a) => a.username !== uname));
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Gagal jual akun");
    } finally {
      setSelling((prev) => {
        const next = new Set(prev);
        next.delete(accounts.find((a) => a.username === uname)?.id || 0);
        return next;
      });
    }
  };

  // Hapus akun
  const handleDelete = async (uname: string) => {
    if (!confirm(`Hapus "${uname}"?`)) return;
    try {
      const res = await fetch(
        `/api/accounts/stock?username=${encodeURIComponent(uname)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        loadAccounts();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Gagal hapus");
    }
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

          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <i className="fa-solid fa-vault text-base"></i>
          </div>

          <div>
            <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Stok Pribadi
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Simpan akun dulu, jual nanti
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 mb-6 shadow-sm"
          >
            <h2 className="font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
              <i className="fa-solid fa-plus text-blue-600 dark:text-blue-400"></i>
              <span>Tambah Akun ke Stok Pribadi</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Patryarla827"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Password
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="opsional"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                Cookie (.ROBLOSECURITY) — Opsional
              </label>
              <textarea
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                placeholder="_|WARNING...|_ (boleh dikosongin)"
                rows={2}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 dark:text-white resize-none focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Kategori *
                </label>
                <KategoriDropdown
                  value={kategori}
                  onChange={setKategori}
                  options={kategoriList.map((k) => ({
                    id: k.id,
                    kategori: k.kategori,
                  }))}
                  placeholder="Pilih kategori..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Added By
                </label>
                <KategoriDropdown
                  value={addedBy}
                  onChange={setAddedBy}
                  options={[
                    { id: 1, kategori: "lan4337" },
                    { id: 2, kategori: "ushouldrunn" },
                    { id: 3, kategori: "rizki" },
                  ]}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              <i
                className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-plus"}`}
              ></i>
              <span>{saving ? "Menyimpan..." : "Simpan ke Stok Pribadi"}</span>
            </button>
          </form>

          {/* List akun */}
          <div className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
              <i className="fa-solid fa-vault text-blue-600 dark:text-blue-400"></i>
              <span>Akun Tersimpan ({accounts.length})</span>
            </h2>

            {loading ? (
              <p className="text-slate-400 text-sm flex items-center gap-2">
                <i className="fa-solid fa-spinner fa-spin"></i>
                Loading...
              </p>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8">
                <i className="fa-solid fa-inbox text-4xl text-slate-300 dark:text-slate-700 mb-3"></i>
                <p className="text-slate-500 text-sm">Belum ada akun tersimpan</p>
                <p className="text-slate-400 text-xs mt-1">
                  Tambah akun di form atas
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((acc) => {
                  const isSelling = selling.has(acc.id);
                  return (
                    <div
                      key={acc.id}
                      className={`bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 transition ${
                        isSelling ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-bold text-sm truncate text-slate-900 dark:text-white">
                          {acc.username}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                          <i className="fa-solid fa-tag text-[10px]"></i>
                          <span>{acc.kategori}</span>
                          <span className="opacity-50">•</span>
                          <i className="fa-solid fa-user text-[10px]"></i>
                          <span>{acc.added_by}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Tombol Jual */}
                        <button
                          onClick={() => handleSell(acc.username)}
                          disabled={isSelling}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
                          title="Jual akun ini — bot akan input ke itemku"
                        >
                          {isSelling ? (
                            <i className="fa-solid fa-spinner fa-spin text-[10px]"></i>
                          ) : (
                            <i className="fa-solid fa-rocket text-[10px]"></i>
                          )}
                          <span>{isSelling ? "Proses..." : "Jual"}</span>
                        </button>

                        {/* Tombol Hapus */}
                        <button
                          onClick={() => handleDelete(acc.username)}
                          className="w-7 h-7 flex items-center justify-center bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-500/40 transition"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}