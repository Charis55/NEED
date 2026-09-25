/**
 * POST /api/verify — Create a Didit KYC verification session.
 *
 * The client sends: { userId: string }
 * The server creates a session with Didit and returns: { url, session_id }
 * The client then opens the `url` via the Didit Web SDK modal.
 *
 * The actual verification decision arrives via webhook (see /api/webhooks/didit).
 */

import { NextRequest, NextResponse } from "next/server";

// Per-session config — NOT a secret. "Free KYC" workflow from Didit console.
const WORKFLOW_ID = "12c4078f-34ef-4766-9dcb-e7718abab7d8";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vendorData = body.userId || "anonymous";

    const apiKey = process.env.DIDIT_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server misconfiguration: DIDIT_API_KEY not set" },
        { status: 500 }
      );
    }

    const res = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: WORKFLOW_ID,
        vendor_data: vendorData,
        // callback is where Didit redirects the user after completing the flow.
        // For the web SDK modal this isn't strictly needed (the modal closes itself),
        // but it's good practice and used as a fallback / cross-device flow.
        callback: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/onboarding`,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Didit session creation failed:", res.status, detail);
      return NextResponse.json(
        { error: "session_create_failed", detail },
        { status: 502 }
      );
    }

    const session = await res.json();

    // Only return what the client needs — never expose session_token or internals
    return NextResponse.json({
      url: session.url,
      session_id: session.session_id,
    });
  } catch (err: any) {
    console.error("Error creating Didit session:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create verification session" },
      { status: 500 }
    );
  }
}
