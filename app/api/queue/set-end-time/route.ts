// app/api/queue/set-end-time/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // pakai service role biar bisa bypass RLS kalau perlu
);

export async function POST(request: Request) {
  // 1. Cek auth
  const cookieStore = await cookies();
  const session = cookieStore.get("auth_session")?.value;

  if (session !== process.env.AUTH_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // 2. Ambil body
  const { order_id, estimated_end_at } = await request.json();

  if (!order_id || !estimated_end_at) {
    return NextResponse.json(
      { message: "order_id dan estimated_end_at wajib diisi" },
      { status: 400 }
    );
  }

  // 3. Update Supabase
  const { error } = await supabase
    .from("joki_orders")
    .update({
      estimated_end_at,
      queue_status: "processing", // opsional: auto-set jadi processing
      processing_started_at: new Date().toISOString(),
    })
    .eq("order_id", order_id);

  if (error) {
    console.error("[SetEndTime] error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}