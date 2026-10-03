// app/api/fee-report/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ⭐ Konstanta — username yang boleh akses
const OWNER_USERNAMES = ["ellan"];   // ← tambahin kalau ada co-owner

export async function GET(request: Request) {
  try {
    // ══════════════════════════════════════════════════════════
    // ⭐ CEK AUTH — cuma owner yang boleh akses
    // Sesuaikan dengan sistem auth lo
    // ══════════════════════════════════════════════════════════
    
    // Opsi 1: Kalau pakai cookie session
    // const cookieStore = cookies();
    // const session = cookieStore.get("session")?.value;
    // ... validasi session, dapetin username ...
    
    // Opsi 2: Kalau ada header custom
    // const username = request.headers.get("x-username");
    
    // Sementara — gue kasih placeholder. Ganti sesuai auth lo.
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");   // ⚠️ INSECURE — cuma buat testing

    if (!username || !OWNER_USERNAMES.includes(username.toLowerCase())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    // ══════════════════════════════════════════════════════════
    // QUERY FEE LOG
    // ══════════════════════════════════════════════════════════
    const { data, error } = await supabaseAdmin
      .from("income_fee_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    // ══════════════════════════════════════════════════════════
    // AGGREGATE per joki
    // ══════════════════════════════════════════════════════════
    const grouped: Record<string, {
      joki_name: string;
      total_gross: number;
      total_fee: number;
      total_net: number;
      total_orders: number;
    }> = {};

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
      detail: data || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}