import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminApp_ } from "@/lib/firebaseAdmin";
import { getMessaging } from "firebase-admin/messaging";

export async function POST(req: NextRequest) {
  try {
    const { userId, title, body, data } = await req.json();

    if (!userId || !title || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const fcmToken = userData.fcmToken;
    const pushEnabled = userData.preferences?.pushNotifications ?? true;

    let pushSuccess = false;

    if (fcmToken && pushEnabled) {
      try {
        await getMessaging(adminApp_).send({
          token: fcmToken,
          notification: { title, body },
          data: data || {},
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channelId: "need_calls"
            }
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                contentAvailable: true
              }
            }
          }
        });
        pushSuccess = true;
      } catch (e) {
        console.error("FCM Send failed:", e);
      }
    }



    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error sending push notification:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send notification" },
      { status: 500 }
    );
  }
}
