import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminApp_ } from "@/lib/firebaseAdmin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * Converts a 64-character APNs device token (iOS native) into a valid
 * FCM registration token using Google's batchImport API.
 */
export async function convertApnsToFcm(apnsToken: string): Promise<string | null> {
  try {
    const credToken = await adminApp_.options.credential?.getAccessToken();
    if (!credToken?.access_token) {
      console.warn("[convertApnsToFcm] Could not get service account access token");
      return null;
    }

    // Try sandbox first (for development/ad-hoc signed builds), fallback to production
    for (const sandbox of [true, false]) {
      try {
        const res = await fetch("https://iid.googleapis.com/iid/v1:batchImport", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credToken.access_token}`,
            "Content-Type": "application/json",
            access_token_auth: "true",
          },
          body: JSON.stringify({
            application: "com.chiduga.need",
            sandbox,
            apns_tokens: [apnsToken],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const firstResult = data?.results?.[0];
          if (firstResult?.status === "OK" && firstResult?.registration_token) {
            console.log(`[convertApnsToFcm] Successfully converted APNs token (sandbox=${sandbox}):`, firstResult.registration_token.substring(0, 15) + "...");
            return firstResult.registration_token;
          }
        }
      } catch (fetchErr) {
        console.warn(`[convertApnsToFcm] Fetch attempt with sandbox=${sandbox} failed:`, fetchErr);
      }
    }
  } catch (err) {
    console.warn("[convertApnsToFcm] Conversion error:", err);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { uid, token } = await req.json();

    if (!uid || !token) {
      return NextResponse.json({ error: "uid and token are required" }, { status: 400, headers: corsHeaders });
    }

    const trimmedToken = token.trim();
    let finalFcmToken = trimmedToken;
    let isApns = false;

    // Check if token is a 64-char hex APNs device token
    if (/^[0-9a-fA-F]{64}$/.test(trimmedToken)) {
      isApns = true;
      console.log(`[register-token] Received 64-char APNs device token for user ${uid}, converting to FCM token...`);
      const converted = await convertApnsToFcm(trimmedToken);
      if (converted) {
        finalFcmToken = converted;
      } else {
        console.warn("[register-token] APNs conversion returned null, keeping raw token as fallback");
      }
    }

    // Persist to users collection
    try {
      const userRef = adminDb.collection("users").doc(uid);
      const updateData: Record<string, any> = { fcmToken: finalFcmToken };
      if (isApns) {
        updateData.apnsToken = trimmedToken;
      }
      await userRef.set(updateData, { merge: true });
      console.log(`[register-token] Saved token to users/${uid}`);
    } catch (e) {
      console.warn(`[register-token] Failed saving to users/${uid}:`, e);
    }

    // Persist to artisans collection if document exists or created
    try {
      const artisanRef = adminDb.collection("artisans").doc(uid);
      const artisanSnap = await artisanRef.get();
      if (artisanSnap.exists) {
        const updateData: Record<string, any> = { fcmToken: finalFcmToken };
        if (isApns) {
          updateData.apnsToken = trimmedToken;
        }
        await artisanRef.set(updateData, { merge: true });
        console.log(`[register-token] Saved token to artisans/${uid}`);
      }
    } catch (e) {
      // Not an artisan — fine
    }

    return NextResponse.json({
      success: true,
      fcmToken: finalFcmToken,
      isApns,
    }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("[register-token] Error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500, headers: corsHeaders });
  }
}
