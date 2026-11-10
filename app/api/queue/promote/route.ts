// app/api/queue/promote/route.ts — dipanggil bot (kunci bot) setelah ada slot kosong.
import { NextResponse } from "next/server";
import { promoteQueue } from "@/lib/queuePromote";

export const runtime = "nodejs";

export async function POST() {
  try {
    const r = await promoteQueue();
    return NextResponse.json({ success: true, ...r });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
