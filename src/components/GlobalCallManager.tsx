"use client";

import { useEffect, useState, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDoc, doc, updateDoc, increment, or } from "firebase/firestore";
import { JobRequest } from "@/types";
import IncomingCallModal from "./IncomingCallModal";
import OutgoingCallModal from "./OutgoingCallModal";
import dynamic from "next/dynamic";
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { sessionId } from "@/utils/sessionId";
import { apiFetch } from "@/utils/apiBase";

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

  const userUidRef = useRef<string | null>(null);
  userUidRef.current = userUid;
  const activeJobRef = useRef<JobRequest | null>(null);
  activeJobRef.current = activeJob;
  const lastHandledUrlRef = useRef<{ url: string; time: number } | null>(null);

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
        if (!url) return;
        const now = Date.now();
        if (lastHandledUrlRef.current && lastHandledUrlRef.current.url === url && now - lastHandledUrlRef.current.time < 5000) {
          return;
        }
        lastHandledUrlRef.current = { url, time: now };

        const urlLower = url.toLowerCase();
        if (urlLower.includes('needapp://') || urlLower.includes('call/')) {
          let reqId: string | null = null;
          try {
            const urlObj = new URL(url);
            reqId = urlObj.searchParams.get('requestId') || urlObj.searchParams.get('jobId');
          } catch (e) {
            const match = url.match(/[?&](requestId|jobId)=([^&]+)/i);
            if (match) reqId = decodeURIComponent(match[2]);
          }

          const targetId = reqId || activeJobRef.current?.requestId;
          const isAnswer = urlLower.includes('answer');
          const isDecline = urlLower.includes('decline');

          if (isAnswer && targetId) {
            clearCallNotification();
            playCallSound("pickup");

            // Optimistically accept via server API (uses adminDb - guaranteed even before auth syncs)
            apiFetch("/api/calls/accept", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requestId: targetId, sessionId }),
            }).catch(err => console.warn("Failed to accept call via server:", err));

            // Immediately load the job doc and update state so the call modal opens instantaneously
            try {
              const { doc, getDoc, updateDoc } = await import("firebase/firestore");
              const jobSnap = await getDoc(doc(db, "jobRequests", targetId));
              if (jobSnap.exists()) {
                const jobData = jobSnap.data() as JobRequest;
                const currentUid = userUidRef.current || auth.currentUser?.uid || (jobData.artisanId !== jobData.activeCall?.callerId ? jobData.artisanId : jobData.customerId);
                
                const updatedJob: JobRequest = {
                  ...jobData,
                  activeCall: {
                    ...(jobData.activeCall || {
                      channelName: targetId,
                      callerId: "",
                      type: "audio",
                      status: "ongoing",
                      timestamp: Date.now()
                    }),
                    status: "ongoing",
                    connectedAt: Date.now(),
                    acceptedBySession: sessionId,
                  }
                };

                if (!userUidRef.current && currentUid) {
                  setUserUid(currentUid);
                }
                setActiveJob(updatedJob);
                if (currentUid) {
                  fetchPartnerInfo(updatedJob, currentUid);
                }
              }

              await updateDoc(doc(db, "jobRequests", targetId), {
                "activeCall.status": "ongoing",
                "activeCall.connectedAt": Date.now(),
                "activeCall.acceptedBySession": sessionId
              });
            } catch (e) {
              console.warn("Client updateDoc accept fallback:", e);
            }
          } else if (isDecline && targetId) {
            clearCallNotification();
            playCallSound("end");

            // Directly update Firestore immediately (<50ms) so caller stops ringing right away
            try {
              const { updateDoc, doc } = await import("firebase/firestore");
              await updateDoc(doc(db, "jobRequests", targetId), {
                "activeCall.status": "ended",
                "activeCall.endedAt": Date.now(),
                "activeCall.endedReason": "declined",
                lastMessageAt: Date.now(),
              });
            } catch (e) {
              console.warn("Client updateDoc decline failed:", e);
            }

            apiFetch("/api/calls/decline", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requestId: targetId,
                jobId: targetId,
                callerId: userUidRef.current,
                reason: "declined"
              }),
            }).catch(console.error);
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
      const listenerPromise = App.addListener('appUrlOpen', (data) => {
        handleDeepLink(data.url);
      });
      
      return () => {
        listenerPromise.then(l => l.remove()).catch(() => {});
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

    const targetJobId = activeJob.requestId;
    const finalReason = reason || "ended";

    // Compute synchronized duration: prioritize bothConnectedAt (when both parties joined)
    let durationMs: number | null = null;
    const syncStartTime = activeJob.activeCall.bothConnectedAt || activeJob.activeCall.connectedAt;
    if (syncStartTime && finalReason === "ended") {
      durationMs = Math.max(0, Date.now() - syncStartTime);
    }

    // Direct client Firestore update for instant (<50ms) reaction on both caller & receiver devices
    try {
      await updateDoc(doc(db, "jobRequests", targetJobId), {
        "activeCall.status": "ended",
        "activeCall.endedAt": Date.now(),
        "activeCall.endedReason": finalReason,
        lastMessageAt: Date.now(),
      });
    } catch (firestoreErr) {
      console.warn("Client direct updateDoc failed on endCallWithLog:", firestoreErr);
    }

    // Optimistically clear UI so user sees the dismissal instantly
    setActiveJob(null);

    // Delegate message logging, audit events, and push notifications to the server via mobile-safe apiFetch
    apiFetch("/api/calls/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: targetJobId,
        callerId: userUid,
        reason: finalReason,
        durationMs,
      }),
    }).catch(err => console.error("Failed to end call via server:", err));
  };

  const acceptCall = async () => {
    if (!activeJob) return;

    clearCallNotification();
    playCallSound("pickup");

    const updatedJob: JobRequest = {
      ...activeJob,
      activeCall: {
        ...activeJob.activeCall!,
        status: "ongoing",
        connectedAt: Date.now(),
        acceptedBySession: sessionId
      }
    };
    setActiveJob(updatedJob);

    try {
      // Accept: directly update Firestore (no server logic needed — state gate
      // is already enforced on initiation; accept just flips status to "ongoing")
      await updateDoc(doc(db, "jobRequests", activeJob.requestId), {
        "activeCall.status": "ongoing",
        "activeCall.connectedAt": Date.now(),
        "activeCall.acceptedBySession": sessionId
      });
    } catch (e) {
      console.error("Failed to accept call", e);
    }
  };

  const handleBothConnected = async (jobId: string, timestamp: number) => {
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, "jobRequests", jobId), {
        "activeCall.bothConnectedAt": timestamp
      });
    } catch (e) {
      console.warn("Client sync bothConnectedAt failed:", e);
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
          bothConnectedAt={activeCall.bothConnectedAt || null}
          onBothConnected={(timestamp) => handleBothConnected(activeJob.requestId, timestamp)}
          onEndCall={() => endCallWithLog("ended")}
        />
      )}
      </div>
    </div>
  );
}
