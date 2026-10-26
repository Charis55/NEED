"use client";

import { useEffect, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDoc, doc, QuerySnapshot, QueryDocumentSnapshot } from "firebase/firestore";
import { useAlert } from "@/components/AlertProvider";
import { useRouter, usePathname } from "next/navigation";
import { JobRequest } from "@/types";

export default function GlobalNotificationListener() {
  const { showAlert } = useAlert();
  const router = useRouter();
  const pathname = usePathname();
  
  // Refs to skip the initial load of onSnapshot
  const initialArtisanLoad = useRef(true);
  const initialCustomerLoad = useRef(true);
  const lastMessageAtMap = useRef<Record<string, number>>({});
  const listenerAttachedAt = useRef(Date.now());
  const seenNotificationIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      try {
        const { notifyNativeCall } = await import("@/utils/device");
        notifyNativeCall("setUserId", { uid: user.uid });
      } catch (e) {}

      // Check if user has notifications enabled
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const prefs = userDoc.data()?.preferences;
        if (prefs && prefs.inAppNotifications === false) {
          return; // In-app alerts disabled by user preference
        }
      } catch (prefErr) {
        // Continue if offline or read restricted
      }

      // Check if artisan (to know which routes to use)
      let isArtisan = false;
      try {
        const artisanDoc = await getDoc(doc(db, "artisans", user.uid));
        isArtisan = artisanDoc.exists();
      } catch (artErr) {}

      // 1. Direct listener to users/{uid}/notifications collection
      // Catches all push/in-app notifications created by /api/send-notification
      let unsubNotifications = () => {};
      try {
        const qNotifications = query(
          collection(db, "users", user.uid, "notifications"),
          where("createdAt", ">", listenerAttachedAt.current)
        );
        unsubNotifications = onSnapshot(qNotifications, (snapshot) => {
          for (const change of snapshot.docChanges()) {
            if (change.type === "added") {
              const notif = change.doc.data();
              const notifId = change.doc.id || notif.id;
              if (seenNotificationIds.current.has(notifId)) continue;
              seenNotificationIds.current.add(notifId);

              // Suppress in-app banners completely if device is currently in a call or ringing
              if (typeof document !== "undefined" && document.body.getAttribute("data-in-call") === "true") {
                continue;
              }

              // Don't alert if user is already on the relevant chat screen
              if (notif.data?.type === "chat" && notif.data?.requestId && pathname === `/chat/${notif.data.requestId}`) {
                continue;
              }

              // Don't alert for calls here (handled by GlobalCallManager & native CallKit)
              const notifType = notif.data?.type || notif.type || notif.action;
              if (notifType === "call" || notifType === "cancel_call" || notif.data?.callId || notif.data?.channelName) {
                continue;
              }

              const alertTitle = (notif.title || "").trim();
              const alertBody = (notif.body || "").trim();

              // Drop generic empty notifications without useful content
              if (!alertBody && (!alertTitle || alertTitle.toLowerCase() === "notification" || alertTitle.toLowerCase() === "need notification")) {
                continue;
              }

              const fullText = alertBody ? (alertTitle && alertTitle.toLowerCase() !== "notification" ? `${alertTitle}: ${alertBody}` : alertBody) : alertTitle;

              showAlert(
                fullText,
                "info",
                notif.data?.requestId ? {
                  label: "VIEW",
                  onClick: () => router.push(`/chat/${notif.data.requestId}`)
                } : undefined
              );
            }
          }
        }, (err) => {
          console.warn("[GlobalNotificationListener] Notifications stream notice:", err?.message || err);
        });
      } catch (notifErr) {
        console.warn("[GlobalNotificationListener] Could not attach notifications listener:", notifErr);
      }

      // 2. Direct listener to jobRequests where user is participant
      const qArtisan = query(collection(db, "jobRequests"), where("artisanId", "==", user.uid));
      const qCustomer = query(collection(db, "jobRequests"), where("customerId", "==", user.uid));

      const handleJobChange = async (snapshot: QuerySnapshot, role: "artisan" | "customer") => {
        const isInitial = role === "artisan" ? initialArtisanLoad.current : initialCustomerLoad.current;
        
        if (isInitial) {
          snapshot.docs.forEach((d: QueryDocumentSnapshot) => {
            const data = d.data();
            if (data.lastMessageAt) {
              lastMessageAtMap.current[d.id] = data.lastMessageAt;
            }
          });
          
          if (role === "artisan") initialArtisanLoad.current = false;
          else initialCustomerLoad.current = false;
          
          return;
        }

        for (const change of snapshot.docChanges()) {
          const job = change.doc.data() as JobRequest & { lastMessageAt?: number; lastMessageSenderId?: string; lastMessageText?: string };
          
          if (change.type === "added" || change.type === "modified") {
            // New chat message or voice note received
            if (job.lastMessageAt && job.lastMessageSenderId !== user.uid) {
              const previousLastMessageAt = lastMessageAtMap.current[job.requestId];
              const isHistorical = job.lastMessageAt < listenerAttachedAt.current;
              
              if ((!previousLastMessageAt && !isHistorical) || (previousLastMessageAt && job.lastMessageAt > previousLastMessageAt)) {
                lastMessageAtMap.current[job.requestId] = job.lastMessageAt;
                
                // If user is currently looking at this exact chat page, don't show the duplicate in-app banner
                if (pathname === `/chat/${job.requestId}`) {
                  continue;
                }

                try {
                  let senderName = role === "artisan" ? "Customer" : "Technician";
                  let senderAvatar: string | undefined = undefined;
                  
                  const senderCollection = role === "artisan" ? "users" : "artisans";
                  const senderDoc = await getDoc(doc(db, senderCollection, job.lastMessageSenderId!));
                  if (senderDoc.exists()) {
                    const data = senderDoc.data();
                    if (role === "artisan") {
                      senderName = data.firstName ? `${data.firstName} ${data.lastName || ""}`.trim() : (data.displayName || "Customer");
                      senderAvatar = data.photoURL || data.profilePictureUrl;
                    } else {
                      senderName = data.businessName || data.name || "Technician";
                      senderAvatar = data.profilePictureUrl || data.photoURL;
                    }
                  }

                  let messagePreview = job.lastMessageText || "New message";
                  let notificationText = "";

                  if (messagePreview.startsWith("[CALL_LOG]:")) {
                    const parts = messagePreview.split(":");
                    const callType = parts[1]?.toUpperCase() === "VIDEO" ? "Video" : "Voice";
                    const callDuration = parts.slice(2).join(":"); 
                    
                    const isUserCaller = job.activeCall?.callerId === user.uid;
                    if (isUserCaller) {
                      continue;
                    } else {
                      if (callDuration.toLowerCase().includes("missed") || callDuration.toLowerCase().includes("cancelled") || callDuration.toLowerCase().includes("timeout")) {
                        notificationText = `Missed ${callType} Call from ${senderName}`;
                      } else {
                        continue;
                      }
                    }
                  } else {
                    if (messagePreview.length > 40) messagePreview = messagePreview.substring(0, 40) + "...";
                    notificationText = `${senderName}: ${messagePreview}`;
                  }

                  showAlert(notificationText, "info", { 
                    label: "VIEW", 
                    onClick: () => router.push(`/chat/${job.requestId}`) 
                  }, senderAvatar);
                } catch (e) {
                  showAlert(`New message from ${role === "artisan" ? "customer" : "technician"} regarding ${job.trade || "job"}`, "info", { 
                    label: "VIEW", 
                    onClick: () => router.push(`/chat/${job.requestId}`) 
                  });
                }
              }
            }

            // New Job Request alert for artisans
            if (role === "artisan" && job.status === "pending" && change.type === "added") {
              showAlert(`New Job Request: ${job.trade || "Service Request"}`, "info", { 
                label: "VIEW", 
                onClick: () => router.push("/technician/jobs") 
              });
            }

            // Counter-offer alerts
            if (job.status === "countered") {
              if (role === "artisan" && job.lastCounterBy === "customer") {
                showAlert(`Customer countered your offer for ${job.trade}`, "info", { 
                  label: "VIEW", 
                  onClick: () => router.push("/technician/jobs") 
                });
              }
              if (role === "customer" && job.lastCounterBy !== "customer") {
                showAlert(`Technician countered your offer for ${job.trade}`, "info", { 
                  label: "VIEW", 
                  onClick: () => router.push("/jobs") 
                });
              }
            }
          }
        }
      };

      const handleSnapError = (err: any) => {
        console.warn("[GlobalNotificationListener] Job stream notice:", err?.message || err);
      };

      const unsubArtisan = onSnapshot(qArtisan, (snap) => handleJobChange(snap, "artisan"), handleSnapError);
      const unsubCustomer = onSnapshot(qCustomer, (snap) => handleJobChange(snap, "customer"), handleSnapError);

      const handleForegroundPush = (e: any) => {
        if (typeof document !== "undefined" && document.body.getAttribute("data-in-call") === "true") {
          return;
        }

        const detail = e.detail;
        const title = (detail?.notification?.title || detail?.title || "").trim();
        const body = (detail?.notification?.body || detail?.body || "").trim();
        const data = detail?.data || {};

        const dataType = data?.type || (detail as any)?.type;
        if (dataType === "call" || dataType === "cancel_call" || data?.callId || data?.channelName) {
          return;
        }

        if (data?.type === "chat" && data?.requestId && pathname === `/chat/${data.requestId}`) {
          return;
        }

        // Drop generic notifications without text
        if (!body && (!title || title.toLowerCase() === "notification" || title.toLowerCase() === "need notification")) {
          return;
        }

        const fullText = body ? (title && title.toLowerCase() !== "notification" ? `${title}: ${body}` : body) : title;
        showAlert(
          fullText,
          "info",
          data?.requestId ? {
            label: "VIEW",
            onClick: () => router.push(`/chat/${data.requestId}`)
          } : undefined
        );
      };

      window.addEventListener("needForegroundPush", handleForegroundPush);

      return () => {
        window.removeEventListener("needForegroundPush", handleForegroundPush);
        unsubNotifications();
        unsubArtisan();
        unsubCustomer();
      };
    });

    return () => unsubscribeAuth();
  }, [router, pathname, showAlert]);

  return null;
}
