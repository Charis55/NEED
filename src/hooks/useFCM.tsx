"use client";

import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { auth, messaging, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useAlert } from "@/components/AlertProvider";
import { Capacitor } from "@capacitor/core";

export function FCMProvider({ children }: { children: React.ReactNode }) {
  const { showAlert } = useAlert();

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined" || !messaging) return;

    const requestPermission = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          // Native Push Notifications
          const { PushNotifications } = await import('@capacitor/push-notifications');
          
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
          }

          if (permStatus.receive !== 'granted') {
            console.warn("Native push permission denied");
            return;
          }

          await PushNotifications.register();

          PushNotifications.addListener('registration', async (token) => {
            console.log("Native Push Registration Token:", token.value);
            if (auth.currentUser) {
              const userRef = doc(db, "users", auth.currentUser.uid);
              await updateDoc(userRef, { fcmToken: token.value });
              
              const artisanRef = doc(db, "artisans", auth.currentUser.uid);
              try { await updateDoc(artisanRef, { fcmToken: token.value }); } catch(e) {}
            }
          });

          PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log("Native Foreground Notification:", notification);
            showAlert(`${notification.title}: ${notification.body}`, "info");
          });

        } else {
          // Web Push Notifications
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            const token = await getToken(messaging as any, {
              vapidKey: "BB7xpv1wQlb8_ygbtdXZvwEKGimkhG5Hl_2-K5QJB7DvzvkpRdS7Y2XIw1nE3E7HfzA1ztECHMzBW_P1atFEMMo",
            });

            if (token && auth.currentUser) {
              const userRef = doc(db, "users", auth.currentUser.uid);
              await updateDoc(userRef, { fcmToken: token });
              
              const artisanRef = doc(db, "artisans", auth.currentUser.uid);
              try { await updateDoc(artisanRef, { fcmToken: token }); } catch (e) {}
            }
          }
        }
      } catch (error: any) {
        console.warn("FCM setup failed:", error);
      }
    };

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const handled = localStorage.getItem("need_permissions_handled");
        if (handled === "true" || (!Capacitor.isNativePlatform() && Notification.permission === "granted")) {
          requestPermission();
        }
      }
    });

    let unsubscribeMessage: any = null;
    if (!Capacitor.isNativePlatform()) {
      unsubscribeMessage = onMessage(messaging, (payload) => {
        console.log("Web Foreground message received:", payload);
        const title = payload.notification?.title || "New Notification";
        const body = payload.notification?.body || "";
        showAlert(`${title}: ${body}`, "info");
      });
    }

    return () => {
      unsubscribeAuth();
      unsubscribeMessage();
    };
  }, []);

  return <>{children}</>;
}
