/**
 * Firebase Admin SDK initializer.
 *
 * Uses the client SDK's project credentials directly (no service account needed).
 * For server-side operations, we verify user identity via their ID token.
 *
 * For full Admin auth operations (e.g. server-side deleteUser), you would need a
 * service account JSON. Here we use the Admin SDK for Firestore batch operations only.
 */

import { initializeApp as initAdminApp, getApps as getAdminApps, cert, App } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

let adminApp: App;

function getAdminApp(): App {
  const apps = getAdminApps();
  if (apps.length > 0) {
    return apps[0];
  }

  // Support service account JSON stored as env var (base64 encoded)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(
        Buffer.from(serviceAccountJson, "base64").toString("utf8")
      );
      return initAdminApp({ credential: cert(serviceAccount) });
    } catch (e) {
      console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON, falling back to projectId init.");
    }
  }

  // Minimal init — works for Firestore reads/writes in server context
  // (Auth token verification still possible with projectId only in some environments)
  return initAdminApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "momentum-b4215",
  });
}

export const adminApp_ = getAdminApp();
export const adminDb = getAdminFirestore(adminApp_);
export const adminAuth = getAdminAuth(adminApp_);
