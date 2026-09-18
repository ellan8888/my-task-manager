import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7"); // Default 7 hari

    // Hitung tanggal mulai
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    // Query data
    const { data, error } = await supabaseAdmin
      .from("income_log")
      .select("amount, completed_at")
      .gte("completed_at", startDate.toISOString())
      .lte("completed_at", today.toISOString())
      .order("completed_at", { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Group by date (WIB / Asia/Jakarta)
    const grouped: Record<string, { date: string; total: number; count: number }> = {};

    // Inisialisasi semua tanggal (biar ada tanggal kosong juga di grafik)
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      grouped[dateStr] = { date: dateStr, total: 0, count: 0 };
    }

    // Isi data dari Supabase
    for (const row of data || []) {
      const d = new Date(row.completed_at);
      const dateStr = d.toISOString().split("T")[0];
      if (grouped[dateStr]) {
        grouped[dateStr].total += row.amount || 0;
        grouped[dateStr].count += 1;
      }
    }

    // Convert ke array & sort
    const chartData = Object.values(grouped).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return NextResponse.json({
      success: true,
      data: chartData,
      days,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}