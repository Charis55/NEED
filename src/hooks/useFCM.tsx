"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "firebase/messaging";
import { auth, messaging, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
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
    console.warn("Failed to save fcmToken directly to users/:", e);
  }
  try {
    await fetch("/api/notifications/register-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, token }),
    });
  } catch (e) {
    console.warn("Failed calling /api/notifications/register-token:", e);
  }
}

export function FCMProvider({ children }: { children: React.ReactNode }) {
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
          id: "high_priority_alerts",
          name: "High Priority Alerts",
          description: "Important updates that require immediate attention",
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
      try {
        if (typeof window === "undefined" || !("Notification" in window)) return;
        
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted") return;

        const token = await getToken(messaging as any, {
          vapidKey: "BB7xpv1wQlb8_ygbtdXZvwEKGimkhG5Hl_2-K5QJB7DvzvkpRdS7Y2XIw1nE3E7HfzA1ztECHMzBW_P1atFEMMo",
        });

        if (token) {
          console.log("[useFCM] Retrieved Web FCM token:", token.substring(0, 10) + "...");
          await persistToken(uid, token);
        }
      } catch (e) {
        console.warn("[useFCM] setupWebPush error:", e);
      }
    };

    // On native: eagerly create the high-priority channel as soon as the
    // app boots. Android requires the channel to exist BEFORE any notification
    // arrives. Doing this before auth means it's ready even on a fresh install.
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/push-notifications").then(({ PushNotifications }) => {
        PushNotifications.createChannel({
          id: "high_priority_alerts",
          name: "High Priority Alerts",
          description: "Important updates that require immediate attention",
          importance: 5,
          sound: "default",
          vibration: true,
          visibility: 1,
        }).catch((e) => console.warn("Channel creation error:", e));
      });
    }

    // Listen for native iOS token bridge events
    const handleNativeToken = (e: any) => {
      const token = e.detail?.token;
      if (!token) return;
      pendingNativeToken.current = token;
      const currentUid = auth.currentUser?.uid;
      if (currentUid) {
        console.log("[useFCM] Native iOS push token received:", token.substring(0, 10) + "...");
        persistToken(currentUid, token);
      }
    };
    window.addEventListener("needNativePushToken", handleNativeToken);

    // Proactively ask native wrapper for cached token if already received
    try {
      (window as any).webkit?.messageHandlers?.needNative?.postMessage?.({ action: "getPushToken" });
    } catch (e) {}

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      try {
        if (pendingNativeToken.current) {
          await persistToken(user.uid, pendingNativeToken.current);
        }
        if (Capacitor.isNativePlatform()) {
          await setupNativePush(user.uid);
        } else {
          await setupWebPush(user.uid);
        }
        // Ask native wrapper again post-login
        try {
          (window as any).webkit?.messageHandlers?.needNative?.postMessage?.({ action: "getPushToken" });
        } catch (e) {}
      } catch (error: any) {
        console.warn("FCM setup failed:", error);
      }
    });

    return () => {
      window.removeEventListener("needNativePushToken", handleNativeToken);
      unsubscribeAuth();
    };
  }, []);

  return <>{children}</>;
}
