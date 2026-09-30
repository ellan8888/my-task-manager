import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_MANUAL_RETRY = 5;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json(
        { success: false, error: "order_id wajib diisi" },
        { status: 400 }
      );
    }

    // ⭐ Ambil data order dulu — cek manual_retry_count
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("joki_orders")
      .select("order_id, manual_retry_count, bot_process_failed")
      .eq("order_id", order_id)
      .maybeSingle();

    if (fetchError) {
      console.error("[API retry] Fetch error:", fetchError);
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: `Order ${order_id} tidak ditemukan` },
        { status: 404 }
      );
    }

    const currentRetry = order.manual_retry_count ?? 0;

    // ⭐ Cek limit retry
    if (currentRetry >= MAX_MANUAL_RETRY) {
      return NextResponse.json(
        {
          success: false,
          error: `Order udah di-retry ${currentRetry}x (max ${MAX_MANUAL_RETRY}x)`,
        },
        { status: 400 }
      );
    }

    // ⭐ Update flag — biar bot next loop proses ulang
    const { error: updateError } = await supabaseAdmin
      .from("joki_orders")
      .update({
        bot_retry_requested: true,
        manual_retry_count: currentRetry + 1,
      })
      .eq("order_id", order_id);

    if (updateError) {
      console.error("[API retry] Update error:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    console.log(
      `[API retry] ${order_id} retry requested (count: ${currentRetry + 1}/${MAX_MANUAL_RETRY})`
    );

    return NextResponse.json({
      success: true,
      message: `Order ${order_id} akan di-retry bot`,
      manual_retry_count: currentRetry + 1,
      max_retry: MAX_MANUAL_RETRY,
    });
  } catch (err) {
    console.error("[API retry] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}