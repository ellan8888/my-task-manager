import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifySession(signedValue: string, secret: string) {
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

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("auth_session")?.value;
    const parsed = session
      ? verifySession(session, process.env.AUTH_SECRET!)
      : null;

    if (!parsed) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const jokiName = parsed.username;

    // Total income all-time
    const { data: incomeData, error } = await supabaseAdmin
      .from("income_log")
      .select("amount")
      .eq("joki_name", jokiName);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const totalIncome = (incomeData || []).reduce(
      (sum, r) => sum + (r.amount || 0),
      0
    );

    return NextResponse.json({
      success: true,
      joki_name: jokiName,
      total: totalIncome,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}