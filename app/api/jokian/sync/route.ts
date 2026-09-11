import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      order_id,
      buyer_name,
      product,    
      joki_name,
      schedule_date,
      schedule_time,
      note,
    } = body;

    // Validasi data wajib
    if (
      !order_id ||
      !schedule_date ||
      !schedule_time
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "order_id, schedule_date, dan schedule_time wajib diisi.",
        },
        { status: 400 }
      );
    }

    // Masukkan / update data berdasarkan order_id
    const { data, error } = await supabaseAdmin
  .from("joki_orders")
  .upsert(
    {
      order_id,
      buyer_name: buyer_name || null,
      product: product || null,
      joki_name: joki_name || null,
      schedule_date,
      schedule_time,
      note: note || null,
    },
    {
      onConflict: "order_id",
    }
  )
  .select()
  .single();

    if (error) {
      console.error(
        "❌ Gagal sync Jokian:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Jokian berhasil disinkronkan.",
      data,
    });
  } catch (error: any) {
    console.error(
      "❌ API Jokian error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error.message ||
          "Terjadi kesalahan pada API.",
      },
      { status: 500 }
    );
  }
}