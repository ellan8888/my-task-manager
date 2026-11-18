// lib/chat.ts — kotak chat pembeli Itemku (hanya untuk dibaca) — dipakai API bot & API halaman.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Session } from "@/lib/auth";

export const CHAT_KEEP_DAYS = 30;

/** Superadmin / admin melihat semua chat; staff lain hanya chat order miliknya + yang belum jelas ordernya
 *  (sama dengan aturan penerima notif chat). */
export const canSeeAllChats = (s: Session | null) =>
  s?.role === "superadmin" || s?.role === "admin" || s?.username?.toLowerCase() === "ellan";

export const chatUser = (s: Session) => String(s.username || "").toLowerCase();

export function canSeeConversation(s: Session, owner: string | null | undefined) {
  return canSeeAllChats(s) || !owner || owner.toLowerCase() === chatUser(s);
}

/** "168321882" / "OD000000168321882" → "OD000000168321882" */
export function normalizeOrder(raw: unknown): string | null {
  const v = String(raw ?? "").trim().toUpperCase();
  const m = v.match(/^(?:OD)?0*(\d{6,})$/);
  return m ? `OD${m[1].padStart(15, "0")}` : null;
}

/** Pemilik & nama pembeli sebuah order: akun (income_log) atau jokian (joki_orders). */
export async function orderInfo(orderId: string): Promise<{ owner: string | null; buyer_name: string | null }> {
  const { data: inc } = await supabaseAdmin
    .from("income_log")
    .select("joki_name, buyer_name")
    .eq("order_id", orderId)
    .limit(1)
    .maybeSingle();
  if (inc?.joki_name || inc?.buyer_name) {
    return { owner: inc.joki_name ? String(inc.joki_name).toLowerCase() : null, buyer_name: inc.buyer_name || null };
  }
  const { data: joki } = await supabaseAdmin
    .from("joki_orders")
    .select("joki_name, buyer_name")
    .eq("order_id", orderId)
    .limit(1)
    .maybeSingle();
  return {
    owner: joki?.joki_name ? String(joki.joki_name).toLowerCase() : null,
    buyer_name: joki?.buyer_name || null,
  };
}

/** Link rincian pesanan di Tokoku (untuk membalas lewat Itemku). */
export const tokokuOrderUrl = (orderId: string | null | undefined) => {
  const num = String(orderId || "").replace(/^OD0*/i, "");
  return /^\d+$/.test(num) ? `https://tokoku.itemku.com/riwayat-pesanan/rincian/${num}` : "https://tokoku.itemku.com/riwayat-pesanan";
};
