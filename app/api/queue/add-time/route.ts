// app/api/queue/add-time/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  // 1. Cek auth
  const cookieStore = await cookies();
  const session = cookieStore.get("auth_session")?.value;

  if (session !== process.env.AUTH_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // 2. Ambil body
  const { order_id, add_minutes } = await request.json();

  if (!order_id || typeof add_minutes !== "number" || add_minutes <= 0) {
    return NextResponse.json(
      { message: "order_id dan add_minutes (angka > 0) wajib diisi" },
      { status: 400 }
    );
  }

  // 3. Ambil order sekarang
  const { data: order, error: fetchError } = await supabase
    .from("joki_orders")
    .select("estimated_end_at, schedule_date, schedule_time, queue_status")
    .eq("order_id", order_id)
    .maybeSingle();

  if (fetchError || !order) {
    return NextResponse.json(
      { message: "Order tidak ditemukan" },
      { status: 404 }
    );
  }

  // 4. Tentukan base time
  let baseTime: number;

  if (order.estimated_end_at) {
    baseTime = new Date(order.estimated_end_at).getTime();
  } else if (order.schedule_date && order.schedule_time) {
    // schedule_time dari DB bisa "13:00:00" — gabung jadi Date lokal WIB
    baseTime = new Date(
      `${order.schedule_date}T${order.schedule_time}+07:00`
    ).getTime();
  } else {
    baseTime = Date.now();
  }

  // 5. Hitung waktu baru
  const newEndTimeMs = baseTime + add_minutes * 60 * 1000;

  // 6. Format ke WIB — pakai offset manual biar nggak tergantung timezone server
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const wibTime = new Date(newEndTimeMs + WIB_OFFSET_MS);

  const pad = (n: number) => n.toString().padStart(2, "0");

  const year = wibTime.getUTCFullYear();
  const month = pad(wibTime.getUTCMonth() + 1);
  const day = pad(wibTime.getUTCDate());
  const hours = pad(wibTime.getUTCHours());
  const minutes = pad(wibTime.getUTCMinutes());
  const seconds = pad(wibTime.getUTCSeconds());

  const newScheduleDate = `${year}-${month}-${day}`;       // "2026-09-17"
  const newScheduleTime = `${hours}:${minutes}:${seconds}`; // "21:00:00"

  // estimated_end_at: simpan sebagai ISO UTC (Supabase timestamptz)
  const newEndTimeISO = new Date(newEndTimeMs).toISOString();

  // 7. Update semua field sekaligus
  const { error: updateError } = await supabase
    .from("joki_orders")
    .update({
      estimated_end_at: newEndTimeISO,
      schedule_date: newScheduleDate,
      schedule_time: newScheduleTime,
      queue_status: "processing",
      processing_started_at:
        order.queue_status === "processing"
          ? undefined
          : new Date().toISOString(),
    })
    .eq("order_id", order_id);

  if (updateError) {
    console.error("[AddTime] error:", updateError);
    return NextResponse.json({ message: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    new_estimated_end_at: newEndTimeISO,
    new_schedule_date: newScheduleDate,
    new_schedule_time: newScheduleTime,
  });
}