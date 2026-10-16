// app/api/admin/redeem/add-stock/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OWNER_USERNAMES = ["ellan"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, code, codes, target_username, notes } = body;

    // ⭐ Auth check
    if (!OWNER_USERNAMES.includes(username?.toLowerCase())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    // ⭐ Support 2 format:
    // - `codes`: array (bulk, dari frontend baru)
    // - `code`: string (single, backward compat)
    let codeList: string[] = [];

    if (Array.isArray(codes)) {
      codeList = codes;
    } else if (typeof code === "string" && code.trim()) {
      codeList = [code];
    }

    // Normalize: uppercase, trim, buang kosong
    codeList = codeList
      .map((c: string) => String(c).toUpperCase().trim())
      .filter((c: string) => c.length > 0);

    // Hapus duplikat dalam input
    codeList = Array.from(new Set(codeList));

    if (codeList.length === 0) {
      return NextResponse.json(
        { success: false, message: "Minimal 1 code wajib" },
        { status: 400 }
      );
    }

    // ⭐ Cek duplikat di DB (biar nggak error constraint)
    const { data: existing, error: checkErr } = await supabaseAdmin
      .from("redeem_codes")
      .select("code")
      .in("code", codeList);

    if (checkErr) {
      console.error("[add-stock] Check existing error:", checkErr);
      return NextResponse.json(
        { success: false, message: checkErr.message },
        { status: 500 }
      );
    }

    const existingSet = new Set(
      (existing || []).map((r: any) => r.code)
    );
    const newCodes = codeList.filter((c) => !existingSet.has(c));

    if (newCodes.length === 0) {
      return NextResponse.json({
        success: false,
        message: `Semua code udah ada di DB (${codeList.length} duplikat)`,
      });
    }

    // ⭐ Bulk insert
    const targetUsername = target_username?.toLowerCase().trim() || null;

    const rows = newCodes.map((code) => ({
      code,
      username: targetUsername,
      status: "available",
      price: 20000,
      notes: notes || null,
    }));

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("redeem_codes")
      .insert(rows)
      .select();

    if (insertErr) {
      console.error("[add-stock] Insert error:", insertErr);
      return NextResponse.json(
        { success: false, message: insertErr.message },
        { status: 500 }
      );
    }

    const skipped = codeList.length - newCodes.length;

    console.log(
      `✅ [add-stock] Inserted ${inserted?.length || 0} codes, skipped ${skipped}`
    );

    return NextResponse.json({
      success: true,
      data: {
        inserted: inserted?.length || 0,
        skipped,
        codes: inserted?.map((r: any) => r.code) || [],
        // Backward compat: kalau cuma 1 code, kirim juga `code`
        code: inserted?.[0]?.code,
      },
    });
  } catch (err: any) {
    console.error("[add-stock] Error:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}