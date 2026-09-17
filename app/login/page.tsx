"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Username atau password salah");
        setLoading(false);
        return;
      }

      router.push(from);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Terjadi kesalahan. Coba lagi.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-950 to-slate-900 text-white font-sans antialiased flex items-center justify-center p-4">
      {/* Glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-linear-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-600/30 ring-2 ring-violet-500/20 mx-auto mb-4">
            <i className="fa-solid fa-gamepad text-white text-2xl"></i>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            My Task Manager
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Masuk untuk mengakses dashboard
          </p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-2xl shadow-slate-950/50"
        >
          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
              <i className="fa-solid fa-triangle-exclamation text-rose-400 text-sm mt-0.5"></i>
              <p className="text-xs text-rose-300 font-medium">{error}</p>
            </div>
          )}

          {/* Username */}
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Username
            </label>
            <div className="relative">
              <i className="fa-regular fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                placeholder="Masukkan username"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 transition"
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Masukkan password"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                title={showPassword ? "Sembunyikan" : "Tampilkan"}
              >
                <i
                  className={`fa-regular ${
                    showPassword ? "fa-eye-slash" : "fa-eye"
                  } text-sm`}
                ></i>
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin text-sm"></i>
                Memproses...
              </>
            ) : (
              <>
                <i className="fa-solid fa-right-to-bracket text-sm"></i>
                Masuk
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-slate-500 mt-5 flex items-center justify-center gap-1.5">
            <i className="fa-solid fa-shield-halved text-[10px]"></i>
            Halaman ini dilindungi
          </p>
        </form>

        <p className="text-center text-xs text-slate-600 mt-6">
          © {new Date().getFullYear()} My Task Manager
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}