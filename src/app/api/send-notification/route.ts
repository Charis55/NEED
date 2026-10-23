import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminApp_ } from "@/lib/firebaseAdmin";
import { getMessaging } from "firebase-admin/messaging";

export async function POST(req: NextRequest) {
  try {
    const { userId, title, body, data } = await req.json();

    if (!userId || !title || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Lookup recipient token: check users collection first, fallback to artisans collection
    let fcmToken: string | undefined = undefined;
    let pushEnabled = true;
    let collectionName = "users";

    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data()!;
      fcmToken = userData.fcmToken;
      pushEnabled = userData.preferences?.pushNotifications ?? true;
    }

    if (!fcmToken) {
      const artisanDoc = await adminDb.collection("artisans").doc(userId).get();
      if (artisanDoc.exists) {
        const artisanData = artisanDoc.data()!;
        fcmToken = artisanData.fcmToken;
        collectionName = "artisans";
      }
    }

    if (!fcmToken) {
      return NextResponse.json({ error: "No FCM token registered for recipient" }, { status: 404 });
    }

    if (fcmToken && /^[0-9a-fA-F]{64}$/.test(fcmToken)) {
      const { convertApnsToFcm } = await import("@/app/api/notifications/register-token/route");
      const converted = await convertApnsToFcm(fcmToken);
      if (converted) {
        fcmToken = converted;
        adminDb.collection(collectionName).doc(userId).update({ fcmToken: converted }).catch(() => {});
      }
    }

    let pushSuccess = false;

    if (fcmToken && pushEnabled) {
      // FCM requires ALL data values to be strings.
      const stringData: Record<string, string> = {
        title,
        body,
      };
      if (data && typeof data === "object") {
        for (const [key, value] of Object.entries(data)) {
          stringData[key] = String(value);
        }
      }

      try {
        // Only incoming call notifications are data-only on Android (so Java handles the ringing & action buttons).
        // On iOS (APNs), all notifications need alert { title, body } to show banner, with category for calls.
        const isIncomingCall = data?.type === "call";
        await getMessaging(adminApp_).send({
          token: fcmToken,
          ...(!isIncomingCall && {
            notification: { title, body },
          }),
          data: stringData,
          android: {
            priority: "high",
            ...(!isIncomingCall && {
              notification: {
                sound: "default",
                channelId: "high_priority_alerts",
                priority: "high",
                defaultSound: true,
                defaultVibrateTimings: true,
              },
            }),
          },
          apns: {
            headers: {
              "apns-priority": "10",
              "apns-push-type": "alert",
            },
            payload: {
              aps: {
                alert: { title, body },
                sound: "default",
                badge: 1,
                contentAvailable: true,
                category: isIncomingCall ? "INCOMING_CALL" : undefined,
              },
            },
          },
        });
        pushSuccess = true;
      } catch (e: any) {
        console.error("FCM Send failed:", e?.message || e);
        if (
          e?.code === "messaging/invalid-registration-token" ||
          e?.code === "messaging/registration-token-not-registered"
        ) {
          await adminDb.collection(collectionName).doc(userId).update({ fcmToken: "" });
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
