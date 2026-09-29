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
    let batch = adminDb.batch();
    let opCount = 0;

    for (const d of chunk) {
      batch.delete(d.ref);
      opCount++;
      if (opCount === 490) {
        await batch.commit();
        batch = adminDb.batch();
        opCount = 0;
      }
    }
    if (opCount > 0) {
      await batch.commit();
    }
  }
}

// ─── Firestore anonymize and cancel jobs helper ──────────────────────────────
async function anonymizeAndCancelJobs(fieldPath: string, uid: string, userType: "customer" | "technician") {
  const snap = await adminDb.collection("jobRequests").where(fieldPath, "==", uid).get();
  if (snap.empty) return;

  const chunks: FirebaseFirestore.QueryDocumentSnapshot[][] = [];
  for (let i = 0; i < snap.docs.length; i += 400) {
    chunks.push(snap.docs.slice(i, i + 400));
  }

  for (const chunk of chunks) {
    let batch = adminDb.batch();
    let opCount = 0;

    for (const d of chunk) {
      const data = d.data();
      const updateData: Record<string, unknown> = {};

      // Cancel if active
      if (["pending", "accepted", "in_progress"].includes(data.status)) {
        updateData.status = "cancelled";
        updateData.cancelledReason = `The ${userType} has deleted their account. This job cannot be completed.`;
        updateData.cancelledAt = new Date().toISOString();
      }

      // Anonymize
      if (userType === "customer") {
        updateData.customerName = "Deleted User";
        updateData.customerPhone = "";
      } else {
        updateData.artisanName = "Deleted Technician";
        updateData.artisanPhone = "";
      }

      batch.update(d.ref, updateData);
      opCount++;

      // Also we need to delete the messages this user sent within this job
      const msgs = await d.ref.collection("messages").where("senderId", "==", uid).get();
      for (const m of msgs.docs) {
        batch.delete(m.ref);
        opCount++;
        if (opCount >= 490) {
          await batch.commit();
          batch = adminDb.batch();
          opCount = 0;
        }
      }

      if (opCount >= 490) {
        await batch.commit();
        batch = adminDb.batch();
        opCount = 0;
      }
    }
    if (opCount > 0) {
      await batch.commit();
    }
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
    } catch {
      return NextResponse.json({ error: "Invalid or expired token. Please sign in again." }, { status: 401 });
    }

    // Check if an admin is requesting to delete another user
    const body = await req.json().catch(() => ({}));
    const targetUid = body.targetUid;

    if (targetUid && targetUid !== uid) {
      // Verify the requester is an admin
      const adminDoc = await adminDb.collection("users").doc(uid).get();
      const isAdmin = uid === "bl6OE9ODGGhIbtBo16JGqZaJ0YE2" || adminDoc.data()?.isAdmin === true;
      if (!isAdmin) {
        return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
      }
      uid = targetUid;
    }

    try {
      const userRecord = await adminAuth.getUser(uid);
      userEmail = userRecord.email;
      userName = userRecord.displayName || "User";
    } catch {
      // Auth user might already be missing, we can still attempt to clean up Firestore
      console.warn(`Auth user ${uid} not found, proceeding with DB cleanup.`);
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

      // Jobs: Anonymize and cancel active ones instead of deleting
      anonymizeAndCancelJobs("customerId", uid, "customer"),
      anonymizeAndCancelJobs("artisanId", uid, "technician"),

      // Collections with user references
      deleteCollection("reviews", "customerId", uid),
      deleteCollection("reviews", "artisanId", uid),
      deleteCollection("disputes", "reportedUserId", uid),
      deleteCollection("disputes", "reporterId", uid),

      // Also delete any top-level messages docs if they exist
      deleteCollection("messages", "senderId", uid),
      deleteCollection("messages", "recipientId", uid),
    ]);

    // ── 5. Delete Firebase Auth account ──────────────────────────────────────
    try {
      await adminAuth.deleteUser(uid);
    } catch (authErr) {
      console.warn("Failed to delete Firebase Auth user on server, relying on client-side deletion.", authErr);
    }

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
  } catch (err: unknown) {
    console.error("Error deleting account:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to delete account" },
      { status: 500 }
    );
  }
}
