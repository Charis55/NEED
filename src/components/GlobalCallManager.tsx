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

  const triggerCallNotification = async (job: JobRequest) => {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      try {
        // Create a channel for High Priority notifications (Heads-up)
        await LocalNotifications.createChannel({
          id: 'incoming_calls',
          name: 'Incoming Calls',
          description: 'Notifications for incoming audio and video calls',
          importance: 5, // 5 = High importance (Heads-up notification)
          visibility: 1, // 1 = Public
          vibration: true,
        });

        const isVideo = job.activeCall?.type === 'video';
        await LocalNotifications.schedule({
          notifications: [
            {
              title: "Incoming Call",
              body: `${isVideo ? 'Video' : 'Audio'} call. Tap to answer.`,
              id: 1001,
              channelId: 'incoming_calls',
              smallIcon: 'ic_stat_icon', // Expected transparent silhouette icon
              iconColor: '#000000', // Brutalist black
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
        SocialNotification.stopRingtone().catch(e => console.warn(e));
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
         SocialNotification.stopRingtone().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!userUid) return;
    // Start our custom native bridge service for background notifications
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      SocialNotification.startService({ uid: userUid }).catch(e => console.error("Failed to start service", e));
    }

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
              triggerCallNotification(foundJob!);
              if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
                SocialNotification.playRingtone().catch(e => console.warn(e));
              }
              return foundJob!.requestId;
           }
           return prevNotified;
         });
      } else {
         if (!foundJob || (foundJob && foundJob.activeCall?.status !== "ringing")) {
           if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
             SocialNotification.stopRingtone().catch(e => console.warn(e));
           }
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

      if ((reason === "timeout" || reason === "cancelled") && userUid === activeCall.callerId && receiverId) {
        fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: receiverId,
            title: "Missed Call",
            body: `Missed ${isVideo ? 'video' : 'voice'} call from ${auth.currentUser?.displayName || 'Someone'}`,
            data: { requestId: jobToProcess.requestId, type: "call" }
          })
        }).catch(err => console.error("Push failed:", err));
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
        "activeCall.connectedAt": Date.now(),
        "activeCall.acceptedBySession": sessionId
      });
    } catch (e) {
      console.error("Failed to accept call", e);
    }
  };

  if (!activeJob || !activeJob.activeCall || !userUid) return null;

  const { activeCall } = activeJob;
  const isCaller = activeCall.callerId === userUid;
  const isThisDeviceCaller = isCaller && activeCall.callerSessionId === sessionId;
  const isThisDeviceReceiver = !isCaller && activeCall.acceptedBySession === sessionId;
  const isRingingForMe = activeCall.status === "ringing" && !isCaller;
  const isRingingByMe = activeCall.status === "ringing" && isThisDeviceCaller;
  const isOngoingForMe = activeCall.status === "ongoing" && (isThisDeviceCaller || isThisDeviceReceiver);

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
