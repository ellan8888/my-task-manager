// app/api/queue/refetch/result/route.ts
// Dipanggil BOT setelah membuka detail_url dan mengambil ulang data order.
// Hanya mengisi field yang berhasil didapat — jadwal, joki, dan catatan
// TIDAK disentuh (beda dengan /api/jokian/sync).
// Kalau ternyata order PROGRESS (egg/eternal), order diubah jadi progress
// dengan field yang sama seperti saat order progress masuk normal.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const cleanText = (v: unknown) => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t !== "-" ? t : null;
};

export async function POST(request: Request) {
  try {
    const botKey = process.env.BOT_API_KEY;
    if (!botKey || request.headers.get("x-bot-api-key") !== botKey) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawId = typeof body.order_id === "string" ? body.order_id : "";
    const orderId = rawId.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim();
    if (!orderId) {
      return NextResponse.json({ success: false, message: "order_id wajib" }, { status: 400 });
    }

    const { data: current, error: currentErr } = await supabaseAdmin
      .from("joki_orders")
      .select("order_type, queue_status, progress_keyword, target_count")
      .eq("order_id", orderId)
      .maybeSingle();
    if (currentErr) {
      return NextResponse.json({ success: false, message: currentErr.message }, { status: 500 });
    }
    if (!current) {
      return NextResponse.json({ success: false, message: "Order tidak ditemukan" }, { status: 404 });
    }
    const alreadyProgress =
      current.order_type === "progress" || (current.progress_keyword != null && (current.target_count ?? 0) > 0);

    // Flag selalu dimatikan, berhasil atau tidak
    const updates: Record<string, unknown> = { bot_refetch_requested: false };

    if (body.success === false) {
      updates.bot_refetch_error = cleanText(body.error) ?? "Bot gagal mengambil data";
    } else {
      updates.bot_refetch_error = null;
      const d = body.data ?? {};

      const product = cleanText(d.product);
      if (product) updates.product = product;

      const username = cleanText(d.roblox_username);
      if (username) updates.roblox_username = username;

      const buyer = cleanText(d.buyer_name);
      if (buyer) updates.buyer_name = buyer;

      const qty = cleanText(d.quantity);
      if (qty) updates.quantity = qty;

      const income = Number(d.total_income);
      if (Number.isFinite(income) && income > 0) updates.total_income = Math.round(income);

      const deadline = cleanText(d.response_deadline);
      if (deadline && !Number.isNaN(new Date(deadline).getTime())) updates.response_deadline = deadline;

      // ⭐ Ternyata order PROGRESS → pindah ke bagian Progress Order.
      //    Hanya kalau belum progress, supaya progres yang sudah jalan tidak ter-reset.
      const p = d.progress;
      const keyword = cleanText(p?.progress_keyword);
      if (p && keyword && !alreadyProgress) {
        const rarities: string[] = Array.isArray(p.counted_rarities)
          ? p.counted_rarities.filter((r: unknown): r is string => typeof r === "string").map((r: string) => r.toLowerCase())
          : [];
        const targetCount = Number(p.target_count);

        updates.order_type = "progress";
        updates.progress_keyword = keyword;
        updates.counted_rarities = rarities.length > 0 ? rarities : [keyword.toLowerCase()];
        updates.target_count = Number.isFinite(targetCount) && targetCount > 0 ? Math.round(targetCount) : 1;
        updates.target_unit = cleanText(p.target_unit) ?? "Joki";
        updates.progress_count = 0;

        // Sama seperti order progress baru: tunggu tombol "Mulai orderan".
        // Jangan ganggu order yang sudah diproses / selesai.
        if (current.queue_status !== "processing" && current.queue_status !== "completed") {
          updates.queue_status = "waiting_confirm";
          updates.queue_position = null;
        }
      }

      if (!product && !username && !buyer) {
        updates.bot_refetch_error = "Halaman Itemku terbuka, tapi datanya tidak terbaca";
      }
    }

    const { error } = await supabaseAdmin.from("joki_orders").update(updates).eq("order_id", orderId);
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated: Object.keys(updates),
      became_progress: updates.order_type === "progress",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
