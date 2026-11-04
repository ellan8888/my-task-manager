// app/api/vziir0/accounts/route.ts
// Daftar akun Roblox yang menjalankan V-Ziir0 Hub (Break & Steal).
//   POST { user_id, username }  → daftar / perbarui last_seen
//   GET                         → semua akun yang aktif 30 hari terakhir
// Dilindungi kunci sederhana di header "x-hub-key" (VZIIR0_HUB_KEY di env Vercel).
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const HUB_KEY = process.env.VZIIR0_HUB_KEY || "vziir0-hub-key";
const ACTIVE_DAYS = 30;
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

function unauthorized(req: NextRequest) {
  const key = req.headers.get("x-hub-key") || req.nextUrl.searchParams.get("key");
  return key !== HUB_KEY;
}

export async function GET(req: NextRequest) {
  if (unauthorized(req)) {
    return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  }
  const since = new Date(Date.now() - ACTIVE_DAYS * 86400 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("vziir0_accounts")
    .select("user_id, username")
    .gte("last_seen", since)
    .order("last_seen", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, accounts: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (unauthorized(req)) {
    return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const userId = Number(body?.user_id);
    const username = String(body?.username ?? "");

    if (!Number.isSafeInteger(userId) || userId <= 0 || !USERNAME_RE.test(username)) {
      return NextResponse.json({ success: false, message: "user_id / username tidak valid" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("vziir0_accounts")
      .upsert(
        { user_id: userId, username, last_seen: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message ?? "error" }, { status: 500 });
  }
}
