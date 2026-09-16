import { NextResponse } from "next/server";

export async function GET() {
  try {
    const ramUrl = process.env.RAM_TUNNEL_URL;
    const ramPassword = process.env.RAM_PASSWORD;

    if (!ramUrl) {
      return NextResponse.json(
        { success: false, message: "RAM_TUNNEL_URL belum diset", accounts: [] },
        { status: 500 }
      );
    }

    let targetUrl = `${ramUrl}/GetAccountsList`;
    if (ramPassword && ramPassword.length >= 6) {
      targetUrl += `?Password=${encodeURIComponent(ramPassword)}`;
    }

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: { "Content-Type": "text/plain" },
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();

    return NextResponse.json({
      success: res.ok,
      accounts: Array.isArray(data) ? data : [],
    });
  } catch (error: any) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Gagal fetch accounts", accounts: [] },
      { status: 500 }
    );
  }
}