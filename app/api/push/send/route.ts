import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { title, body, url } = await req.json();

    if (!title || !body) {
      return NextResponse.json(
        { success: false, message: "Title & body wajib" },
        { status: 400 }
      );
    }

    const { data: subscriptions, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*");

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: "No subscribers" });
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || "/admin",
      icon: "/icon-192.png",
    });

    let sent = 0;
    let failed = 0;
    const toDelete: number[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
        sent++;
      } catch (error: any) {
        failed++;
        if (error.statusCode === 410 || error.statusCode === 404) {
          toDelete.push(sub.id);
        }
      }
    }

    // Hapus subscription yang expired
    if (toDelete.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("id", toDelete);
    }

    return NextResponse.json({ success: true, sent, failed });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}