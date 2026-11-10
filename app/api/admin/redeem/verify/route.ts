// app/api/admin/redeem/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { claimCode, isRedeemOwner, releaseCode } from "@/lib/redeem";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


export async function POST(request: NextRequest) {
  try {
    const { purchase_id, action, reject_reason } = await request.json();
    const session = getSession(request);
    const username = session?.username || "";

    if (!isRedeemOwner(session)) {
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

    // Sudah diproses sebelumnya (mis. tombol diklik dua kali) → jangan kasih code lagi
    if (purchase.status !== "pending") {
      return NextResponse.json(
        { success: false, message: `Pengajuan ini sudah ${purchase.status === "approved" ? "disetujui" : "ditolak"}` },
        { status: 409 }
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
        .eq("id", purchase_id)
        .eq("status", "pending");

      return NextResponse.json({ success: true });
    }

    // ═══════════════════════════════════════════════════════
    // APPROVE — auto-assign code RANDOM dari stock available
    // ═══════════════════════════════════════════════════════
    if (action === "approve") {
      // Kunci 1 code secara aman (prioritas code milik user, lalu code bebas)
      const code = await claimCode(purchase.username, "transfer");
      if (!code) {
        return NextResponse.json(
          { success: false, message: "Stock code kosong" },
          { status: 400 }
        );
      }

      // Setujui hanya kalau MASIH pending — klik dobel tidak menghabiskan 2 code
      const { data: approved } = await supabaseAdmin
        .from("redeem_purchases")
        .update({
          status: "approved",
          code_id: code.id,
          approved_at: new Date().toISOString(),
          approved_by: username,
        })
        .eq("id", purchase_id)
        .eq("status", "pending")
        .select("id");
      if (!approved?.length) {
        await releaseCode(code.id, code.prevUsername);
        return NextResponse.json(
          { success: false, message: "Pengajuan ini sudah diproses" },
          { status: 409 }
        );
      }
      await supabaseAdmin.from("redeem_codes").update({ verified_by: username }).eq("id", code.id);

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