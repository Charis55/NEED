"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken, onMessage } from "firebase/messaging";
import { auth, messaging, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useAlert } from "@/components/AlertProvider";
import { Capacitor } from "@capacitor/core";

/**
 * Saves the FCM token to both the users and artisans collections.
 * Separated out so it can be called from both the registration listener
 * and on-demand when auth state changes.
 */
async function persistToken(uid: string, token: string) {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { fcmToken: token });
  } catch (e) {
    console.warn("Failed to save fcmToken to users/:", e);
  }
  try {
    const artisanRef = doc(db, "artisans", uid);
    await updateDoc(artisanRef, { fcmToken: token });
  } catch (e) {
    // Not an artisan — that's fine
  }
}

export function FCMProvider({ children }: { children: React.ReactNode }) {
  const { showAlert } = useAlert();
  const router = useRouter();

  // Keep a ref to the latest native token so we can persist it
  // even if the registration listener fires before auth is ready.
  const pendingNativeToken = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !messaging) return;

    // Track whether listeners have been added so we don't double-add
    let nativeListenersAdded = false;

    const setupNativePush = async (uid: string) => {
      const { PushNotifications } = await import("@capacitor/push-notifications");

      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === "prompt") {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive !== "granted") {
        console.warn("Native push permission denied");
        return;
      }

      if (!nativeListenersAdded) {
        nativeListenersAdded = true;

        PushNotifications.addListener("registration", async (tokenResult) => {
          console.log("Native FCM token:", tokenResult.value);
          pendingNativeToken.current = tokenResult.value;

          // auth.currentUser may or may not be set by now.
          // Use the uid we closed over from onAuthStateChanged.
          await persistToken(uid, tokenResult.value);
        });

        PushNotifications.addListener("registrationError", (err) => {
          console.error("Native push registration failed:", err);
        });

        PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("Native foreground notification:", notification);
          showAlert(`${notification.title}: ${notification.body}`, "info");
        });

        PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          console.log("Notification action:", action);
          const data = action.notification.data;
          
          if (data && data.type) {
            // Wait slightly to ensure capacitor has foregrounded before routing
            setTimeout(() => {
              switch (data.type) {
                case "chat":
                case "call":
                case "job_update":
                  if (data.requestId) {
                    router.push(`/chat/${data.requestId}`);
                  }
                  break;
                case "new_request":
                  router.push("/technician/jobs");
                  break;
                default:
                  if (data.requestId) {
                    router.push(`/chat/${data.requestId}`);
                  }
                  break;
              }
            }, 100);
          }
        });
      }

      try {
        await PushNotifications.createChannel({
          id: "default",
          name: "General Notifications",
          description: "Job requests, updates, and messages",
          importance: 5,
          sound: "default",
          vibration: true,
          visibility: 1
        });
      } catch (e) {
        console.warn("Failed to create notification channel:", e);
      }

      await PushNotifications.register();
    };

    const setupWebPush = async (uid: string) => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const token = await getToken(messaging as any, {
        vapidKey: "BB7xpv1wQlb8_ygbtdXZvwEKGimkhG5Hl_2-K5QJB7DvzvkpRdS7Y2XIw1nE3E7HfzA1ztECHMzBW_P1atFEMMo",
      });

      if (token) {
        await persistToken(uid, token);
      }
    };

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      const handled = localStorage.getItem("need_permissions_handled");
      const shouldInit =
        handled === "true" ||
        (!Capacitor.isNativePlatform() && Notification.permission === "granted");

      if (!shouldInit) return;

      try {
        if (Capacitor.isNativePlatform()) {
          await setupNativePush(user.uid);

          // If the registration listener already fired before auth was ready,
          // the token is sitting in the ref — persist it now.
          if (pendingNativeToken.current) {
            await persistToken(user.uid, pendingNativeToken.current);
          }
        } else {
          await setupWebPush(user.uid);
        }
      } catch (error: any) {
        console.warn("FCM setup failed:", error);
      }
    });

    // Web foreground message listener (safe no-op on native)
    let unsubscribeMessage: (() => void) | null = null;
    if (!Capacitor.isNativePlatform()) {
      unsubscribeMessage = onMessage(messaging, (payload) => {
        console.log("Web foreground message:", payload);
        const title = payload.notification?.title || "New Notification";
        const body = payload.notification?.body || "";
        showAlert(`${title}: ${body}`, "info");
      });
    }

    return () => {
      unsubscribeAuth();
      if (unsubscribeMessage) unsubscribeMessage();
    };
  }, []);

  return <>{children}</>;
}
