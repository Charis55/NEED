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
      // FCM requires ALL data values to be strings.
      // If any value is a number, boolean, or object, the entire send silently fails.
      const stringData: Record<string, string> = {};
      if (data && typeof data === "object") {
        for (const [key, value] of Object.entries(data)) {
          stringData[key] = String(value);
        }
      }

      try {
        await getMessaging(adminApp_).send({
          token: fcmToken,
          // The notification block is what makes Android auto-display
          // a visual banner. Without it, messages are "data-only" and
          // Android will NOT show anything to the user.
          notification: { title, body },
          data: stringData,
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channelId: "default",
              // HIGH priority gives heads-up banner on Android
              priority: "high",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                contentAvailable: true,
              },
            },
          },
        });
        pushSuccess = true;
      } catch (e: any) {
        console.error("FCM Send failed:", e?.message || e);
        // If the token is invalid/expired, clean it up so we don't keep failing
        if (
          e?.code === "messaging/invalid-registration-token" ||
          e?.code === "messaging/registration-token-not-registered"
        ) {
          await adminDb.collection("users").doc(userId).update({ fcmToken: "" });
        }
      }
    }

    return NextResponse.json({ success: true, pushSent: pushSuccess });
  } catch (err: any) {
    console.error("Error sending push notification:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send notification" },
      { status: 500 }
    );
  }
}
