// lib/redeem.ts — helper bersama untuk code Redfinger (redeem_codes). Server only.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Session } from "@/lib/auth";

export const PRICE_PER_CODE = 20000;
const OWNER_USERNAMES = ["ellan"];

/** Owner (ambil code gratis, kelola stok & verifikasi). Selalu dari sesi login, bukan dari isi request. */
export const isRedeemOwner = (s: Session | null) => !!s && OWNER_USERNAMES.includes(s.username.toLowerCase());

/**
 * Ambil 1 code available secara aman (tidak bisa diambil dua orang sekaligus):
 * prioritas code yang di-assign ke user, lalu code bebas (tanpa pemilik).
 * Status code langsung jadi "used" atas nama user. Return null kalau stok habis.
 */
export async function claimCode(
  user: string,
  paymentMethod: string
): Promise<{ id: number; code: string; prevUsername: string | null } | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    let { data: pick } = await supabaseAdmin
      .from("redeem_codes")
      .select("id, code, username")
      .eq("username", user)
      .eq("status", "available")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!pick) {
      ({ data: pick } = await supabaseAdmin
        .from("redeem_codes")
        .select("id, code, username")
        .or("username.is.null,username.eq.")
        .eq("status", "available")
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle());
    }
    if (!pick) return null;

    // Hanya berhasil kalau code MASIH available (kalau keduluan request lain → coba code berikutnya)
    const { data: claimed } = await supabaseAdmin
      .from("redeem_codes")
      .update({ username: user, status: "used", payment_method: paymentMethod, used_at: new Date().toISOString() })
      .eq("id", pick.id)
      .eq("status", "available")
      .select("id, code");
    if (claimed && claimed.length) return { ...(claimed[0] as { id: number; code: string }), prevUsername: pick.username || null };
  }
  return null;
}

/** Kembalikan code ke stok (dipakai kalau langkah sesudahnya gagal) — pemilik awal dipulihkan. */
export async function releaseCode(id: number, previousUsername: string | null = null) {
  await supabaseAdmin
    .from("redeem_codes")
    .update({ username: previousUsername, status: "available", payment_method: null, used_at: null })
    .eq("id", id);
}
