/**
 * Firebase Admin SDK initializer.
 *
 * Uses the client SDK's project credentials directly (no service account needed).
 * For server-side operations, we verify user identity via their ID token.
 *
 * For full Admin auth operations (e.g. server-side deleteUser), you would need a
 * service account JSON. Here we use the Admin SDK for Firestore batch operations only.
 */

import { initializeApp as initAdminApp, getApps as getAdminApps, cert } from "firebase-admin/app";
import type { App } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let _adminApp: App | null = null;
let _adminDb: Firestore | null = null;

export function getAdminApp(): App {
  if (_adminApp) return _adminApp;

  const apps = getAdminApps();
  if (apps.length > 0) {
    _adminApp = apps[0];
    return _adminApp;
  }

  // 1. Support service account JSON stored as env var (base64 encoded)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(
        Buffer.from(serviceAccountJson, "base64").toString("utf8")
      );
      _adminApp = initAdminApp({ credential: cert(serviceAccount) });
      return _adminApp;
    } catch (e) {
      console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON, falling back...");
    }
  }

  // 2. Try to load from a local file (for local development)
  try {
    const localPath = path.join(process.cwd(), "serviceAccountKey.json");
    if (fs.existsSync(localPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(localPath, "utf8"));
      _adminApp = initAdminApp({ credential: cert(serviceAccount) });
      return _adminApp;
    }
  } catch (e) {
    // Expected in production/Vercel
  }

  // 3. Embedded service account credentials fallback for production environments (Vercel)
  try {
    const embeddedServiceAccount = {
      projectId: "momentum-b4215",
      clientEmail: "firebase-adminsdk-fbsvc@momentum-b4215.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDy25Uo3alpIDhj\nP108EHpWEvBD8JE6sgjA1Va77lXN4R35h/6B+A6rSkOiSx5+8qaPaQkfO+JnCtWw\nMDJ6ZQfx7cicEjHY/fsdssm3kqSmzgYvySfuC5T17kSzyxjXSDbWx6VavBcchsBY\nMMGlH1KLfVpD4sGWU7e2eETZJaQgB4fqyRNEWhObRES8aPvg9FUBa4t3kkn2Xpug\niLH5vB7tD/TXZ6fqxcuJ3HqIg/nONuyANPCuooJxLNIMe0BvQ3CViRGAWjRY2Qkl\nFO7fEdr+U2YeA+GhzStwDWakq5lDNIbaHLC9/xWOTGOsbUPZJTi6WkKpusn4AHzO\nVZ+0adxFAgMBAAECggEACm0F1sbJVpOFCDG4sXLtpZNTkD8cJP5upMSj4BaHxXpk\nHInLkc3R52WdSLLb4MxO/Tofo6EhA5Zx/QncqOd8c1Tnd1fKnwusQ6agxUo82lJe\n7p8+oRgLMZGkjmlqLBfUDt1sSlxny5g3WrHhJlMVapqbjO2HrQn0CZfZMM9OX/eN\nYxzDCF/5aiMBl4IWz86eQAK4rkz4NlJYu1MRL87Sm9IRg4bCqjICkZw9nI+taAS4\nRgSF+nKg4afTINo1EuTK94BVj26OH1FJEJ4BUBdHdVv1Tii89LKOGvqaAgvHmcWL\n3ka6YVN0eAnlybw4RVs9gQYrIkXoMMse7l9IktkqAQKBgQD9/i4Y9nzysopDp+kU\nGu3KkzZFwbp/f965zfJV2wQbnApSz6ED3RiZXo46mEG3eF4t1UThUGYypsHJ06es\nD6y/o/1y8b+F1JAHVfFNtxUg2fhYE4zFE42YeuBS92Qo6QtxZbnCNRhmWiSdvmEU\n55WEOuQ+YPZNwAyV0vh/xyx/AQKBgQD0xuBjy2I4a3x5abH3V52fzSibd11c4nQj\nuqzg+gDnR1DCmJtblYIt4bZSbW9BrjtZ65rB5JKKRXaP3yvBZ3itXkA6iPPNJXtt\nGFWLOAne46tiSW0jP9BnAasZWa2+Xw+Av3G/ty8405TuaITtJqclzT3cko58bYR2\n+VerlYyhRQKBgQDiT0qPn4CxVvfvVHtPGLdr2kNvYDBmTm8Lqz8T1LQSTbS9GJdl\nM+kpLqEYAHX9ndh8ihx3jgWheAgPZvFtVAIeN2YqttBp1H4Iq0D4d/rxbIXlJHY3\nWza8+C9MfXXXJd62SWd8bYayG/uoOeuSjs4gJcEc+5Q6rrYIARS99Z/mAQKBgD59\nQy3W72VN84IffKKTiJcSTiqaZ4hd+55feuEYkgB5UWHMieTwn0JNXDlg3MVc0KQd\nJO4ZB1wrbaA/LjF60/EWnbkT24Hk7sSkMLqQ/NwdLVSzQBx+nxqc72xSW6u9Iv0Q\nYt65ymFsipnurvjIJGXfJsrX025qmyWwdDRGwpctAoGAZL4G1eWor8LW/7jp4Cfz\nNbSzs4eW/0DsIXBwrJ55b91GgEj9lQ+qkjfunX9wbJw2EmB7zINgIBU4Vrwjkcp3\nEqDn5I47999uaFrr0cqvDf9T2c4lhbyohdoEkH2p3Bgv5hQdIwPPJpr+epWj0JuD\nG1etIo415wovDO0YcPctUaA=\n-----END PRIVATE KEY-----\n",
    };
    _adminApp = initAdminApp({ credential: cert(embeddedServiceAccount) });
    return _adminApp;
  } catch (e) {
    const existing = getAdminApps();
    if (existing.length > 0) {
      _adminApp = existing[0];
      return _adminApp;
    }
    console.warn("Could not load embedded service account credentials, falling back...");
  }

  // 4. Minimal fallback
  try {
    _adminApp = initAdminApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "momentum-b4215",
    });
    return _adminApp;
  } catch (e) {
    const existing = getAdminApps();
    if (existing.length > 0) {
      _adminApp = existing[0];
      return _adminApp;
    }
    throw e;
  }
}

export function getAdminDb(): Firestore {
  if (!_adminDb) {
    _adminDb = getAdminFirestore(getAdminApp());
  }
  return _adminDb;
}

export const adminApp_: App = new Proxy({} as App, {
  get(_target, prop) {
    if (prop === "then" || prop === "catch" || prop === "toJSON" || typeof prop === "symbol") {
      return undefined;
    }
    const app = getAdminApp();
    const val = (app as any)[prop];
    return typeof val === "function" ? val.bind(app) : val;
  }
});

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    if (prop === "then" || prop === "catch" || prop === "toJSON" || typeof prop === "symbol") {
      return undefined;
    }
    const db = getAdminDb();
    const val = (db as any)[prop];
    return typeof val === "function" ? val.bind(db) : val;
  }
});
