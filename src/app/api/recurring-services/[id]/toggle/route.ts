import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { optedIn } = body;

    if (typeof optedIn !== "boolean") {
      return NextResponse.json({ error: "Missing or invalid optedIn boolean" }, { status: 400 });
    }

    const docRef = adminDb.collection("recurringServices").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Recurring service not found" }, { status: 404 });
    }

    await docRef.update({ optedIn });

    return NextResponse.json({ success: true, optedIn });
  } catch (error: any) {
    console.error("Toggle recurring service error:", error);
    return NextResponse.json({ error: error.message || "Failed to toggle recurring service" }, { status: 500 });
  }
}
