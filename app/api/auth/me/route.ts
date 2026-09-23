// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function verifySession(
  signedValue: string,
  secret: string
): Record<string, any> | null {
  const parts = signedValue.split(".");
  if (parts.length < 2) return null;

  const signature = parts[parts.length - 1];
  const value = parts.slice(0, -1).join(".");

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(value);
  const expectedSig = hmac.digest("hex");

  if (signature !== expectedSig) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const signedValue = req.cookies.get("auth_session")?.value;
    if (!signedValue) {
      return NextResponse.json(
        { success: false, message: "Belum login" },
        { status: 401 }
      );
    }

    const session = verifySession(signedValue, process.env.AUTH_SECRET!);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Session invalid" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.id,
        username: session.username,
        display_name: session.display_name,
        role: session.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}