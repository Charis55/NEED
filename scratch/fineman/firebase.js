import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBvA9l7UppfGbtEz5rVL5ArGNPh7lXEqI4",
  authDomain: "momentum-x3xva.firebaseapp.com",
  projectId: "momentum-x3xva",
  storageBucket: "momentum-x3xva.firebasestorage.app",
  messagingSenderId: "864160700353",
  appId: "1:864160700353:web:a498adaf4564869a040140"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);

// Initialize Firestore with Persistent Cache (Fixes "stuck" onboarding & offline errors)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

export default app;
