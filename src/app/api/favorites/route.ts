import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { ArtisanProfile } from "@/types";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // 1. Fetch user document to get savedArtisans array
    const userDocRef = adminDb.collection("users").doc(userId);
    let userSnap = await userDocRef.get();
    let savedArtisans: string[] = [];

    if (userSnap.exists) {
      savedArtisans = userSnap.data()?.savedArtisans || [];
    } else {
      // Fallback: check artisans collection if user is a technician account
      const artisanSnap = await adminDb.collection("artisans").doc(userId).get();
      if (artisanSnap.exists) {
        savedArtisans = artisanSnap.data()?.savedArtisans || [];
      }
    }

    if (savedArtisans.length === 0) {
      return NextResponse.json({ success: true, favorites: [], savedIds: [] });
    }

    // 2. Fetch all saved artisans concurrently via adminDb
    const artisanPromises = savedArtisans.map(async (artisanId) => {
      try {
        const docRef = adminDb.collection("artisans").doc(artisanId);
        const snap = await docRef.get();
        if (snap.exists) {
          const data = snap.data()!;
          return {
            ...data,
            artisanId: data.artisanId || snap.id,
          } as ArtisanProfile;
        }

        // Fallback: query by field artisanId
        const qSnap = await adminDb
          .collection("artisans")
          .where("artisanId", "==", artisanId)
          .limit(1)
          .get();
        if (!qSnap.empty) {
          const d = qSnap.docs[0];
          return {
            ...d.data(),
            artisanId: d.data().artisanId || d.id,
          } as ArtisanProfile;
        }
        return null;
      } catch (e) {
        console.warn(`Error fetching favorite artisan ${artisanId}:`, e);
        return null;
      }
    });

    const results = await Promise.all(artisanPromises);
    const favorites = results.filter(Boolean) as ArtisanProfile[];

    return NextResponse.json({
      success: true,
      favorites,
      savedIds: savedArtisans,
    });
  } catch (err: any) {
    console.error("Error in GET /api/favorites:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, artisanId, action } = await req.json();

    if (!userId || !artisanId) {
      return NextResponse.json(
        { error: "userId and artisanId are required" },
        { status: 400 }
      );
    }

    const userDocRef = adminDb.collection("users").doc(userId);
    const userSnap = await userDocRef.get();

    if (action === "remove") {
      await userDocRef.set(
        { savedArtisans: FieldValue.arrayRemove(artisanId) },
        { merge: true }
      );
    } else {
      await userDocRef.set(
        { savedArtisans: FieldValue.arrayUnion(artisanId) },
        { merge: true }
      );
    }

    return NextResponse.json({ success: true, action, artisanId });
  } catch (err: any) {
    console.error("Error in POST /api/favorites:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update favorite" },
      { status: 500 }
    );
  }
}
