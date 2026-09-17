import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB_Hc8lgDxkW_lmTLctK3mvx72fBLIfPNY",
  authDomain: "momentum-b4215.firebaseapp.com",
  projectId: "momentum-b4215",
  storageBucket: "momentum-b4215.firebasestorage.app",
  messagingSenderId: "48438248184",
  appId: "1:48438248184:web:c52578c24ca34ffd9a710d"
};

// Initialize Firebase (preventing multiple initializations in Next.js development)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
