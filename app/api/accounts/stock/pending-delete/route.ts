// app/api/accounts/stock/pending-delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_API_KEY = process.env.BOT_API_KEY!;
const MAX_ATTEMPTS = 5;

export async function GET(req: NextRequest) {
  // ⭐ Auth bot
  if (req.headers.get("x-bot-api-key") !== BOT_API_KEY) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("accounts_stock")
    .select("id, username, kategori, status, delete_attempts")
    .eq("deleted", true)
    .in("delete_status", ["pending", "failed"])
    .lt("delete_attempts", MAX_ATTEMPTS)
    .order("delete_requested_at", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}