import { NextResponse } from "next/server";

export async function POST() {
  try {
    const restartUrl = process.env.BOT_RESTART_URL;
    const secret = process.env.BOT_RESTART_SECRET;

    if (!restartUrl || !secret) {
      return NextResponse.json(
        { success: false, message: "Restart URL belum di-set" },
        { status: 500 }
      );
    }

    const res = await fetch(restartUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Secret": secret,
      },
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Gagal restart: ${err.message}` },
      { status: 500 }
    );
  }
}