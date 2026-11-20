// app/api/version/route.ts — versi build yang sedang jalan di server (lihat vite.config.ts → __BUILD_ID__).
// VersionWatcher di browser membandingkannya dengan versinya sendiri; beda → ada versi baru, muat ulang.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

declare const __BUILD_ID__: string;

export function GET() {
  return NextResponse.json({ build: __BUILD_ID__ }, { headers: { "Cache-Control": "no-store" } });
}
