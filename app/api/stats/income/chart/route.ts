// app/api/stats/income/chart/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifySession(
  signedValue: string,
  secret: string
): Record<string, any> | null {
  const parts = signedValue.split(".");
  if (parts.length < 2) return null;
  const signature = parts[parts.length - 1];
  const value = parts.slice(0, -1).join(".");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(value);
  if (signature !== hmac.digest("hex")) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// ⭐ Helper: format Date ke YYYY-MM-DD dalam timezone WIB (Asia/Jakarta)
function toWIBDateStr(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  // en-CA → format YYYY-MM-DD
}

export async function GET(request: NextRequest) {
  try {
    // 1. Ambil session user
    const signedValue = request.cookies.get("auth_session")?.value;
    const session = signedValue
      ? verifySession(signedValue, process.env.AUTH_SECRET!)
      : null;

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7");

    // ⭐ 2. Hitung range pakai WIB (bukan UTC)
    // Ambil "sekarang" dalam WIB
    const nowWIB = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
    );
    nowWIB.setHours(23, 59, 59, 999);

    const startWIB = new Date(nowWIB);
    startWIB.setDate(startWIB.getDate() - (days - 1));
    startWIB.setHours(0, 0, 0, 0);

    // Konversi WIB → UTC buat query (karena DB nyimpen UTC)
    // WIB = UTC+7, jadi WIB - 7 jam = UTC
    const startUTC = new Date(startWIB.getTime() - 7 * 60 * 60 * 1000);
    const endUTC = new Date(nowWIB.getTime() - 7 * 60 * 60 * 1000);

    // ⭐ 3. Query — pakai created_at (fallback kalau completed_at NULL)
    const { data, error } = await supabaseAdmin
      .from("income_log")
      .select("amount, completed_at, created_at")
      .gte("created_at", startUTC.toISOString())
      .lte("created_at", endUTC.toISOString())
      .eq("joki_name", session.username)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    // ⭐ 4. Group by date pakai WIB
    const grouped: Record<string, { date: string; total: number; count: number }> = {};

    // Inisialisasi semua tanggal dalam range (pakai WIB date string)
    for (let i = 0; i < days; i++) {
      const d = new Date(startWIB);
      d.setDate(d.getDate() + i);
      const dateStr = toWIBDateStr(d);
      grouped[dateStr] = { date: dateStr, total: 0, count: 0 };
    }

    // Isi data — konversi timestamp ke WIB dulu
    for (const row of data || []) {
      const refDate = row.completed_at || row.created_at;
      const dateStr = toWIBDateStr(new Date(refDate));
      if (grouped[dateStr]) {
        grouped[dateStr].total += row.amount || 0;
        grouped[dateStr].count += 1;
      }
    }

    const chartData = Object.values(grouped).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return NextResponse.json({
      success: true,
      data: chartData,
      days,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}