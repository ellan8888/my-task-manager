import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { order_id, token } = await request.json();

    if (!order_id || !token) {
      return NextResponse.json(
        { success: false, message: "order_id dan token wajib" },
        { status: 400 }
      );
    }

    // === 1. Cek order ===
    const { data: order, error } = await supabaseAdmin
      .from("joki_orders")
      .select("*")
      .eq("order_id", order_id)
      .maybeSingle();

    // Kalau nggak ketemu → mungkin admin udah hapus duluan
    if (error || !order) {
      return NextResponse.json({
        success: true,
        message: "Jokian sudah selesai & dikonfirmasi. Terimakasih!",
        already_completed: true,
      });
    }

    // === 2. Validasi token ===
    if (!order.confirm_token || order.confirm_token !== token) {
      return NextResponse.json(
        { success: false, message: "Token tidak valid" },
        { status: 401 }
      );
    }

    // === 3. Cek token expired ===
    if (order.token_expires_at && new Date(order.token_expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, message: "Token expired, hubungi admin" },
        { status: 401 }
      );
    }

    // === 4. Kalau udah dikonfirmasi ===
    if (order.buyer_confirmed) {
      return NextResponse.json({
        success: true,
        message: "Sudah dikonfirmasi sebelumnya",
        already_confirmed: true,
      });
    }

    // === 5. Set buyer_confirmed = true ===
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("joki_orders")
      .update({
        buyer_confirmed: true,
        buyer_confirmed_at: now,
      })
      .eq("order_id", order_id);

    if (updateError) {
      return NextResponse.json(
        { success: false, message: updateError.message },
        { status: 500 }
      );
    }

    console.log(`[Confirm] Buyer konfirmasi ${order_id}`);

    // === 6. AUTO-TRIGGER complete-order ===
    try {
      const completeRes = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/queue/complete-order`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id, token }),
        }
      );
      const completeData = await completeRes.json();
      console.log(`[Confirm] Auto-trigger result:`, completeData);
    } catch (err) {
      console.error("[Confirm] Auto-trigger error:", err);
      // Return success aja — card udah ditandai buyer_confirmed
      // Admin bisa close manual kalau perlu
    }

    return NextResponse.json({
      success: true,
      message: "Konfirmasi berhasil! Jokian selesai & card dihapus.",
      auto_closed: true,
    });
  } catch (err: any) {
    console.error("[Confirm] error:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}