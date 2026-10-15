// app/api/redeem/request-transfer/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { username, proof_url, notes } = await request.json();

    if (!username || !proof_url) {
      return NextResponse.json(
        { success: false, message: "username & proof_url wajib" },
        { status: 400 }
      );
    }

    const user = username.toLowerCase().trim();

    // Cek apakah user masih punya pending
    const { data: existing } = await supabaseAdmin
      .from("redeem_purchases")
      .select("id")
      .eq("username", user)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Kamu masih punya request pending. Tunggu admin verify.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("redeem_purchases")
      .insert({
        username: user,
        amount: 20000,
        payment_method: "transfer",
        status: "pending",
        proof_url,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}