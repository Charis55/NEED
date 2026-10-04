"use client";

import { useEffect, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDoc, doc, QuerySnapshot, QueryDocumentSnapshot } from "firebase/firestore";
import { useAlert } from "@/components/AlertProvider";
import { useRouter } from "next/navigation";
import { JobRequest } from "@/types";

export default function GlobalNotificationListener() {
  const { showAlert } = useAlert();
  const router = useRouter();
  
  // Refs to skip the initial load of onSnapshot
  const initialArtisanLoad = useRef(true);
  const initialCustomerLoad = useRef(true);
  const lastMessageAtMap = useRef<Record<string, number>>({});
  const listenerAttachedAt = useRef(Date.now());

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      // Check if user has notifications enabled
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const prefs = userDoc.data()?.preferences;
      if (prefs && prefs.inAppNotifications === false) {
        return; // Disabled
      }

      // Check if artisan (to know which routes to use)
      const artisanDoc = await getDoc(doc(db, "artisans", user.uid));
      const isArtisan = artisanDoc.exists();

      // 1. Listen to Job Requests (Both direct and customer requests)
      const qArtisan = query(collection(db, "jobRequests"), where("artisanId", "==", user.uid));
      const qCustomer = query(collection(db, "jobRequests"), where("customerId", "==", user.uid));

      const handleJobChange = async (snapshot: QuerySnapshot, role: "artisan" | "customer") => {
        const isInitial = role === "artisan" ? initialArtisanLoad.current : initialCustomerLoad.current;
        
        if (isInitial) {
          snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
            const data = doc.data();
            if (data.lastMessageAt) {
              lastMessageAtMap.current[doc.id] = data.lastMessageAt;
            }
          });
          
          if (role === "artisan") initialArtisanLoad.current = false;
          else initialCustomerLoad.current = false;
          
          return;
        }

        for (const change of snapshot.docChanges()) {
          const job = change.doc.data() as JobRequest & { lastMessageAt?: number; lastMessageSenderId?: string; lastMessageText?: string };
          
          if (change.type === "added" || change.type === "modified") {
            
            if (job.lastMessageAt && job.lastMessageSenderId !== user.uid) {
              const previousLastMessageAt = lastMessageAtMap.current[job.requestId];
              
              // Only alert if this message is ACTUALLY new (newer than when we loaded the app, or newer than the last one we saw)
              const isHistorical = job.lastMessageAt < listenerAttachedAt.current;
              
              if ((!previousLastMessageAt && !isHistorical) || (previousLastMessageAt && job.lastMessageAt > previousLastMessageAt)) {
                lastMessageAtMap.current[job.requestId] = job.lastMessageAt;
                
                try {
                  // Fetch sender details for avatar and name
                  let senderName = "Someone";
                  let senderAvatar = undefined;
                  
                  // If we are artisan, sender is customer.
                  const senderCollection = role === "artisan" ? "users" : "artisans";
                  const senderDoc = await getDoc(doc(db, senderCollection, job.lastMessageSenderId!));
                  if (senderDoc.exists()) {
                    const data = senderDoc.data();
                    if (role === "artisan") {
                      senderName = data.firstName ? `${data.firstName} ${data.lastName || ""}` : "Customer";
                      senderAvatar = data.photoURL;
                    } else {
                      senderName = data.businessName || data.name || "Technician";
                      senderAvatar = data.photoURL;
                    }
                  }

                  let messagePreview = job.lastMessageText || "New message";
                  let notificationText = "";

                  if (messagePreview.startsWith("[CALL_LOG]:")) {
                    const parts = messagePreview.split(":");
                    const callType = parts[1]?.toUpperCase() === "VIDEO" ? "Video" : "Voice";
                    const callDuration = parts.slice(2).join(":"); 
                    
                    if (callDuration.toLowerCase().includes("missed") || callDuration.toLowerCase().includes("declined") || callDuration.toLowerCase().includes("cancelled") || callDuration.includes("-")) {
                        notificationText = `Missed ${callType} Call from ${senderName}`;
                    } else {
                        // Do not send an alert if the call just ended normally (was connected)
                        continue;
                    }
                  } else {
                    if (messagePreview.length > 40) messagePreview = messagePreview.substring(0, 40) + "...";
                    notificationText = `${senderName}: ${messagePreview}`;
                  }

                  showAlert(notificationText, "info", { 
                    label: "VIEW", 
                    onClick: () => router.push(role === "artisan" ? `/chat/${job.requestId}` : `/chat/${job.requestId}`) 
                  }, senderAvatar);
                } catch (e) {
                  console.error("Error fetching sender details", e);
                  showAlert(`New message regarding ${job.trade}`, "info", { 
                    label: "VIEW", 
                    onClick: () => router.push(role === "artisan" ? `/chat/${job.requestId}` : `/chat/${job.requestId}`) 
                  });
                }
              }
            }

            if (role === "artisan" && job.status === "pending" && change.type === "added") {
              showAlert(`New Job Request: ${job.trade}`, "info", { 
                label: "VIEW", 
                onClick: () => router.push("/technician/jobs") 
              });
            }

            if (job.status === "countered") {
              // If artisan, alert if customer countered
              if (role === "artisan" && job.lastCounterBy === "customer") {
                showAlert(`Customer countered your offer for ${job.trade}`, "info", { 
                  label: "VIEW", 
                  onClick: () => router.push("/technician/jobs") 
                });
              }
              // If customer, alert if artisan countered
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
        console.warn("GlobalNotificationListener Firestore error:", err?.message || err);
      };

      const unsubArtisan = onSnapshot(qArtisan, (snap) => handleJobChange(snap, "artisan"), handleSnapError);
      const unsubCustomer = onSnapshot(qCustomer, (snap) => handleJobChange(snap, "customer"), handleSnapError);

      return () => {
        unsubArtisan();
        unsubCustomer();
      };
    });

    return () => unsubscribeAuth();
  }, [router, showAlert]);

  return null; // This component does not render anything
}
