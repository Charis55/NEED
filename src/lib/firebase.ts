import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, Messaging } from "firebase/messaging";
import { getAnalytics, Analytics } from "firebase/analytics";

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
const db = getFirestore(app);
const storage = getStorage(app);

let messaging: Messaging | null = null;
let analytics: Analytics | null = null;

if (typeof window !== "undefined") {
  messaging = getMessaging(app);
  // Analytics only works in the browser
  import("firebase/analytics").then(({ isSupported }) => {
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    });
  });
}

export { app, auth, db, storage, messaging, analytics };
