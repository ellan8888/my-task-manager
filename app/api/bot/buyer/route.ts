// app/api/bot/buyer/route.ts — dipakai bot Discord (header x-bot-api-key)
//
//   GET ?mode=verify&order_id=OD...  → apakah Order ID ini benar pesanan di toko kita?
//        { valid, kind: "akun" | "joki", product }
//        Dipakai untuk verifikasi role "Pembeli" & testimoni. Tidak membuka data pembeli lain.
//   GET ?mode=recent → 30 penjualan terakhir (id, order_id, produk, waktu) untuk feed "Baru saja terjual".
//        TANPA nama pembeli & nominal.
//   GET ?mode=stats  → { total_sold } untuk statistik server.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const isBot = (request: Request) => {
  const key = process.env.BOT_API_KEY;
  return !!key && request.headers.get("x-bot-api-key") === key;
};
const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : (err as { message?: string })?.message || "Terjadi kesalahan";

/** "167663006" / "#OD000000167663006 (ID)" → "OD000000167663006" */
function normalizeOrderId(raw: string) {
  const v = raw.trim().replace(/\s*\([A-Za-z]{2}\)\s*$/, "").replace(/[#\s]/g, "").toUpperCase();
  return /^\d+$/.test(v) ? "OD" + v.padStart(15, "0") : v;
}

export async function GET(request: Request) {
  if (!isBot(request)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "recent") {
      const { data, error } = await supabaseAdmin
        .from("income_log")
        .select("id, order_id, product_title, completed_at")
        .order("completed_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return NextResponse.json({
        success: true,
        data: (data || []).map((r) => ({
          id: String(r.id),
          order_id: r.order_id,
          product: r.product_title || null,
          kind: /akun|account|starter/i.test(r.product_title || "") ? "akun" : "joki",
          completed_at: r.completed_at,
        })),
      });
    }

    if (mode === "stats") {
      const { count, error } = await supabaseAdmin.from("income_log").select("id", { count: "exact", head: true });
      if (error) throw error;
      return NextResponse.json({ success: true, total_sold: count || 0 });
    }

    if (mode !== "verify") return NextResponse.json({ success: false, message: "mode tidak dikenal" }, { status: 400 });

    const orderId = normalizeOrderId(searchParams.get("order_id") || "");
    if (!/^OD\d{6,}$/.test(orderId)) return NextResponse.json({ success: true, valid: false, reason: "format" });

    // Order ID boleh tersimpan dengan akhiran " (ID)" → cocokkan awalan
    const { data: income, error: incErr } = await supabaseAdmin
      .from("income_log")
      .select("order_id, product_title, roblox_username")
      .ilike("order_id", `${orderId}%`)
      .limit(1);
    if (incErr) throw incErr;

    const { data: joki, error: jokiErr } = await supabaseAdmin
      .from("joki_orders")
      .select("order_id, product")
      .ilike("order_id", `${orderId}%`)
      .limit(1);
    if (jokiErr) throw jokiErr;

    if (joki?.length) {
      return NextResponse.json({ success: true, valid: true, order_id: orderId, kind: "joki", product: joki[0].product || null });
    }
    if (income?.length) {
      return NextResponse.json({
        success: true,
        valid: true,
        order_id: orderId,
        // income_log berisi akun & joki → tentukan dari judul produk (sama seperti bot)
        kind: /akun|account|starter/i.test(income[0].product_title || "") ? "akun" : "joki",
        product: income[0].product_title || null,
      });
    }
    return NextResponse.json({ success: true, valid: false, order_id: orderId, reason: "not_found" });
  } catch (err) {
    return NextResponse.json({ success: false, message: errorMessage(err) }, { status: 500 });
  }
}
