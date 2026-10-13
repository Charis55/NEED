import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Strike } from "@/types/platform";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const strikesSnap = await adminDb
      .collection("strikes")
      .where("userId", "==", userId)
      .get();

    const strikes: Strike[] = strikesSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        strikeId: doc.id,
        ...data
      } as Strike;
    });

    // Sort by newest first in memory to avoid needing a Firestore composite index
    strikes.sort((a, b) => b.issuedAt - a.issuedAt);

    return NextResponse.json({ strikes });
  } catch (error: any) {
    console.error("Error fetching user strikes:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
