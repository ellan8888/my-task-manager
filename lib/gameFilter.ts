"use client";

import { useSyncExternalStore } from "react";

export const ALL_GAMES = "__all__";
export const OTHER_GAME = "Lainnya";

/**
 * Nama game dari teks kategori: bagian setelah "|" terakhir.
 * "10b-15b/s | steal an egg" → "Steal An Egg". Tanpa "|" → "Lainnya".
 */
export function gameOf(kategori: string | null | undefined): string {
  const k = (kategori || "").trim();
  const i = k.lastIndexOf("|");
  if (i < 0) return OTHER_GAME;
  const name = k.slice(i + 1).trim().replace(/\s+/g, " ");
  if (!name) return OTHER_GAME;
  return name
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Daftar game + jumlah akun, urut abjad ("Lainnya" paling bawah). */
export function gameCounts<T extends { kategori?: string | null }>(items: T[]) {
  const counts = new Map<string, number>();
  for (const it of items) {
    const g = gameOf(it.kategori);
    counts.set(g, (counts.get(g) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([game, count]) => ({ game, count }))
    .sort((a, b) =>
      a.game === OTHER_GAME ? 1 : b.game === OTHER_GAME ? -1 : a.game.localeCompare(b.game)
    );
}

/** Pilihan game diingat per halaman (localStorage, aman kalau tidak tersedia). */
const CHANGE_EVENT = "game-filter-change";

// Cadangan di memori kalau localStorage diblokir (mode privat dsb.)
const memory = new Map<string, string>();

function readSaved(storageKey: string): string {
  if (memory.has(storageKey)) return memory.get(storageKey)!;
  try {
    return localStorage.getItem(storageKey) || ALL_GAMES;
  } catch {
    return ALL_GAMES;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useGameFilter(storageKey: string) {
  const game = useSyncExternalStore(
    subscribe,
    () => readSaved(storageKey),
    () => ALL_GAMES
  );

  const setGame = (g: string) => {
    memory.set(storageKey, g);
    try {
      if (g === ALL_GAMES) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, g);
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return [game, setGame] as const;
}
