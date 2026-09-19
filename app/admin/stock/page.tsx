// app/admin/stock/page.tsx
"use client";

import { useEffect, useState } from "react";

type StockAccount = {
  id: number;
  username: string;
  password: string | null;
  roblox_cookie: string | null;
  kategori: string | null;
  added_by: string | null;
  used: boolean;
  logged_out: boolean;
  logged_out_at: string | null;
  created_at: string;
};

export default function StockPage() {
  const [accounts, setAccounts] = useState<StockAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cookie, setCookie] = useState("");
  const [kategori, setKategori] = useState("akun");
  const [addedBy, setAddedBy] = useState("lan4337");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "used" | "logged_out">("all");

  const loadAccounts = async () => {
    setLoading(true);
    try {
      let url = "/api/accounts/stock";
      if (filter === "ready") url += "?used=false&logged_out=false";
      else if (filter === "used") url += "?used=true";
      else if (filter === "logged_out") url += "?logged_out=true";

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setAccounts(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username) return;

    // ★ Validasi: password wajib kalau kategori "akun"
    if (kategori === "akun" && !password) {
      setMessage("⚠️ Password wajib untuk kategori 'akun'");
      return;
    }

    setSaving(true);
    setMessage("");

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
        }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage(`✅ ${data.message}`);
        setUsername("");
        setPassword("");
        setCookie("");
        loadAccounts();
      } else {
        setMessage(`⚠️ ${data.message}`);
      }
    } catch (err) {
      setMessage("⚠️ Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (uname: string) => {
    if (!confirm(`Hapus ${uname}?`)) return;
    try {
      const res = await fetch(`/api/accounts/stock?username=${encodeURIComponent(uname)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`🗑️ ${data.message}`);
        loadAccounts();
      } else {
        setMessage(`⚠️ ${data.message}`);
      }
    } catch {
      setMessage("⚠️ Gagal hapus");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-extrabold mb-6">📦 Stock Akun Roblox</h1>

        {/* FORM INPUT */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 rounded-2xl p-6 border border-slate-800 mb-6"
        >
          <h2 className="font-bold mb-4">➕ Tambah Stock Baru</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                Username *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Patryarla827"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                Password{" "}
                {kategori === "akun" && <span className="text-red-400">*</span>}
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  kategori === "akun" ? "Wajib untuk auto-login" : "opsional"
                }
                required={kategori === "akun"}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500"
              />
              {kategori === "akun" && (
                <p className="text-xs text-amber-400 mt-1">
                  ⚠️ Password dipake buat auto-login Roblox (logout otomatis)
                </p>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
              Cookie (.ROBLOSECURITY) — Opsional
            </label>
            <textarea
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              placeholder="_|WARNING:-DO-NOT-SHARE-THIS...|_ (boleh dikosongin kalau ada password)"
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-violet-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              Kalau ada password, cookie boleh dikosongin — bot bakal auto-login
              & ambil cookie sendiri.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                Kategori
              </label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500"
              >
                <option value="akun">Akun</option>
                <option value="1500 diamond">1500 Diamond</option>
                <option value="1000 diamond">1000 Diamond</option>
                <option value="700 diamond">700 Diamond</option>
                <option value="600 diamond">600 Diamond</option>
                <option value="500 diamond">500 Diamond</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                Added By
              </label>
              <select
                value={addedBy}
                onChange={(e) => setAddedBy(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500"
              >
                <option value="lan4337">lan4337</option>
                <option value="ushouldrunn">ushouldrunn</option>
                <option value="rizki">rizki</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
          >
            {saving ? "Menyimpan..." : "➕ Tambah Stock"}
          </button>

          {message && <p className="text-center text-sm mt-3">{message}</p>}
        </form>

        {/* LIST STOCK */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Daftar Stock ({accounts.length})</h2>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs"
            >
              <option value="all">Semua</option>
              <option value="ready">Ready (belum dipakai)</option>
              <option value="used">Used</option>
              <option value="logged_out">Logged Out</option>
            </select>
          </div>

          {loading ? (
            <p className="text-slate-400 text-sm">Loading...</p>
          ) : accounts.length === 0 ? (
            <p className="text-slate-400 text-sm">Belum ada stock.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="bg-slate-950 rounded-xl p-4 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-bold text-sm truncate">
                      {acc.username}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {acc.kategori} • {acc.added_by}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {acc.used ? (
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded-lg">
                        USED
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-lg">
                        READY
                      </span>
                    )}
                    {acc.logged_out && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded-lg">
                        LOGGED OUT
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(acc.username)}
                      className="px-2 py-1 bg-red-500/20 text-red-300 text-[10px] font-bold rounded-lg hover:bg-red-500/40"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}