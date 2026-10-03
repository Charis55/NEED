"use client";

import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { auth, messaging, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useAlert } from "@/components/AlertProvider";

export function FCMProvider({ children }: { children: React.ReactNode }) {
  const { showAlert } = useAlert();

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined" || !messaging) return;

    const requestPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const token = await getToken(messaging as any, {
            vapidKey: "BB7xpv1wQlb8_ygbtdXZvwEKGimkhG5Hl_2-K5QJB7DvzvkpRdS7Y2XIw1nE3E7HfzA1ztECHMzBW_P1atFEMMo",
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
        // Only request automatically if permissions have been handled or already granted
        const handled = localStorage.getItem("need_permissions_handled");
        if (handled === "true" || Notification.permission === "granted") {
          requestPermission();
        }
      }
    });

    // Handle foreground messages
    const unsubscribeMessage = onMessage(messaging, (payload) => {
      console.log("Foreground message received:", payload);
      const title = payload.notification?.title || "New Notification";
      const body = payload.notification?.body || "";
      showAlert(`${title}: ${body}`, "info");
    });

    return () => {
      unsubscribeAuth();
      unsubscribeMessage();
    };
  }, []);

  return <>{children}</>;
}
