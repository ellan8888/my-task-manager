"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { ORDERS_CHANGED_TOPIC } from "@/lib/publicOrder";

/**
 * Panggil `onChange` setiap kali tabel joki_orders berubah.
 *
 * Sinyal datang dari broadcast Supabase Realtime (trigger DB, sql/017) yang TIDAK membawa data
 * apa pun — halaman lalu mengambil data lewat API (yang sudah membatasi kolom). Tabelnya sendiri
 * tidak bisa dibaca langsung dari browser.
 *
 * Cadangan: cek ulang tiap `fallbackMs` saat tab terlihat, dan saat tab dibuka lagi.
 */
export function useOrdersChanged(onChange: () => void, { enabled = true, fallbackMs = 60_000 } = {}) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Satu perubahan sering memicu beberapa update beruntun → gabungkan jadi satu refresh
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current(), 400);
    };

    const channel = supabase
      .channel(ORDERS_CHANGED_TOPIC)
      .on("broadcast", { event: "changed" }, fire)
      .subscribe();

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") fire();
    }, fallbackMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") fire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [enabled, fallbackMs]);
}
