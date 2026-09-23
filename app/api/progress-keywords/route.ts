// app/api/progress-keywords/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET() {
  try {
    // ★ Ambil dari Supabase table `progress_keywords`
    const { data, error } = await supabase
      .from("progress_keywords")
      .select("*")
      .order("keyword");
    
    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }
    
    // ★ Convert ke format dict
    const result: Record<string, any> = {};
    for (const row of data || []) {
      result[row.keyword] = {
        enabled: row.enabled,
        label: row.label,
        description: row.description,
        webhook_url: row.webhook_url,
      };
    }
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { keyword, label, description, enabled, webhook_url } = body;
    
    if (!keyword || !label) {
      return NextResponse.json(
        { success: false, message: "keyword & label wajib" },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from("progress_keywords")
      .upsert({
        keyword: keyword.toLowerCase().trim(),
        label,
        description: description || "",
        enabled: enabled !== false,
        webhook_url: webhook_url || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "keyword" });
    
    if (error) {
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