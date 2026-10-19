import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentSingleTabManager 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import type { Messaging } from "firebase/messaging";
import type { Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyB_Hc8lgDxkW_lmTLctK3mvx72fBLIfPNY",
  authDomain: "momentum-b4215.firebaseapp.com",
  projectId: "momentum-b4215",
  storageBucket: "momentum-b4215.appspot.com",
  messagingSenderId: "48438248184",
  appId: "1:48438248184:web:c52578c24ca34ffd9a710d",
  measurementId: "G-YKYMMGT4CL"
};

// Initialize Firebase (preventing multiple initializations in Next.js development)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);

// Enable persistent on-device IndexedDB cache so all queries, profiles, and chats load instantly on mobile
// Using single tab manager avoids multi-tab lock contention that can hang queries in iOS WKWebView
let db: ReturnType<typeof getFirestore>;
try {
  if (typeof window !== "undefined") {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) })
    });
  } else {
    db = getFirestore(app);
  }
} catch (e) {
  db = getFirestore(app);
}
const storage = getStorage(app);

let messaging: Messaging | null = null;
let analytics: Analytics | null = null;

if (typeof window !== "undefined") {
  // FCM messaging check to safely avoid crashes in WKWebView / iOS webviews
  import("firebase/messaging").then(({ getMessaging, isSupported }) => {
    isSupported().then((supported) => {
      if (supported) {
        try {
          messaging = getMessaging(app);
        } catch (e) {
          console.warn("FCM getMessaging initialization failed:", e);
        }
      }
    }).catch(() => {});
  }).catch(() => {});

  // Analytics only works in the browser
  import("firebase/analytics").then(({ getAnalytics, isSupported }) => {
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    });
  }).catch(() => {});
}

export { app, auth, db, storage, messaging, analytics };
