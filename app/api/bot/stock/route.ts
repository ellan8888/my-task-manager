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
    // ⭐ Auth — terima dari header ATAU query param (buat testing browser)
    const { searchParams } = new URL(request.url);
    const headerKey = request.headers.get("x-bot-api-key");
    const queryKey = searchParams.get("api_key");
    const apiKey = headerKey || queryKey;

    if (apiKey !== BOT_API_KEY) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    // ⭐ 1. Query stock dari accounts_stock (yang READY)
    const { data: accounts, error: stockErr } = await supabaseAdmin
      .from("accounts_stock")
      .select("kategori")
      .eq("used", true)
      .eq("logged_out", false)
      .eq("deleted", false);

    if (stockErr) {
      console.error("[bot/stock] Stock query error:", stockErr);
      return NextResponse.json(
        { success: false, message: stockErr.message },
        { status: 500 }
      );
    }

    // ⭐ 2. Query mapping kategori → nama_produk dari kategori_links
    const { data: kategoriLinks, error: katErr } = await supabaseAdmin
      .from("kategori_links")
      .select("kategori, nama_produk");

    if (katErr) {
      console.error("[bot/stock] Kategori query error:", katErr);
      // Tetap lanjut tanpa nama_produk (fallback ke kategori)
    }

    // ⭐ 3. Build mapping: kategori (lowercase, trimmed) → nama_produk
    const namaProdukMap: Record<string, string> = {};
    for (const row of kategoriLinks || []) {
      if (row.kategori && row.nama_produk) {
        namaProdukMap[row.kategori.toLowerCase().trim()] = row.nama_produk;
      }
    }

    // ⭐ 4. Count per kategori
    const stockCount: Record<string, number> = {};
    for (const acc of accounts || []) {
      const kat = (acc.kategori || "").trim().toLowerCase();
      if (!kat) continue;
      stockCount[kat] = (stockCount[kat] || 0) + 1;
    }

    // ⭐ 5. Build result — pake nama_produk kalau ada, fallback ke kategori
    const result = Object.entries(stockCount)
      .map(([kategori, stock]) => {
        const namaProduk = namaProdukMap[kategori] || kategori;

        return {
          kategori,                  // raw kategori (lowercase)
          nama_produk: namaProduk,   // ⭐ nama produk buat display
          stock,
          price: 0,                  // dummy dulu, nanti bisa diisi
        };
      })
      .sort((a, b) => {
        // ⭐ Sort by numeric prefix (1b-5b/s, 6b-10b/s, dst)
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