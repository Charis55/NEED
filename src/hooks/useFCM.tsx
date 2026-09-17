"use client";

import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { auth, messaging, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export function FCMProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined" || !messaging) return;

    const requestPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          });

          if (token && auth.currentUser) {
            // Save token to user profile
            const userRef = doc(db, "users", auth.currentUser.uid);
            await updateDoc(userRef, { fcmToken: token });
            
            // Note: If artisans are in a separate collection, update there too
            const artisanRef = doc(db, "artisans", auth.currentUser.uid);
            try {
              await updateDoc(artisanRef, { fcmToken: token });
            } catch (e) {
              // Ignore if artisan doc doesn't exist
            }
          }
        }
      } catch (error: any) {
        if (error?.code === 'messaging/token-subscribe-failed') {
          console.warn("FCM Subscription failed: Make sure Cloud Messaging API is enabled in Firebase Console and your VAPID key is correct.");
        } else {
          console.warn("FCM Permission denied or failed to get token:", error);
        }
      }
    };

    // We wait for auth state to be resolved before requesting permission
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        requestPermission();
      }
    });

    // Handle foreground messages
    const unsubscribeMessage = onMessage(messaging, (payload) => {
      console.log("Foreground message received:", payload);
      // In a real app, use a toast library like react-hot-toast or sonner here
      alert(`${payload.notification?.title}\n\n${payload.notification?.body}`);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeMessage();
    };
  }, []);

  return <>{children}</>;
}
