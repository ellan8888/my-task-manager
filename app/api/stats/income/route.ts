// app/api/stats/income/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper verify signed cookie
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

export async function GET(req: NextRequest) {
  try {
    // ⭐ 1. Ambil session user
    const signedValue = req.cookies.get("auth_session")?.value;
    const session = signedValue
      ? verifySession(signedValue, process.env.AUTH_SECRET!)
      : null;

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // ⭐ 2. Query + FILTER by joki_name = user yang login
    const { data, error } = await supabaseAdmin
      .from("income_log")
      .select("amount, joki_name, created_at, completed_at")
      .gte("created_at", monthStart.toISOString())
      .eq("joki_name", session.username)              // ⭐ FILTER UTAMA
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    const rows = data || [];

    let hariIni = 0;
    let mingguIni = 0;
    let bulanIni = 0;
    const perJoki: Record<string, number> = {};

    for (const row of rows) {
      const amount = row.amount || 0;
      const dateRef = row.completed_at
        ? new Date(row.completed_at)
        : new Date(row.created_at);

      bulanIni += amount;

      if (dateRef >= weekAgo) {
        mingguIni += amount;
      }

      if (dateRef >= today) {
        hariIni += amount;
      }

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