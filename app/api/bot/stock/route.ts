// app/api/bot/stock/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_API_KEY = process.env.BOT_API_KEY || "bot-secret-tokoku-2026-xYz123";

export async function GET(request: Request) {
  try {
    // ⭐ Auth
    const apiKey = request.headers.get("x-bot-api-key");
    if (apiKey !== BOT_API_KEY) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    // ⭐ Query: cuma yang READY (siap dijual)
    const { data: accounts, error } = await supabaseAdmin
      .from("accounts_stock")
      .select("kategori")
      .eq("used", true)          // ← READY
      .eq("logged_out", false)   // ← masih aktif
      .eq("deleted", false);     // ← belum kehapus

    if (error) {
      console.error("[bot/stock] Query error:", error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    // ⭐ Count per kategori
    const stockCount: Record<string, number> = {};
    for (const acc of accounts || []) {
      const kat = (acc.kategori || "").trim().toLowerCase();
      if (!kat) continue;
      stockCount[kat] = (stockCount[kat] || 0) + 1;
    }

    // ⭐ Convert ke array + sort by numeric prefix (biar urut 1b-5b/s, 10b-15b/s, dst)
    const result = Object.entries(stockCount)
      .map(([kategori, stock]) => ({ kategori, stock, price: 0 }))
      .sort((a, b) => {
        const numA = parseInt(a.kategori.match(/^\d+/)?.[0] || "999999", 10);
        const numB = parseInt(b.kategori.match(/^\d+/)?.[0] || "999999", 10);
        if (numA !== numB) return numA - numB;
        return a.kategori.localeCompare(b.kategori);
      });

    return NextResponse.json({
      success: true,
      count: result.length,
      data: result,
      updated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[bot/stock] Error:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}