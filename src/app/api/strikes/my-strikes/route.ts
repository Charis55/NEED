import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyUserRequest } from "@/lib/userAuthGuard";
import { Strike } from "@/types/platform";

export async function GET(req: NextRequest) {
  try {
    const authCheck = await verifyUserRequest(req);
    if (authCheck.errorResponse) {
      return authCheck.errorResponse;
    }

    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get("userId");

    const isAdmin = authCheck.user.email === "obunezicharis@gmail.com";
    const effectiveUserId = isAdmin && requestedUserId ? requestedUserId : authCheck.user.uid;

    const strikesSnap = await adminDb
      .collection("strikes")
      .where("userId", "==", effectiveUserId)
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
