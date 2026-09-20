"use client";

// ══════════════════════════════════════════════════════
// BASE SKELETON — kotak abu-abu dengan animasi pulse
// ══════════════════════════════════════════════════════
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg ${className}`}
    />
  );
}

// ══════════════════════════════════════════════════════
// STATS CARD SKELETON — untuk /admin dashboard
// ══════════════════════════════════════════════════════
export function SkeletonStatsCard() {
  return (
    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5">
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
      </div>
      <Skeleton className="h-3 w-40 mt-3" />
    </div>
  );
}

// ══════════════════════════════════════════════════════
// LIST ITEM SKELETON — untuk list akun / kategori
// ══════════════════════════════════════════════════════
export function SkeletonListItem() {
  return (
    <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Skeleton className="h-7 w-16 rounded-lg" />
        <Skeleton className="h-7 w-7 rounded-lg" />
        <Skeleton className="h-7 w-7 rounded-lg" />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// LIST SKELETON — beberapa item sekaligus
// ══════════════════════════════════════════════════════
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// FORM SKELETON — untuk form input
// ══════════════════════════════════════════════════════
export function SkeletonForm() {
  return (
    <div className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 mb-6">
      <Skeleton className="h-5 w-48 mb-6" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        <div>
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>

      <div className="mb-4">
        <Skeleton className="h-3 w-32 mb-2" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>

      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}

// ══════════════════════════════════════════════════════
// TABLE SKELETON — untuk tabel
// ══════════════════════════════════════════════════════
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-7 w-20 rounded-lg shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}