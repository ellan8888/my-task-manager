import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifySession(signedValue: string, secret: string) {
  const parts = signedValue.split(".");
  if (parts.length < 2) return null;
  const signature = parts[parts.length - 1];
  const value = parts.slice(0, -1).join(".");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(value);
  if (signature !== hmac.digest("hex")) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1️⃣ Auth — cuma superadmin
    const cookieStore = await cookies();
    const session = cookieStore.get("auth_session")?.value;
    const parsed = session
      ? verifySession(session, process.env.AUTH_SECRET!)
      : null;

    if (!parsed || parsed.role !== "superadmin") {
      return NextResponse.json(
        { success: false, message: "Cuma superadmin" },
        { status: 403 }
      );
    }

    // 2️⃣ Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const withdrawalId = formData.get("withdrawalId") as string;

    if (!file || !withdrawalId) {
      return NextResponse.json(
        { success: false, message: "File & withdrawalId wajib" },
        { status: 400 }
      );
    }

    // 3️⃣ Validasi tipe & size
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, message: "File harus gambar (JPG/PNG)" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "Max 5MB" },
        { status: 400 }
      );
    }

    // 4️⃣ Upload ke Supabase Storage
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `wd-${withdrawalId}-${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("payment-proofs")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[Upload] Error:", uploadError);
      return NextResponse.json(
        { success: false, error: uploadError.message },
        { status: 500 }
      );
    }

    // 5️⃣ Ambil public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("payment-proofs")
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
    });
  } catch (err: any) {
    console.error("[Upload] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}