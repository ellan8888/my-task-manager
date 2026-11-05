// app/api/bot/prioritas-ellan/route.ts — dipakai bot (header x-bot-api-key)
//
// Tujuan: akun milik Ellan selalu jadi stok PALING LAMA di Itemku (Itemku menjual
// stok terlama lebih dulu). Caranya: sebelum akun Ellan dipajang di sebuah kategori,
// akun milik orang lain yang sedang terpajang di kategori itu dihapus dulu dari Itemku,
// lalu dipajang ulang SETELAH akun Ellan.
//
//   GET  → rencana per kategori: akun Ellan yang menunggu dipajang + akun orang lain
//          yang sedang terpajang (perlu dihapus dulu)
//   POST { username } → akun orang lain sudah dihapus bot dari Itemku → kembalikan ke
//          antrean "menunggu dipajang" (pemilik tetap sama)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ACTIVE_STATUSES } from "@/lib/replacements";

export const dynamic = "force-dynamic";

const PRIORITY_OWNER = "ellan";

const isBot = (request: Request) => {
  const key = process.env.BOT_API_KEY;
  return !!key && request.headers.get("x-bot-api-key") === key;
};
const unauthorized = () => NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : (err as { message?: string })?.message || "Terjadi kesalahan";

type Acc = { username: string; kategori: string | null; added_by: string | null; created_at?: string | null };

const norm = (v: string | null | undefined) => (v || "").toLowerCase().replace(/[\r\n]/g, "").trim();

/** Akun yang sedang dipakai Ganti Akun / Kirim Akun Manual — jangan disentuh */
async function busyUsernames() {
  const set = new Set<string>();
  const { data: rep } = await supabaseAdmin
    .from("account_replacements")
    .select("old_username, new_username")
    .in("status", ACTIVE_STATUSES);
  (rep || []).forEach((r) => {
    if (r.new_username) set.add(String(r.new_username).toLowerCase());
    if (r.old_username) set.add(String(r.old_username).toLowerCase());
  });
  const { data: md, error } = await supabaseAdmin
    .from("manual_deliveries")
    .select("accounts")
    .in("status", ["pending", "processing", "failed", "finalize_failed"]);
  if (!error) {
    (md || []).forEach((r) =>
      ((r.accounts as { username: string }[]) || []).forEach((a) => set.add(a.username.toLowerCase()))
    );
  }
  return set;
}

export async function GET(request: Request) {
  if (!isBot(request)) return unauthorized();
  try {
    // 1. Akun Ellan yang menunggu dipajang
    const { data: queued, error: qErr } = await supabaseAdmin
      .from("accounts_stock")
      .select("username, kategori, added_by, created_at")
      .eq("status", "queued_for_sale")
      .eq("used", false)
      .eq("deleted", false)
      .eq("logged_out", false)
      .ilike("added_by", PRIORITY_OWNER);
    if (qErr) throw qErr;

    const ellanByKat = new Map<string, string[]>();
    for (const a of (queued || []) as Acc[]) {
      const k = norm(a.kategori);
      if (!k) continue;
      ellanByKat.set(k, [...(ellanByKat.get(k) || []), a.username]);
    }
    if (!ellanByKat.size) return NextResponse.json({ success: true, data: [] });

    // 2. Akun orang lain yang sedang terpajang di kategori-kategori itu
    const { data: listed, error: lErr } = await supabaseAdmin
      .from("accounts_stock")
      .select("username, kategori, added_by, listed_at, pending_move_to")
      .eq("status", "listed")
      .eq("used", true)
      .eq("deleted", false)
      .eq("logged_out", false)
      .is("pending_move_to", null);
    if (lErr) throw lErr;

    const busy = await busyUsernames();
    const data = [...ellanByKat.entries()]
      .map(([kategori, ellan]) => {
        const others = ((listed || []) as (Acc & { listed_at?: string | null })[])
          .filter(
            (a) =>
              norm(a.kategori) === kategori &&
              norm(a.added_by) !== PRIORITY_OWNER &&
              !busy.has(a.username.toLowerCase())
          )
          .sort((a, b) => String(a.listed_at || "").localeCompare(String(b.listed_at || "")))
          .map((a) => ({ username: a.username, owner: norm(a.added_by) || "-" }));
        return { kategori, ellan, others };
      })
      .filter((p) => p.others.length > 0);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, message: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isBot(request)) return unauthorized();
  try {
    const body = await request.json().catch(() => ({}));
    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (!username) return NextResponse.json({ success: false, message: "username wajib" }, { status: 400 });

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("accounts_stock")
      .update({ status: "queued_for_sale", used: false, listed_at: null, updated_at: now })
      .eq("username", username)
      // hanya akun yang memang masih terpajang (bukan yang laku / dihapus / milik Ellan)
      .eq("status", "listed")
      .eq("deleted", false)
      .eq("logged_out", false)
      .not("added_by", "ilike", PRIORITY_OWNER)
      .select("username");
    if (error) throw error;
    if (!data?.length) {
      return NextResponse.json({ success: false, message: "Akun tidak dalam status terpajang" }, { status: 409 });
    }
    return NextResponse.json({ success: true, message: `${username} kembali ke antrean dipajang` });
  } catch (err) {
    return NextResponse.json({ success: false, message: errorMessage(err) }, { status: 500 });
  }
}
