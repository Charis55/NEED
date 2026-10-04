"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDoc, doc, updateDoc, increment, or } from "firebase/firestore";
import { JobRequest } from "@/types";
import IncomingCallModal from "./IncomingCallModal";
import OutgoingCallModal from "./OutgoingCallModal";
import dynamic from "next/dynamic";
import SocialNotification from "@/lib/SocialNotification";
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

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

  const triggerCallNotification = async (job: JobRequest) => {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      try {
        const isVideo = job.activeCall?.type === 'video';
        await LocalNotifications.schedule({
          notifications: [
            {
              title: "Incoming Call",
              body: `${isVideo ? 'Video' : 'Audio'} call. Tap to answer.`,
              id: 1001,
              schedule: { at: new Date(Date.now() + 100) },
              sound: undefined, 
              actionTypeId: "",
              extra: null
            }
          ]
        });
      } catch (e) {
        console.error("Local Notification failed", e);
      }
    }
  };

  const clearCallNotification = async () => {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
      } catch (e) {
        // ignore
      }
    }
  };
  const [partnerPhoto, setPartnerPhoto] = useState<string | undefined>();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setUserUid(user ? user.uid : null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userUid) return;
    
    // Start our custom native bridge service for background notifications
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      SocialNotification.startService({ uid: userUid }).catch(e => console.error("Failed to start service", e));
      
      // Request all required OS permissions upfront on load
      import('@capacitor/geolocation').then(({ Geolocation }) => {
        Geolocation.requestPermissions().catch(e => console.warn(e));
      });
      import('@capacitor/camera').then(({ Camera }) => {
        Camera.requestPermissions().catch(e => console.warn(e));
      });
      
      LocalNotifications.requestPermissions().then((status) => {
        console.log("LocalNotifications perm:", status.display);
      }).catch(e => console.error(e));
      
      // Request Android-specific dangerous permissions
      if ((window as any).cordova?.plugins?.permissions) {
        const permissions = (window as any).cordova.plugins.permissions;
        const list = [
          permissions.READ_PHONE_STATE,
          permissions.CALL_PHONE,
          permissions.READ_MEDIA_IMAGES,
          permissions.READ_MEDIA_VIDEO
        ];
        permissions.requestPermissions(list, 
          (status: any) => console.log("Cordova perm status:", status),
          (error: any) => console.warn("Cordova perm error:", error)
        );
      }
    }

    const qCombined = query(
      collection(db, "jobRequests"),
      or(
        where("artisanId", "==", userUid),
        where("customerId", "==", userUid)
      )
    );

    const handleSnapshot = (snap: any) => {
      // Find if there's any active call
      let foundJob: JobRequest | null = null;
      for (const doc of snap.docs) {
        const data = doc.data() as JobRequest;
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
              triggerCallNotification(foundJob!);
              return foundJob!.requestId;
           }
           return prevNotified;
         });
      } else {
         if (!foundJob) {
           setNotifiedCallId(null);
         }
      }
    };

    const unsub = onSnapshot(qCombined, handleSnapshot);

    return () => {
      unsub();
    };
  }, [userUid]);

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
    
    // Play end sound immediately
    playCallSound("end");
    clearCallNotification();

    try {
      const jobToProcess = activeJob;
      const activeCall = jobToProcess.activeCall;
      if (!activeCall) return;

      const isVideo = activeCall.type === "video";
      
      let durationText = "Missed Call";
      if (activeCall.connectedAt) {
        const durationMs = Math.max(0, Date.now() - activeCall.connectedAt);
        const totalSeconds = Math.floor(durationMs / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        durationText = `${m}:${s.toString().padStart(2, '0')} mins`;
      } else if (reason === "declined") {
         durationText = "Declined Call";
      } else if (reason === "cancelled") {
         durationText = "Cancelled";
      } else if (reason === "timeout") {
         durationText = "Missed Call";
      }

      const messageText = `[CALL_LOG]:${isVideo ? 'video' : 'voice'}:${durationText}`;
      
      const messageSenderId = reason === "declined" 
        ? (jobToProcess.customerId === activeCall.callerId ? jobToProcess.artisanId! : jobToProcess.customerId)
        : activeCall.callerId;
        
      const receiverId = jobToProcess.customerId === messageSenderId ? jobToProcess.artisanId : jobToProcess.customerId;

      // We use isolated operations instead of a batch to ensure the call ends even if logging fails.
      const jobRef = doc(db, "jobRequests", jobToProcess.requestId);
      
      try {
        await updateDoc(jobRef, {
          "activeCall.status": "ended",
          lastMessageText: messageText,
          lastMessageSenderId: messageSenderId || userUid,
          lastMessageAt: Date.now(),
          ...(receiverId ? { [`unreadCount.${receiverId}`]: increment(1) } : {})
        });
      } catch (updateErr) {
        console.error("Failed to update job request status:", updateErr);
      }

      try {
        const msgRef = doc(collection(db, "jobRequests", jobToProcess.requestId, "messages"));
        const { setDoc } = await import("firebase/firestore");
        await setDoc(msgRef, {
          text: messageText,
          senderId: messageSenderId || userUid,
          createdAt: Date.now()
        });
      } catch (msgErr) {
        console.error("Failed to append message to history:", msgErr);
      }

      // Hide UI
      setActiveJob(null);
    } catch (e) {
      console.error("Failed to end call:", e);
      // Fallback: just clear it locally anyway
      setActiveJob(null);
    }
  };

  const acceptCall = async () => {
    if (!activeJob) return;

    clearCallNotification();
    try {
      await updateDoc(doc(db, "jobRequests", activeJob.requestId), {
        "activeCall.status": "ongoing",
        "activeCall.connectedAt": Date.now()
      });
    } catch (e) {
      console.error("Failed to accept call", e);
    }
  };

  if (!activeJob || !activeJob.activeCall || !userUid) return null;

  const { activeCall } = activeJob;
  const isCaller = activeCall.callerId === userUid;

  return (
    <div className="fixed z-[9999]">
      {activeCall.status === "ringing" && !isCaller && (
        <IncomingCallModal 
          callerName={partnerName}
          callerPhoto={partnerPhoto}
          callType={activeCall.type}
          jobTitle={activeJob.subcategory || activeJob.trade}
          onAccept={acceptCall}
          onDecline={() => endCallWithLog("declined")}
        />
      )}

      {activeCall.status === "ringing" && isCaller && (
        <OutgoingCallModal 
          calleeName={partnerName}
          calleePhoto={partnerPhoto}
          callType={activeCall.type}
          onCancel={() => endCallWithLog("cancelled")}
        />
      )}

      {activeCall.status === "ongoing" && (
        <AgoraCallModal 
          channelName={activeJob.requestId}
          uid={userUid}
          isVideo={activeCall.type === "video"}
          partnerName={partnerName}
          onEndCall={() => endCallWithLog("ended")}
        />
      )}
    </div>
  );
}
