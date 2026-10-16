import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_API_KEY = process.env.BOT_API_KEY || "bot-secret-tokoku-2026-xYz123";

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get("x-bot-api-key");
    if (apiKey !== BOT_API_KEY) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const { prices } = await request.json();
    if (!prices || typeof prices !== "object") {
      return NextResponse.json({ success: false, message: "prices wajib object" }, { status: 400 });
    }

    const { data: kategoriLinks, error } = await supabaseAdmin
      .from("kategori_links")
      .select("id, kategori, nama_produk");

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    let updated = 0;
    const notFound: string[] = [];

    for (const [itemkuName, price] of Object.entries(prices)) {
      const itemkuLower = itemkuName.toLowerCase().trim();
      let matchedId: number | null = null;

      for (const row of kategoriLinks || []) {
        const nama = (row.nama_produk || "").toLowerCase().trim();
        const kat = (row.kategori || "").toLowerCase().trim();

        if (
          nama === itemkuLower ||
          kat === itemkuLower ||
          nama.includes(itemkuLower) ||
          itemkuLower.includes(nama)
        ) {
          matchedId = row.id;
          break;
        }
      }

      if (matchedId === null) {
        notFound.push(itemkuName);
        continue;
      }

      const { error: updateErr } = await supabaseAdmin
        .from("kategori_links")
        .update({ price: Number(price) })
        .eq("id", matchedId);

      if (!updateErr) updated++;
    }

    return NextResponse.json({
      success: true,
      updated,
      total: Object.keys(prices).length,
      not_found: notFound.slice(0, 10),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}