import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Username diperlukan" },
        { status: 400 }
      );
    }

    const ramUrl = process.env.RAM_TUNNEL_URL;
    const ramPassword = process.env.RAM_PASSWORD;

    if (!ramUrl) {
      return NextResponse.json(
        { success: false, message: "RAM_TUNNEL_URL belum diset di Vercel" },
        { status: 500 }
      );
    }

    // Build URL ke RAM
    let targetUrl = `${ramUrl}/RemoveAccount?Account=${encodeURIComponent(username)}`;
    
    // Tambah password kalau ada
    if (ramPassword && ramPassword.length >= 6) {
      targetUrl += `&Password=${encodeURIComponent(ramPassword)}`;
    }

    console.log("Calling RAM:", targetUrl);

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: { 
        "Content-Type": "text/plain",
        "User-Agent": "MyTaskManager/1.0",
      },
      // Timeout 10 detik
      signal: AbortSignal.timeout(10000),
    });

    const text = await res.text();

    console.log("RAM response:", res.status, text);

    return NextResponse.json({
      success: res.ok,
      message: text,
      status: res.status,
    });
  } catch (error: any) {
    console.error("Error calling RAM:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || "Gagal menghubungi RAM",
        error: error.name,
      },
      { status: 500 }
    );
  }
}