"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import KategoriDropdown from "./KategoriDropdown";
import { useToast } from "@/app/components/ToastProvider";

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

type KategoriLink = {
  id: number;
  kategori: string;
  link: string;
  active: boolean;
};

export default function StockPage() {
    const toast = useToast();
  const [accounts, setAccounts] = useState<StockAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [kategoriList, setKategoriList] = useState<KategoriLink[]>([]);
  const [loadingKategori, setLoadingKategori] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const pathname = usePathname();

  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cookie, setCookie] = useState("");
  const [kategori, setKategori] = useState("");
  const [addedBy, setAddedBy] = useState("lan4337");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "used" | "logged_out">("all");

  // Mode tambah kategori baru
  const [isNewKategori, setIsNewKategori] = useState(false);
  const [newKategoriName, setNewKategoriName] = useState("");
  const [newKategoriLink, setNewKategoriLink] = useState("");

  // ══════════════════════════════════════════════════════
  // THEME + SIDEBAR STATE
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const darkMode = savedTheme ? savedTheme === "dark" : prefersDark;
    setIsDark(darkMode);

    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    const savedSidebar = localStorage.getItem("sidebarOpen");
    if (savedSidebar !== null) {
      setSidebarOpen(savedSidebar === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarOpen", String(sidebarOpen));
  }, [sidebarOpen]);

  const toggleTheme = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem("theme", newMode ? "dark" : "light");

    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // ══════════════════════════════════════════════════════
  // MENU ITEMS
  // ══════════════════════════════════════════════════════
  const menuItems = [
    {
      href: "/",
      icon: "fa-house",
      label: "Task Manager",
      active: pathname === "/",
    },
    {
      href: "/admin",
      icon: "fa-chart-line",
      label: "Dashboard Admin",
      active: pathname === "/admin",
    },
    {
      href: "/admin/stock",
      icon: "fa-boxes-stacked",
      label: "Stock Akun",
      active: pathname === "/admin/stock",
    },
    {
      href: "/admin/kategori",
      icon: "fa-folder-tree",
      label: "Kategori Link",
      active: pathname === "/admin/kategori",
    },
    {
      href: "/queue",
      icon: "fa-list-ol",
      label: "Queue Jokian",
      active: pathname === "/queue",
      badge: "Live",
    },
  ];

  // ══════════════════════════════════════════════════════
  // LOAD DATA
  // ══════════════════════════════════════════════════════
  const loadKategori = async () => {
    setLoadingKategori(true);
    try {
      const res = await fetch("/api/kategori/links");
      const data = await res.json();
      if (data.success) {
        setKategoriList(data.list || []);
        if (!kategori && data.list?.length > 0 && !isNewKategori) {
          setKategori(data.list[0].kategori);
        }
      }
    } finally {
      setLoadingKategori(false);
    }
  };

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
    loadKategori();
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // ══════════════════════════════════════════════════════
  // SUBMIT
  // ══════════════════════════════════════════════════════
  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!username) {
    toast.warning("Username wajib diisi");  // ← ★ GANTI
    return;
  }

  setSaving(true);

  try {
    let finalKategori = kategori;

    if (isNewKategori) {
      if (!newKategoriName || !newKategoriLink) {
        toast.warning("Nama kategori & link wajib diisi");  // ← ★ GANTI
        setSaving(false);
        return;
      }

      const katRes = await fetch("/api/kategori/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kategori: newKategoriName,
          link: newKategoriLink,
        }),
      });

      const katData = await katRes.json();

      if (!katData.success) {
        toast.error(`Gagal simpan kategori: ${katData.message}`);  // ← ★ GANTI
        setSaving(false);
        return;
      }

      finalKategori = newKategoriName.toLowerCase().trim();
      await loadKategori();
      toast.success(`Kategori "${newKategoriName}" disimpan`);  // ← ★ TAMBAH
    }

    const butuhPassword = ["1b-5b/s", "akun"].includes(finalKategori.toLowerCase());
    if (butuhPassword && !password) {
      toast.warning(`Password wajib untuk kategori "${finalKategori}"`);  // ← ★ GANTI
      setSaving(false);
      return;
    }

    const res = await fetch("/api/accounts/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        roblox_cookie: cookie,
        kategori: finalKategori,
        added_by: addedBy,
      }),
    });

    const data = await res.json();

    if (data.success) {
      toast.success(data.message);  // ← ★ GANTI
      setUsername("");
      setPassword("");
      setCookie("");
      setIsNewKategori(false);
      setNewKategoriName("");
      setNewKategoriLink("");
      loadAccounts();
    } else {
      toast.error(data.message);  // ← ★ GANTI
    }
  } catch (err) {
    toast.error("Terjadi kesalahan");  // ← ★ GANTI
  } finally {
    setSaving(false);
  }
};

  const handleDelete = async (uname: string) => {
  if (!window.confirm(`Hapus ${uname}?`)) return;
  try {
    const res = await fetch(
      `/api/accounts/stock?username=${encodeURIComponent(uname)}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (data.success) {
      toast.success(data.message);  // ← ★ GANTI
      loadAccounts();
    } else {
      toast.error(data.message);  // ← ★ GANTI
    }
  } catch {
    toast.error("Gagal hapus");  // ← ★ GANTI
  }
};

  const currentKategori = isNewKategori ? newKategoriName : kategori;
  const butuhPassword = ["1b-5b/s", "akun"].includes(currentKategori.toLowerCase());

  return (
    <>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { display: none; }
        .custom-scrollbar { scrollbar-width: none; }
        html, body { scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
        body, aside, main, header {
          transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease;
        }
      `}</style>

      <div className="h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased flex flex-col relative">

        {/* MOBILE OVERLAY */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SIDEBAR                                              */}
        {/* ══════════════════════════════════════════════════════ */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 h-screen bg-white dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between p-5 transform-gpu will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div>
            {/* Logo */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800/80">
              <div className="flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-2xl bg-linear-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-violet-600/30 ring-2 ring-violet-500/20">
                  <i className="fa-solid fa-shield-halved text-xl"></i>
                </div>
                <div>
                  <h1 className="font-extrabold text-lg leading-tight tracking-tight text-slate-900 dark:text-white">
                    Admin Panel
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Captain Hook Sync
                  </p>
                </div>
              </div>
            </div>

            {/* Menu */}
            <nav className="mt-6 space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all group ${
                    item.active
                      ? "bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-200 border border-violet-200 dark:border-violet-500/40"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <i
                    className={`fa-solid ${item.icon} w-5 text-center ${
                      item.active
                        ? "text-violet-600 dark:text-violet-300"
                        : "group-hover:text-violet-500 dark:group-hover:text-violet-400"
                    } transition`}
                  ></i>
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded font-mono">
                      {item.badge}
                    </span>
                  )}
                  {item.active && !item.badge && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-violet-500"></span>
                  )}
                </Link>
              ))}
            </nav>
          </div>

          {/* Bottom: User + Theme */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800/80">
            <Link
              href="/"
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 hover:border-violet-500/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all group cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                    E
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition">
                    Ellan Worker
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <i className="fa-solid fa-shield-halved text-[9px]"></i>
                    Administrator
                  </p>
                </div>
              </div>
              <i className="fa-solid fa-chevron-right text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all text-xs"></i>
            </Link>

            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center space-x-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              title={isDark ? "Mode Terang" : "Mode Gelap"}
            >
              <i
                className={`fa-solid ${
                  isDark ? "fa-sun" : "fa-moon"
                } text-sm text-slate-700 dark:text-slate-300`}
              ></i>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isDark ? "Mode Terang" : "Mode Gelap"}
              </span>
            </button>
          </div>
        </aside>

        {/* ══════════════════════════════════════════════════════ */}
        {/* MAIN CONTENT                                         */}
        {/* ══════════════════════════════════════════════════════ */}
        <main
          className={`flex-1 flex flex-col h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 transition-[margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            sidebarOpen ? "md:ml-72" : "md:ml-0"
          }`}
        >
          {/* Header */}
          <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-20 shrink-0">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
                title={sidebarOpen ? "Tutup Sidebar" : "Buka Sidebar"}
              >
                <i
                  className={`fa-solid ${
                    sidebarOpen ? "fa-bars-staggered" : "fa-bars"
                  } text-base`}
                ></i>
              </button>

              <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-violet-600/30">
                <i className="fa-solid fa-boxes-stacked text-base"></i>
              </div>

              <div>
                <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Stock Akun Roblox
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                  Kelola stok akun yang dijual
                </p>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
              {/* FORM INPUT */}
              <form
                onSubmit={handleSubmit}
                noValidate
                className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 mb-6 shadow-sm"
              >
                <h2 className="font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-plus text-violet-600 dark:text-violet-400"></i>
                  <span>Tambah Stock Baru</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                      Username
                    </label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="TestAkun0029"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                      Password {butuhPassword && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={butuhPassword ? "Wajib untuk auto-login" : "opsional"}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                    />
                    {butuhPassword && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                        <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
                        Password dipake buat auto-login Roblox
                      </p>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                    Cookie (.ROBLOSECURITY) — Opsional
                  </label>
                  <textarea
                    value={cookie}
                    onChange={(e) => setCookie(e.target.value)}
                    placeholder="_|WARNING:-DO-NOT-SHARE-THIS...|_ (boleh dikosongin)"
                    rows={3}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 resize-none"
                  />
                </div>

                {/* ══════════════════════════════════════════════════ */}
                {/* SECTION KATEGORI + ADDED BY (SEBELAHAN)          */}
                {/* ══════════════════════════════════════════════════ */}
                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                      <i className="fa-solid fa-tag text-[10px]"></i>
                      <span>Kategori *</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewKategori(!isNewKategori);
                        setNewKategoriName("");
                        setNewKategoriLink("");
                      }}
                      className={`text-xs font-bold px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                        isNewKategori
                          ? "bg-red-500/20 text-red-600 dark:text-red-300 hover:bg-red-500/40"
                          : "bg-violet-500/20 text-violet-600 dark:text-violet-300 hover:bg-violet-500/40"
                      }`}
                    >
                      <i
                        className={`fa-solid ${
                          isNewKategori ? "fa-xmark" : "fa-plus"
                        } text-[10px]`}
                      ></i>
                      <span>
                        {isNewKategori ? "Batal" : "Tambah Kategori Baru"}
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Kolom 1: Kategori */}
                    <div>
                      {!isNewKategori ? (
                        <KategoriDropdown
                            value={kategori}
                            onChange={setKategori}
                            options={kategoriList.map((k) => ({
                            id: k.id,
                            kategori: k.kategori,
                            }))}
                            loading={loadingKategori}
                            placeholder="Pilih kategori..."
                        />
                        ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={newKategoriName}
                            onChange={(e) => setNewKategoriName(e.target.value)}
                            placeholder="3000 diamond"
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                          />
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <i className="fa-solid fa-circle-info text-[10px]"></i>
                            Gunakan huruf kecil (contoh: <code className="text-violet-500">3000 diamond</code>)
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Kolom 2: Added By */}
                    <div>
                      <KategoriDropdown
                        value={addedBy}
                        onChange={setAddedBy}
                        options={[
                            { id: 1, kategori: "lan4337" },
                            { id: 2, kategori: "ushouldrunn" },
                            { id: 3, kategori: "rizki" },
                        ]}
                        placeholder="Pilih admin..."
                        />
                      {isNewKategori && (
                        <p className="text-[11px] text-transparent mt-1">.</p>
                      )}
                    </div>
                  </div>

                  {/* Link Itemku — cuma muncul kalau mode tambah kategori baru */}
                  {isNewKategori && (
                    <div className="mt-3">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                        <i className="fa-solid fa-link text-[10px]"></i>
                        <span>Link Itemku *</span>
                      </label>
                      <input
                        type="text"
                        value={newKategoriLink}
                        onChange={(e) => setNewKategoriLink(e.target.value)}
                        placeholder="https://tokoku.itemku.com/pengiriman-otomatis/baru/XXXXXXX"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                      />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                        <i className="fa-solid fa-circle-info text-[10px]"></i>
                        Copy URL dari itemku → produk → "Pengiriman Otomatis"
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={saving || loadingKategori}
                  className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <i
                    className={`fa-solid ${
                      saving ? "fa-spinner fa-spin" : "fa-plus"
                    }`}
                  ></i>
                  <span>{saving ? "Menyimpan..." : "Tambah Stock"}</span>
                </button>

            
              </form>

              {/* LIST STOCK */}
              <div className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <i className="fa-solid fa-list text-violet-600 dark:text-violet-400"></i>
                    <span>Daftar Stock ({accounts.length})</span>
                  </h2>
                  <div className="w-48">
                    <KategoriDropdown
                        value={
                        filter === "all"
                            ? "Semua"
                            : filter === "ready"
                            ? "Ready"
                            : filter === "used"
                            ? "Used"
                            : "Logged Out"
                        }
                        onChange={(val) => {
                        const map: Record<string, any> = {
                            Semua: "all",
                            Ready: "ready",
                            Used: "used",
                            "Logged Out": "logged_out",
                        };
                        setFilter(map[val] || "all");
                        }}
                        options={[
                        { id: 1, kategori: "Semua" },
                        { id: 2, kategori: "Ready" },
                        { id: 3, kategori: "Used" },
                        { id: 4, kategori: "Logged Out" },
                        ]}
                    />
                    </div>
                </div>

                {loading ? (
                  <p className="text-slate-400 text-sm flex items-center gap-2">
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Loading...
                  </p>
                ) : accounts.length === 0 ? (
                  <p className="text-slate-400 text-sm">Belum ada stock.</p>
                ) : (
                  <div className="space-y-2">
                    {accounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
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
                          {acc.used ? (
                            <span className="px-2 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-lg flex items-center gap-1">
                              <i className="fa-solid fa-check text-[9px]"></i>
                              USED
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-lg flex items-center gap-1">
                              <i className="fa-solid fa-circle text-[9px]"></i>
                              READY
                            </span>
                          )}
                          {acc.logged_out && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded-lg flex items-center gap-1">
                              <i className="fa-solid fa-right-from-bracket text-[9px]"></i>
                              LOGGED OUT
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(acc.username)}
                            className="w-7 h-7 flex items-center justify-center bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 text-[10px] font-bold rounded-lg hover:bg-red-500/40 transition"
                            title="Hapus"
                          >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}