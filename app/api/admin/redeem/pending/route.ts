// app/api/admin/redeem/pending/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isRedeemOwner } from "@/lib/redeem";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const session = getSession(request);

    if (!isRedeemOwner(session)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("redeem_purchases")
      .select("*")
      .eq("status", "pending")
      .eq("payment_method", "transfer")
      .order("requested_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}