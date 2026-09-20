import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const subscription = await req.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { success: false, message: "Subscription invalid" },
        { status: 400 }
      );
    }

    // Simpan ke DB
    const { error } = await supabaseAdmin
  .from("push_subscriptions")
  .upsert(
    {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh || "",
      auth: subscription.keys?.auth || "",
      // updated_at dihapus
    },
    { onConflict: "endpoint" }
  );

    if (error) {
  console.error("❌ Subscribe error:", {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
  return NextResponse.json(
    { success: false, message: error.message },
    { status: 500 }
  );
}

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}