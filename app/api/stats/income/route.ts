import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStr = today.toISOString();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = monthStart.toISOString();

    // Ambil semua data bulan ini aja (biar query ringan)
    const { data, error } = await supabaseAdmin
      .from("income_log")
      .select("amount, joki_name, created_at, completed_at")
      .gte("created_at", monthStartStr)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    const rows = data || [];

    // Hitung agregat
    let hariIni = 0;
    let mingguIni = 0;
    let bulanIni = 0;
    const perJoki: Record<string, number> = {};

    for (const row of rows) {
      const amount = row.amount || 0;
      const dateRef = row.completed_at ? new Date(row.completed_at) : new Date(row.created_at);

      bulanIni += amount;

      if (dateRef >= weekAgo) {
        mingguIni += amount;
      }

      if (dateRef >= today) {
        hariIni += amount;
      }

      // Per joki
      const joki = row.joki_name || "lainnya";
      perJoki[joki] = (perJoki[joki] || 0) + amount;
    }

    return NextResponse.json({
      success: true,
      hariIni,
      mingguIni,
      bulanIni,
      perJoki,
      totalOrders: rows.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}