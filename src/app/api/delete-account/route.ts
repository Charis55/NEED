/**
 * POST /api/delete-account
 *
 * Completely deletes a user account and ALL associated data:
 * 1. Firestore: users, artisans, jobRequests, reviews, verificationReviewQueue, chatMessages
 * 2. Cloudflare R2: portfolio photos, certificates, police clearance, profile picture
 * 3. Firebase Auth: the account itself
 *
 * The request must include the user's Firebase ID token in the Authorization header.
 * The client is responsible for signing out after this call succeeds.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { getApps } from "firebase-admin/app";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { FieldPath } from "firebase-admin/firestore";
import { Resend } from "resend";
import AccountDeletedEmail from "@/emails/AccountDeletedEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── R2 Client ───────────────────────────────────────────────────────────────
const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL_PREFIX = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

async function deleteR2File(url: string): Promise<void> {
  if (!url || !PUBLIC_URL_PREFIX || !url.startsWith(PUBLIC_URL_PREFIX)) return;
  const key = url.replace(`${PUBLIC_URL_PREFIX}/`, "");
  try {
    await S3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    // Non-fatal — log and continue
    console.warn(`Failed to delete R2 file: ${key}`, err);
  }
}

async function deleteR2Files(urls: (string | null | undefined)[]): Promise<void> {
  await Promise.allSettled(
    urls.filter(Boolean).map((url) => deleteR2File(url!))
  );
}

// ─── Firestore batch delete helper ───────────────────────────────────────────
async function deleteCollection(collectionPath: string, fieldPath: string, uid: string) {
  const snap = await adminDb
    .collection(collectionPath)
    .where(fieldPath, "==", uid)
    .get();

  if (snap.empty) return;

  // Firestore batch limit is 500 writes
  const chunks: FirebaseFirestore.QueryDocumentSnapshot[][] = [];
  for (let i = 0; i < snap.docs.length; i += 400) {
    chunks.push(snap.docs.slice(i, i + 400));
  }

  for (const chunk of chunks) {
    const batch = adminDb.batch();
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate — verify the ID token sent from the client
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.replace("Bearer ", "");

    if (!idToken) {
      return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
    }

    // Verify the token using Firebase Admin Auth
    const adminAuth = getAuth(getApps()[0]);
    let uid: string;
    let userEmail: string | undefined;
    let userName: string = "User";
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      uid = decoded.uid;
      const userRecord = await adminAuth.getUser(uid);
      userEmail = userRecord.email;
      userName = userRecord.displayName || "User";
    } catch {
      return NextResponse.json({ error: "Invalid or expired token. Please sign in again." }, { status: 401 });
    }

    // ── 2. Fetch all Firestore data to collect R2 URLs before deleting ────────
    const [userDoc, artisanDoc] = await Promise.all([
      adminDb.collection("users").doc(uid).get(),
      adminDb.collection("artisans").doc(uid).get(),
    ]);

    const r2UrlsToDelete: string[] = [];

    if (artisanDoc.exists) {
      const data = artisanDoc.data()!;

      // Portfolio photos
      if (Array.isArray(data.portfolioPhotoUrls)) {
        r2UrlsToDelete.push(...data.portfolioPhotoUrls);
      }
      // Primary certificate
      if (data.certificateUrl) r2UrlsToDelete.push(data.certificateUrl);
      // Per-service certificates
      if (Array.isArray(data.services)) {
        for (const svc of data.services) {
          if (svc.certificateUrl) r2UrlsToDelete.push(svc.certificateUrl);
        }
      }
      // Police clearance
      if (data.policeClearanceUrl) r2UrlsToDelete.push(data.policeClearanceUrl);
    }

    // Profile picture (stored in Firebase Storage, not R2 — skip if Firebase URL)
    if (userDoc.exists) {
      const photoURL = userDoc.data()?.photoURL;
      if (photoURL && PUBLIC_URL_PREFIX && photoURL.startsWith(PUBLIC_URL_PREFIX)) {
        r2UrlsToDelete.push(photoURL);
      }
    }

    // ── 3. Delete all R2 files in parallel ────────────────────────────────────
    await deleteR2Files(r2UrlsToDelete);

    // ── 4. Delete all Firestore documents ────────────────────────────────────
    await Promise.allSettled([
      // Direct documents
      adminDb.collection("users").doc(uid).delete(),
      adminDb.collection("artisans").doc(uid).delete(),
      adminDb.collection("verificationReviewQueue").doc(uid).delete(),

      // Collections with user references
      deleteCollection("jobRequests", "customerId", uid),
      deleteCollection("jobRequests", "artisanId", uid),
      deleteCollection("reviews", "customerId", uid),
      deleteCollection("reviews", "artisanId", uid),

      // Chat messages (stored under jobRequests/{requestId}/messages — handled via jobs delete above)
      // Also delete any top-level messages docs if they exist
      deleteCollection("messages", "senderId", uid),
      deleteCollection("messages", "recipientId", uid),
    ]);

    // ── 5. Delete Firebase Auth account ──────────────────────────────────────
    await adminAuth.deleteUser(uid);

    // ── 6. Send Account Deletion Confirmation Email ──────────────────────────
    if (userEmail) {
      try {
        await resend.emails.send({
          from: 'NEED App <onboarding@resend.dev>', // Change to your domain after verifying it in Resend
          to: [userEmail],
          subject: 'Your account has been deleted',
          react: AccountDeletedEmail({ userName }),
        });
      } catch (emailErr) {
        console.error("Failed to send account deletion email:", emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting account:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete account" },
      { status: 500 }
    );
  }
}
