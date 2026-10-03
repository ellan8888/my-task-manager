// app/api/fee-report/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OWNER_USERNAMES = ["ellan"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username || !OWNER_USERNAMES.includes(username.toLowerCase())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    // ⭐ Ambil detail (buat ditampilin di tabel)
    const { data, error } = await supabaseAdmin
      .from("income_fee_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    // ⭐ Aggregate summary per joki
    const grouped: Record<string, any> = {};
    for (const row of data || []) {
      const key = row.joki_name.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = {
          joki_name: row.joki_name,
          total_gross: 0,
          total_fee: 0,
          total_net: 0,
          total_orders: 0,
        };
      }
      grouped[key].total_gross += row.gross_amount || 0;
      grouped[key].total_fee += row.fee_amount || 0;
      grouped[key].total_net += row.net_amount || 0;
      grouped[key].total_orders += 1;
    }

    return NextResponse.json({
      success: true,
      summary: Object.values(grouped),
      detail: data || [],       // ⭐ INI YANG KIRIM DETAIL
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}