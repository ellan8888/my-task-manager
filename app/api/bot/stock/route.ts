// app/api/bot/stock/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_API_KEY = process.env.BOT_API_KEY || "bot-secret-tokoku-2026-xYz123";

// ⭐ Manual mapping untuk kategori yang nggak bisa di-fuzzy match
const MANUAL_MAP: Record<string, string> = {
  "last map": "100 egg last map | steal an egg",
  "100 secret egg": "100 secret egg | steal an egg",
};

export async function GET(request: Request) {
  try {
    // ⭐ Auth
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

    // ⭐ 2. Query kategori_links (source utama)
    const { data: kategoriLinks, error: katErr } = await supabaseAdmin
      .from("kategori_links")
      .select("kategori, nama_produk")
      .order("kategori", { ascending: true });

    if (katErr) {
      console.error("[bot/stock] Kategori query error:", katErr);
      return NextResponse.json(
        { success: false, message: katErr.message },
        { status: 500 }
      );
    }

    // ⭐ 3. Build list base dari kategori_links
    //     + exact map buat fuzzy matching
    const exactMap: Record<string, string> = {};
    const fuzzyList: { key: string; nama: string }[] = [];
    const seenNama = new Set<string>();

    for (const row of kategoriLinks || []) {
      if (!row.kategori || !row.nama_produk) continue;

      // Bersihin <br> & normalisasi
      const rawKat = String(row.kategori).replace(/<br>/gi, "").trim();
      const key = rawKat.toLowerCase();

      exactMap[key] = row.nama_produk;

      // Skip duplikat nama_produk
      if (seenNama.has(row.nama_produk)) continue;
      seenNama.add(row.nama_produk);

      fuzzyList.push({ key, nama: row.nama_produk });
    }

    // ⭐ 4. Helper: exact + fuzzy match
    const findNamaProduk = (kat: string): string | null => {
      const k = kat.toLowerCase().trim();

      // 4a. Manual map dulu
      const manualKey = MANUAL_MAP[k];
      if (manualKey && exactMap[manualKey]) {
        return exactMap[manualKey];
      }

      // 4b. Exact match
      if (exactMap[k]) return exactMap[k];

      // 4c. Fuzzy: links.key diawali akun + separator
      for (const { key, nama } of fuzzyList) {
        if (key.startsWith(k + " ") || key.startsWith(k + "|")) {
          return nama;
        }
      }

      // 4d. Fuzzy terbalik
      for (const { key, nama } of fuzzyList) {
        if (k.startsWith(key + " ") || k.startsWith(key + "|")) {
          return nama;
        }
      }

      return null;
    };

    // ⭐ 5. Count stock per kategori (dari accounts_stock)
    const stockCount: Record<string, number> = {};
    for (const acc of accounts || []) {
      const kat = (acc.kategori || "").trim().toLowerCase();
      if (!kat) continue;
      stockCount[kat] = (stockCount[kat] || 0) + 1;
    }

    // ⭐ 6. Build result — base dari kategori_links (SEMUA kategori)
    //     + isi stock count (0 kalau nggak ada)
    const result = fuzzyList
      .map(({ key, nama }) => {
        // Coba match dengan stockCount
        // 1. Exact match
        let stock = stockCount[key] || 0;

        // 2. Kalau 0, coba fuzzy: ada kategori di stockCount yang match
        if (stock === 0) {
          for (const [stockKey, count] of Object.entries(stockCount)) {
            // Cek apakah stockKey match dengan key (exact atau fuzzy)
            if (
              stockKey === key ||
              key.startsWith(stockKey + " ") ||
              key.startsWith(stockKey + "|") ||
              stockKey.startsWith(key + " ") ||
              stockKey.startsWith(key + "|")
            ) {
              stock += count;
            }
          }
        }

        // 3. Manual map: kalau key ini di-manual-map, cari stock dari mapping
        for (const [akunKat, linkKat] of Object.entries(MANUAL_MAP)) {
          if (linkKat === key) {
            stock += stockCount[akunKat] || 0;
          }
        }

        return {
          kategori: key,
          nama_produk: nama,
          stock,
          price: 0,
        };
      })
      // Sort by numeric prefix
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