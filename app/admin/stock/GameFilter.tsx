"use client";

import KategoriDropdown from "./KategoriDropdown";
import { ALL_GAMES, gameCounts } from "@/lib/gameFilter";

type Props<T extends { kategori?: string | null }> = {
  items: T[];
  value: string;
  onChange: (game: string) => void;
};

/** Dropdown "pilih game" untuk menyaring daftar stok. */
export default function GameFilter<T extends { kategori?: string | null }>({
  items,
  value,
  onChange,
}: Props<T>) {
  const games = gameCounts(items);
  const allLabel = `Semua Game (${items.length})`;
  const options = [
    { id: 0, kategori: allLabel, game: ALL_GAMES },
    ...games.map((g, i) => ({ id: i + 1, kategori: `${g.game} (${g.count})`, game: g.game })),
  ];
  const current = options.find((o) => o.game === value) || options[0];

  return (
    <KategoriDropdown
      value={current.kategori}
      onChange={(label) => onChange(options.find((o) => o.kategori === label)?.game ?? ALL_GAMES)}
      options={options.map(({ id, kategori }) => ({ id, kategori }))}
      hideLabel={true}
    />
  );
}
