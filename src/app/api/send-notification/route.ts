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

    if (!fcmToken || !pushEnabled) {
      return NextResponse.json({ success: true, message: "User disabled notifications or has no token" });
    }

    // This requires FIREBASE_SERVICE_ACCOUNT_JSON env var to be set for the admin SDK to authenticate!
    await getMessaging(adminApp_).send({
      token: fcmToken,
      notification: { title, body },
      data: data || {},
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error sending push notification:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send notification" },
      { status: 500 }
    );
  }
}
