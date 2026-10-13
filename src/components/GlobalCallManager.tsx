"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDoc, doc, updateDoc, increment, or } from "firebase/firestore";
import { JobRequest } from "@/types";
import IncomingCallModal from "./IncomingCallModal";
import OutgoingCallModal from "./OutgoingCallModal";
import dynamic from "next/dynamic";
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { sessionId } from "@/utils/sessionId";

const playCallSound = (type: "pickup" | "end") => {
  if (typeof window !== "undefined") {
    // Very short, minimalist UI blip sounds
    const url = type === "pickup" 
      ? "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3" // subtle pop up
      : "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"; // subtle pop down
    const audio = new Audio(url);
    audio.volume = 0.5; // keep it quiet
    audio.play().catch(e => console.warn("Audio play failed:", e));
  }
};

const AgoraCallModal = dynamic(() => import("./AgoraCallModal"), { ssr: false });
export default function GlobalCallManager() {
  const [userUid, setUserUid] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<JobRequest | null>(null);
  const [partnerName, setPartnerName] = useState<string>("Someone");
  const [partnerPhoto, setPartnerPhoto] = useState<string | undefined>();
  const [notifiedCallId, setNotifiedCallId] = useState<string | null>(null);

  const clearCallNotification = async () => {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        await PushNotifications.removeAllDeliveredNotifications();
      } catch (e) {
        // ignore
      }
    }
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setUserUid(user ? user.uid : null);
    });
    return () => {
      unsub();
      if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {

      }
    };
  }, []);

  useEffect(() => {
    if (!userUid) return;
    // Relying on FCM data message and Capacitor Push Notifications for background ringing

    const updateCombined = (artisanJobs: JobRequest[], customerJobs: JobRequest[]) => {
      const combined = [...artisanJobs, ...customerJobs];
      
      // Find if there's any active call
      let foundJob: JobRequest | null = null;
      for (const data of combined) {
        if (data.activeCall && (data.activeCall.status === "ringing" || data.activeCall.status === "ongoing")) {
          foundJob = data;
          break; // just handle one active call at a time
        }
      }

      setActiveJob((prev) => {
        // If we found a new call, fetch partner info
        if (foundJob && (!prev || prev.requestId !== foundJob.requestId)) {
          fetchPartnerInfo(foundJob, userUid);
        }
        return foundJob;
      });

      // Handle notification
      if (
        foundJob && 
        foundJob.activeCall?.status === "ringing" && 
        foundJob.activeCall?.callerId !== userUid
      ) {
          setNotifiedCallId((prevNotified) => {
           if (prevNotified !== foundJob!.requestId) {
              return foundJob!.requestId;
           }
           return prevNotified;
         });
      } else {
         if (!foundJob || (foundJob && foundJob.activeCall?.status !== "ringing")) {
           if (!foundJob) {
             setNotifiedCallId(null);
           }
         }
      }
    };

    const handleError = (err: any) => {
      console.warn("GlobalCallManager Firestore listener error:", err?.message || err);
    };

    let artisanJobs: JobRequest[] = [];
    let customerJobs: JobRequest[] = [];

    const qArtisan = query(collection(db, "jobRequests"), where("artisanId", "==", userUid));
    const unsubArtisan = onSnapshot(qArtisan, (snap) => {
      artisanJobs = snap.docs.map(d => d.data() as JobRequest);
      updateCombined(artisanJobs, customerJobs);
    }, handleError);

    const qCustomer = query(collection(db, "jobRequests"), where("customerId", "==", userUid));
    const unsubCustomer = onSnapshot(qCustomer, (snap) => {
      customerJobs = snap.docs.map(d => d.data() as JobRequest);
      updateCombined(artisanJobs, customerJobs);
    }, handleError);

    return () => {
      unsubArtisan();
      unsubCustomer();
    };
  }, [userUid]);

  // Handle deep links from notification action buttons (Answer / Decline)
  useEffect(() => {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      const handleDeepLink = async (url: string) => {
        if (url.startsWith('needapp://call/')) {
          const urlObj = new URL(url);
          const action = urlObj.pathname.replace('//', '/').split('/')[2]; // /call/answer -> answer
          const reqId = urlObj.searchParams.get('requestId');
          
          if (reqId) {
            if (action === 'answer') {
              clearCallNotification();
              try {
                const { updateDoc, doc } = await import("firebase/firestore");
                await updateDoc(doc(db, "jobRequests", reqId), {
                  "activeCall.status": "ongoing",
                  "activeCall.connectedAt": Date.now(),
                  "activeCall.acceptedBySession": sessionId
                });
                playCallSound("pickup");
              } catch (e) {
                console.error(e);
              }
            } else if (action === 'decline') {
              clearCallNotification();
              fetch("/api/calls/end", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobId: reqId, callerId: userUid, reason: "declined", durationMs: null }),
              }).catch(console.error);
            }
          }
        }
      };

      // Handle cold start
      App.getLaunchUrl().then((launchData) => {
        if (launchData && launchData.url) {
          handleDeepLink(launchData.url);
        }
      });

      // Handle warm start
      const listener = App.addListener('appUrlOpen', (data) => {
        handleDeepLink(data.url);
      });
      
      return () => {
        listener.then(l => l.remove());
      };
    }
  }, []);

  const fetchPartnerInfo = async (job: JobRequest, uid: string) => {
    try {
      const isCustomer = job.customerId === uid;
      const partnerId = isCustomer ? job.artisanId : job.customerId;
      if (!partnerId) return;

      const collectionName = isCustomer ? "artisans" : "users";
      let docRef = await getDoc(doc(db, collectionName, partnerId));
      if (!docRef.exists() && isCustomer) {
        // Fallback to users collection if artisan details not fully filled
        docRef = await getDoc(doc(db, "users", partnerId));
      }
      
      if (docRef.exists()) {
        const data = docRef.data();
        if (isCustomer) {
          setPartnerName(data.businessName || data.name || data.firstName || "Technician");
          setPartnerPhoto(data.profilePictureUrl || data.photoURL);
        } else {
          setPartnerName(data.firstName ? `${data.firstName} ${data.lastName || ""}` : "Customer");
          setPartnerPhoto(data.photoURL);
        }
      }
    } catch (e) {
      console.error("Error fetching partner info for call", e);
    }
  };

  useEffect(() => {
    if (activeJob && activeJob.activeCall && activeJob.activeCall.status === "ringing") {
      // Tolerate clock drift: If it's wildly in the past (e.g. > 5 mins), treat as stale.
      const elapsed = Date.now() - activeJob.activeCall.timestamp;
      if (elapsed > 5 * 60000) {
        endCallWithLog("timeout");
      } else {
        // Just ring for 60 seconds from when we observe it, to avoid clock drift ending it instantly
        const timer = setTimeout(() => {
          endCallWithLog("timeout");
        }, 60000);
        return () => clearTimeout(timer);
      }
    }
  }, [activeJob]);

  const endCallWithLog = async (reason?: "cancelled" | "declined" | "timeout" | "ended") => {
    if (!activeJob || !activeJob.activeCall || !userUid) return;
    
    // Play end sound immediately and clear any ringing notification
    playCallSound("end");
    clearCallNotification();

    // Optimistically clear UI so user sees the dismissal instantly
    setActiveJob(null);

    // Compute duration for the server (it also computes it, but pass what we know client-side)
    let durationMs: number | null = null;
    if (activeJob.activeCall.connectedAt) {
      durationMs = Math.max(0, Date.now() - activeJob.activeCall.connectedAt);
    }

    // Delegate all Firestore updates, message logging, and push notifications to the server
    fetch("/api/calls/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: activeJob.requestId,
        callerId: userUid,
        reason: reason || "ended",
        durationMs,
      }),
    }).catch(err => console.error("Failed to end call via server:", err));
  };

  const acceptCall = async () => {
    if (!activeJob) return;

    clearCallNotification();
    try {
      // Accept: directly update Firestore (no server logic needed — state gate
      // is already enforced on initiation; accept just flips status to "ongoing")
      await updateDoc(doc(db, "jobRequests", activeJob.requestId), {
        "activeCall.status": "ongoing",
        "activeCall.connectedAt": Date.now(),
        "activeCall.acceptedBySession": sessionId
      });
      playCallSound("pickup");
    } catch (e) {
      console.error("Failed to accept call", e);
    }
  };

  if (!activeJob || !activeJob.activeCall || !userUid) return null;

  const { activeCall } = activeJob;
  const isCaller = activeCall.callerId === userUid;
  const isThisDeviceCaller = isCaller;
  const isThisDeviceReceiver = !isCaller;
  const isRingingForMe = activeCall.status === "ringing" && !isCaller;
  const isRingingByMe = activeCall.status === "ringing" && isCaller;
  const isOngoingForMe = activeCall.status === "ongoing";

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div className="pointer-events-auto">
      {isRingingForMe && (
        <IncomingCallModal 
          callerName={partnerName}
          callerPhoto={partnerPhoto}
          callType={activeCall.type}
          jobTitle={activeJob.subcategory || activeJob.trade}
          onAccept={acceptCall}
          onDecline={() => endCallWithLog("declined")}
        />
      )}

      {isRingingByMe && (
        <OutgoingCallModal 
          calleeName={partnerName}
          calleePhoto={partnerPhoto}
          callType={activeCall.type}
          onCancel={() => endCallWithLog("cancelled")}
        />
      )}

      {isOngoingForMe && (
        <AgoraCallModal 
          channelName={activeJob.requestId}
          uid={userUid}
          isVideo={activeCall.type === "video"}
          partnerName={partnerName}
          partnerPhoto={partnerPhoto}
          onEndCall={() => endCallWithLog("ended")}
        />
      )}
      </div>
    </div>
  );
}
