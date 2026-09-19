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

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts/stock");
      const data = await res.json();
      if (data.success) setAccounts(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;
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
        setMessage("✅ Stock berhasil ditambahkan!");
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

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-extrabold mb-6">
          📦 Stock Akun Roblox
        </h1>

        {/* FORM INPUT */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 rounded-2xl p-6 border border-slate-800 mb-6"
        >
          <h2 className="font-bold mb-4">Tambah Stock Baru</h2>

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
                Password
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="pass123"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
              Cookie (.ROBLOSECURITY) *
            </label>
            <textarea
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              placeholder="_|WARNING:-DO-NOT-SHARE-THIS...|_"
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-violet-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              Paste cookie dari browser (F12 → Application → Cookies → .ROBLOSECURITY)
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

          {message && (
            <p className="text-center text-sm mt-3">{message}</p>
          )}
        </form>

        {/* LIST STOCK */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
          <h2 className="font-bold mb-4">
            Daftar Stock ({accounts.length})
          </h2>

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