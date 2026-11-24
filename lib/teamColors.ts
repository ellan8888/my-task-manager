// lib/teamColors.ts — warna tetap tiap anggota tim (avatar, grafik, chip) di semua halaman.
// Anggota baru otomatis mendapat warna dari PALETTE (dipilih dari nama, jadi selalu sama),
// tanpa perlu mengubah kode setiap ada staff baru.

export type TeamColor = { solid: string; bar: string; ring: string; text: string; soft: string; avatar: string };

const C = {
  violet: { solid: "bg-violet-500 border-violet-500 shadow-violet-500/30", bar: "#8b5cf6", ring: "border-violet-300 dark:border-violet-500/40", text: "text-violet-600 dark:text-violet-400", soft: "bg-violet-100 dark:bg-violet-500/15", avatar: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" },
  sky: { solid: "bg-sky-500 border-sky-500 shadow-sky-500/30", bar: "#0ea5e9", ring: "border-sky-300 dark:border-sky-500/40", text: "text-sky-600 dark:text-sky-400", soft: "bg-sky-100 dark:bg-sky-500/15", avatar: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" },
  amber: { solid: "bg-amber-500 border-amber-500 shadow-amber-500/30", bar: "#f59e0b", ring: "border-amber-300 dark:border-amber-500/40", text: "text-amber-600 dark:text-amber-400", soft: "bg-amber-100 dark:bg-amber-500/15", avatar: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
  emerald: { solid: "bg-emerald-500 border-emerald-500 shadow-emerald-500/30", bar: "#10b981", ring: "border-emerald-300 dark:border-emerald-500/40", text: "text-emerald-600 dark:text-emerald-400", soft: "bg-emerald-100 dark:bg-emerald-500/15", avatar: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
  rose: { solid: "bg-rose-500 border-rose-500 shadow-rose-500/30", bar: "#f43f5e", ring: "border-rose-300 dark:border-rose-500/40", text: "text-rose-600 dark:text-rose-400", soft: "bg-rose-100 dark:bg-rose-500/15", avatar: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" },
  teal: { solid: "bg-teal-500 border-teal-500 shadow-teal-500/30", bar: "#14b8a6", ring: "border-teal-300 dark:border-teal-500/40", text: "text-teal-600 dark:text-teal-400", soft: "bg-teal-100 dark:bg-teal-500/15", avatar: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400" },
  fuchsia: { solid: "bg-fuchsia-500 border-fuchsia-500 shadow-fuchsia-500/30", bar: "#d946ef", ring: "border-fuchsia-300 dark:border-fuchsia-500/40", text: "text-fuchsia-600 dark:text-fuchsia-400", soft: "bg-fuchsia-100 dark:bg-fuchsia-500/15", avatar: "bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-400" },
  orange: { solid: "bg-orange-500 border-orange-500 shadow-orange-500/30", bar: "#f97316", ring: "border-orange-300 dark:border-orange-500/40", text: "text-orange-600 dark:text-orange-400", soft: "bg-orange-100 dark:bg-orange-500/15", avatar: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400" },
  indigo: { solid: "bg-indigo-500 border-indigo-500 shadow-indigo-500/30", bar: "#6366f1", ring: "border-indigo-300 dark:border-indigo-500/40", text: "text-indigo-600 dark:text-indigo-400", soft: "bg-indigo-100 dark:bg-indigo-500/15", avatar: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400" },
  lime: { solid: "bg-lime-500 border-lime-500 shadow-lime-500/30", bar: "#84cc16", ring: "border-lime-300 dark:border-lime-500/40", text: "text-lime-700 dark:text-lime-400", soft: "bg-lime-100 dark:bg-lime-500/15", avatar: "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-400" },
} satisfies Record<string, TeamColor>;

/** Warna yang sudah dipakai — jangan diubah supaya grafik lama tetap konsisten. */
const FIXED: Record<string, TeamColor> = { ellan: C.violet, rizki: C.sky, ridho: C.amber, wildan: C.emerald };
const PALETTE: TeamColor[] = [C.rose, C.teal, C.fuchsia, C.orange, C.indigo, C.lime];

export function teamColor(name: string | null | undefined): TeamColor {
  const n = (name || "").toLowerCase();
  if (FIXED[n]) return FIXED[n];
  let h = 0;
  for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
