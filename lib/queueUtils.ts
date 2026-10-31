// lib/queueUtils.ts — helper bersama untuk halaman Jokian Queue

const SUFFIX_MULTIPLIER: Record<string, number> = {
  K: 1e3,
  M: 1e6,
  B: 1e9,
  T: 1e12,
  QA: 1e15,
  QI: 1e18,
  SX: 1e21,
  SP: 1e24,
};

/** "1.5T" → 1500000000000, "200Qa" → 2e17, "100" → 100. Tidak terbaca → null */
export function parseShortNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.trim().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)\s*(K|M|B|T|QA|QI|SX|SP)?$/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = (match[2] || "").toUpperCase();
  return suffix ? num * SUFFIX_MULTIPLIER[suffix] : num;
}

/** 100000000000 → "100B" */
export function formatShortNumber(n: number): string {
  const steps: [number, string][] = [
    [1e24, "Sp"],
    [1e21, "Sx"],
    [1e18, "Qi"],
    [1e15, "Qa"],
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, label] of steps) {
    if (n >= size) return `${(n / size).toFixed(1).replace(/\.0$/, "")}${label}`;
  }
  return `${Math.floor(n)}`;
}

type ProgressLike = {
  progress_count: number | null;
  target_count: number | null;
  target_unit: string | null;
};

/** Target asli: "1T" di target_unit → 1e12, kalau tidak ada pakai target_count */
export function getRealTarget(o: ProgressLike): number {
  if (o.target_unit && o.target_unit !== "Joki") {
    const parsed = parseShortNumber(o.target_unit);
    if (parsed && parsed > 0) return parsed;
  }
  return o.target_count && o.target_count > 0 ? o.target_count : 1;
}

/** Teks target untuk ditampilkan ("1T" atau "100") */
export function getDisplayTarget(o: ProgressLike): string {
  if (o.target_unit && o.target_unit !== "Joki") return o.target_unit;
  return o.target_count?.toString() ?? "0";
}

/** Persentase progres 0–100 */
export function getProgressPercent(o: ProgressLike): number {
  return Math.min(100, Math.max(0, ((o.progress_count ?? 0) / getRealTarget(o)) * 100));
}

/** Sensor username untuk pembeli: "Sae_Gamer06" → "Sae_G•••06" */
export function maskUsername(name: string | null | undefined): string {
  if (!name) return "Pembeli";
  if (name.length <= 3) return `${name[0]}•••`;
  if (name.length <= 6) return `${name.slice(0, 2)}•••${name.slice(-1)}`;
  const keep = Math.ceil(name.length * 0.4);
  return `${name.slice(0, keep)}•••${name.slice(-2)}`;
}

/** "baru saja" / "5 menit lalu" / "2 jam lalu" */
export function timeAgo(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = Math.max(0, now - t);
  if (diff < 60_000) return "baru saja";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} menit lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`;
  return `${Math.floor(diff / 86_400_000)} hari lalu`;
}

/** Jam WIB, contoh "20.15" — kalau bukan hari ini ditambah tanggal */
export function formatWIB(ms: number, now: number): string {
  const fmtDay = (v: number) => new Date(v).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });
  const time = new Date(ms).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  if (fmtDay(ms) === fmtDay(now)) return time;
  const day = new Date(ms).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
  return `${day}, ${time}`;
}
