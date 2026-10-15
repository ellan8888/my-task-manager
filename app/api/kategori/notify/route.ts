// app/api/kategori/notify/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ⭐ URL bot Python lo (di PC)
const BOT_API_URL = process.env.BOT_API_URL || "http://localhost:5001";

export async function POST(request: Request) {
  try {
    const { kategori, nama_produk, image_url } = await request.json();

    if (!kategori || !nama_produk || !image_url) {
      return NextResponse.json(
        { success: false, message: "Data wajib lengkap" },
        { status: 400 }
      );
    }

    // ═══════════════════════════════════════════════════════
    // 1. SELALU simpan ke DB sebagai "pending" dulu
    // ═══════════════════════════════════════════════════════
    const { data: notifRow, error: insertError } = await supabaseAdmin
      .from("pending_product_notifs")
      .insert({
        kategori,
        nama_produk,
        image_url,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[Notify] Insert error:", insertError);
      return NextResponse.json(
        { success: false, message: insertError.message },
        { status: 500 }
      );
    }

    // ═══════════════════════════════════════════════════════
    // 2. Coba kirim ke bot (non-blocking)
    // ═══════════════════════════════════════════════════════
    let botSent = false;
    let botError = "";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const res = await fetch(`${BOT_API_URL}/api/notify-product`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kategori,
          nama_produk,
          image_url,
          notif_id: notifRow.id, // ⭐ Kirim notif_id biar bot bisa update status
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        botSent = true;
        // Update status jadi sent
        await supabaseAdmin
          .from("pending_product_notifs")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempts: 1,
          })
          .eq("id", notifRow.id);
      } else {
        botError = `HTTP ${res.status}`;
      }
    } catch (err: any) {
      botError = err.name === "AbortError" ? "Bot timeout (5s)" : err.message;
      console.warn("[Notify] Bot nggak respond:", botError);
    }

    // ═══════════════════════════════════════════════════════
    // 3. Response
    // ═══════════════════════════════════════════════════════
    return NextResponse.json({
      success: true,
      bot_sent: botSent,
      notif_id: notifRow.id,
      message: botSent
        ? "Terkirim ke Discord"
        : "Bot offline — notif disimpan, bakal dikirim otomatis saat bot online",
    });
  } catch (err: any) {
    console.error("[Notify] Exception:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}