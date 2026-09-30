import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      order_id,
      insert_income,
      amount,
      joki_name,
      product_title,
    } = body;

    if (!order_id) {
      return NextResponse.json(
        { success: false, error: "order_id wajib diisi" },
        { status: 400 }
      );
    }

    // ⭐ Optional: insert income dulu sebelum hapus
    let incomeInserted = false;
    if (insert_income && amount > 0) {
      try {
        const { error: incomeError } = await supabaseAdmin
          .from("income_log")
          .insert({
            order_id,
            joki_name: joki_name || "ellan",
            product_title: product_title || "-",
            amount,
            completed_at: new Date().toISOString(),
          });

        if (incomeError) {
          console.warn("[API delete] Gagal insert income:", incomeError);
          // Lanjut aja — jangan block hapus
        } else {
          incomeInserted = true;
          console.log(`[API delete] Income ${order_id} → Rp ${amount} inserted`);
        }
      } catch (err) {
        console.warn("[API delete] Income insert error:", err);
      }
    }

    // ⭐ Hapus order dari joki_orders
    const { error: deleteError } = await supabaseAdmin
      .from("joki_orders")
      .delete()
      .eq("order_id", order_id);

    if (deleteError) {
      console.error("[API delete] Delete error:", deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    console.log(`[API delete] ${order_id} deleted (income: ${incomeInserted})`);

    return NextResponse.json({
      success: true,
      message: `Order ${order_id} dihapus`,
      income_inserted: incomeInserted,
    });
  } catch (err) {
    console.error("[API delete] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}