// app/api/admin/redeem/verify/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OWNER_USERNAMES = ["ellan"];

export async function POST(request: Request) {
  try {
    const { username, purchase_id, action, reject_reason } = await request.json();

    if (!OWNER_USERNAMES.includes(username?.toLowerCase())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    if (!purchase_id || !action) {
      return NextResponse.json(
        { success: false, message: "purchase_id & action wajib" },
        { status: 400 }
      );
    }

    const { data: purchase } = await supabaseAdmin
      .from("redeem_purchases")
      .select("*")
      .eq("id", purchase_id)
      .single();

    if (!purchase) {
      return NextResponse.json(
        { success: false, message: "Purchase nggak ketemu" },
        { status: 404 }
      );
    }

    // ═══════════════════════════════════════════════════════
    // REJECT
    // ═══════════════════════════════════════════════════════
    if (action === "reject") {
      await supabaseAdmin
        .from("redeem_purchases")
        .update({
          status: "rejected",
          rejected_reason: reject_reason || "Bukti nggak valid",
          approved_at: new Date().toISOString(),
          approved_by: username,
        })
        .eq("id", purchase_id);

      return NextResponse.json({ success: true });
    }

    // ═══════════════════════════════════════════════════════
    // APPROVE — auto-assign code RANDOM dari stock available
    // ═══════════════════════════════════════════════════════
    if (action === "approve") {
      // Prioritas 1: code yang di-assign ke user ini
      let code: any = null;

      const { data: ownCode } = await supabaseAdmin
        .from("redeem_codes")
        .select("id, code")
        .eq("username", purchase.username)
        .eq("status", "available")
        .limit(1)
        .maybeSingle();

      if (ownCode) code = ownCode;

      // Prioritas 2: code kosong
      if (!code) {
        const { data: anyCode } = await supabaseAdmin
          .from("redeem_codes")
          .select("id, code")
          .or(`username.is.null,username.eq.`)
          .eq("status", "available")
          .limit(1)
          .maybeSingle();

        if (anyCode) code = anyCode;
      }

      if (!code) {
        return NextResponse.json(
          { success: false, message: "Stock code kosong" },
          { status: 400 }
        );
      }

      // Update code → used
      await supabaseAdmin
        .from("redeem_codes")
        .update({
          username: purchase.username,
          status: "used",
          payment_method: "transfer",
          verified_by: username,
          used_at: new Date().toISOString(),
        })
        .eq("id", code.id);

      // Update purchase → approved
      await supabaseAdmin
        .from("redeem_purchases")
        .update({
          status: "approved",
          code_id: code.id,
          approved_at: new Date().toISOString(),
          approved_by: username,
        })
        .eq("id", purchase_id);

      return NextResponse.json({
        success: true,
        data: { assigned_code: code.code },
      });
    }

    return NextResponse.json(
      { success: false, message: "action harus approve / reject" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}