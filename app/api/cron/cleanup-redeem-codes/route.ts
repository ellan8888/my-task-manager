// app/api/cron/cleanup-redeem-codes/route.ts — hapus code Redfinger yang sudah dibeli > 2 hari.
// Dipanggil cron Cloudflare tiap jam (worker/index.ts), header Authorization: Bearer CRON_SECRET.
//
// Yang dihapus HANYA baris redeem_codes berstatus "used". Yang tetap ada:
//   • redeem_purchases (code_id jadi NULL — FK ON DELETE SET NULL), penarikan "[BELI CODE] ..."
//     dan buku kas → saldo & Riwayat Saldo tidak berubah.
//   • stok "available" tidak pernah disentuh.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { codeExpiryCutoff } from "@/lib/redeem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = codeExpiryCutoff();
  const { data, error } = await supabaseAdmin
    .from("redeem_codes")
    .delete()
    .eq("status", "used")
    .lt("used_at", cutoff)
    .select("id");

  if (error) {
    console.error("[Cleanup Redeem] Gagal hapus:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const deleted = data?.length || 0;
  if (deleted) console.log(`[Cleanup Redeem] ${deleted} code dibeli sebelum ${cutoff} dihapus`);
  return NextResponse.json({ success: true, deleted, cutoff });
}
