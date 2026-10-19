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
      const now = Date.now();
      
      // Filter out invalid/stale calls, prioritize by most recent activeCall timestamp
      const candidateJobs = combined.filter((data) => {
        if (!data.activeCall) return false;
        const status = data.activeCall.status;
        if (status === "ringing") {
          // A ringing call is considered valid unless it is genuinely ancient (> 2 hours old from abandoned crash)
          const ringingAge = now - (data.activeCall.timestamp || 0);
          if (data.activeCall.timestamp && ringingAge > 2 * 60 * 60 * 1000) {
            return false;
          }
          return true;
        }
        if (status === "ongoing") {
          const ongoingAge = now - (data.activeCall.bothConnectedAt || data.activeCall.connectedAt || data.activeCall.timestamp || 0);
          return ongoingAge <= 2 * 60 * 60 * 1000;
        }
        return false;
      });

      candidateJobs.sort((a, b) => (b.activeCall?.timestamp || 0) - (a.activeCall?.timestamp || 0));
      const foundJob = candidateJobs.length > 0 ? candidateJobs[0] : null;

      setActiveJob((prev) => {
        // Immediately initialize partner info from activeCall if available (0ms delay, no "Someone")
        if (foundJob && foundJob.activeCall) {
          const isCallerJob = foundJob.activeCall.callerId === userUid;
          const directPartnerName = isCallerJob
            ? (foundJob.activeCall as any).receiverName
            : (foundJob.activeCall as any).callerName;
          const directPartnerPhoto = isCallerJob
            ? (foundJob.activeCall as any).receiverPhoto
            : (foundJob.activeCall as any).callerPhoto;

          if (directPartnerName && directPartnerName !== "Someone" && directPartnerName !== "Caller") {
            setPartnerName(directPartnerName);
          }
          if (directPartnerPhoto) {
            setPartnerPhoto(directPartnerPhoto);
          }
        }

        // If we found a new call or need to enrich profile, fetch partner info
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

    const handleSnapshot = () => {
      updateCombined(artisanJobs, customerJobs);
    };

    const qArtisan = query(collection(db, "jobRequests"), where("artisanId", "==", userUid));
    const unsubArtisan = onSnapshot(qArtisan, (snap) => {
      artisanJobs = snap.docs.map(d => ({ requestId: d.id, ...d.data() }) as JobRequest);
      handleSnapshot();
    }, handleError);

    const qCustomer = query(collection(db, "jobRequests"), where("customerId", "==", userUid));
    const unsubCustomer = onSnapshot(qCustomer, (snap) => {
      customerJobs = snap.docs.map(d => ({ requestId: d.id, ...d.data() }) as JobRequest);
      handleSnapshot();
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
          let deepLinkChannel: string | null = null;
          try {
            const urlObj = new URL(url);
            reqId = urlObj.searchParams.get('requestId') || urlObj.searchParams.get('jobId');
            deepLinkChannel = urlObj.searchParams.get('channelName');
          } catch (e) {
            const match = url.match(/[?&](requestId|jobId)=([^&]+)/i);
            if (match) reqId = decodeURIComponent(match[2]);
            const chMatch = url.match(/[?&]channelName=([^&]+)/i);
            if (chMatch) deepLinkChannel = decodeURIComponent(chMatch[1]);
          }

          const targetId = reqId || activeJobRef.current?.requestId;
          const isAnswer = urlLower.includes('answer');
          const isDecline = urlLower.includes('decline');

          if (isAnswer && targetId) {
            clearCallNotification();

            try {
              const { doc, getDoc, updateDoc } = await import("firebase/firestore");
              const jobSnap = await getDoc(doc(db, "jobRequests", targetId));
              if (!jobSnap.exists()) {
                console.log("[GlobalCallManager] Job not found for call accept:", targetId);
                return;
              }
              const jobData = jobSnap.data() as JobRequest;

              // CRITICAL GUARD: Only auto-accept if the call is ACTIVELY RINGING and not expired (<45s)
              const isActivelyRinging = jobData.activeCall?.status === "ringing" && 
                (Date.now() - (jobData.activeCall.timestamp || 0) < 45000);

              if (!isActivelyRinging) {
                console.log("[GlobalCallManager] Ignoring stale or non-ringing call launch URL for", targetId);
                return;
              }

              playCallSound("pickup");

              // Optimistically accept via server API (uses adminDb - guaranteed even before auth syncs)
              apiFetch("/api/calls/accept", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId: targetId, sessionId }),
              }).catch(err => console.warn("Failed to accept call via server:", err));

              const currentUid = userUidRef.current || auth.currentUser?.uid || (jobData.artisanId !== jobData.activeCall?.callerId ? jobData.artisanId : jobData.customerId);
              const targetChannel = jobData.activeCall?.channelName || deepLinkChannel || targetId;
              
              const updatedJob: JobRequest = {
                ...jobData,
                activeCall: {
                  ...(jobData.activeCall || {
                    channelName: targetChannel,
                    callerId: "",
                    type: "audio",
                    status: "ongoing",
                    timestamp: Date.now()
                  }),
                  channelName: targetChannel,
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

              await updateDoc(doc(db, "jobRequests", targetId), {
                "activeCall.status": "ongoing",
                "activeCall.connectedAt": Date.now(),
                "activeCall.bothConnectedAt": null,
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

      // Handle cold start (deduplicate against session reloads)
      App.getLaunchUrl().then((launchData) => {
        if (launchData && launchData.url) {
          const handledKey = "need_handled_launch_url";
          const previouslyHandled = typeof sessionStorage !== "undefined" && sessionStorage.getItem(handledKey) === launchData.url;
          if (!previouslyHandled) {
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem(handledKey, launchData.url);
            }
            handleDeepLink(launchData.url);
          } else {
            console.log("[GlobalCallManager] Skipping already-handled launch URL on reload:", launchData.url);
          }
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
      const isCaller = activeJob.activeCall.callerId === userUid;
      if (isCaller) {
        // Only the CALLER should auto-timeout their outgoing call if nobody picks up after 60 seconds
        const timer = setTimeout(() => {
          endCallWithLog("timeout");
        }, 60000);
        return () => clearTimeout(timer);
      }
      // For the RECEIVER: Never auto-terminate or write 'ended' to Firestore!
      // The receiver simply lets the modal ring until answered, declined, or cancelled by the caller.
    }
  }, [activeJob?.requestId, activeJob?.activeCall?.status, userUid]);

  const endCallWithLog = async (
    reason?: "cancelled" | "declined" | "timeout" | "ended",
    explicitDurationSec?: number
  ) => {
    if (!activeJob || !activeJob.activeCall || !userUid) return;
    
    // Play end sound immediately and clear any ringing notification
    playCallSound("end");
    clearCallNotification();

    const targetJobId = activeJob.requestId;
    const finalReason = reason || "ended";

    // Compute synchronized duration: prioritize explicitDurationSec from modal, then bothConnectedAt/connectedAt
    let durationMs: number | null = null;
    if (typeof explicitDurationSec === "number" && explicitDurationSec > 0) {
      durationMs = explicitDurationSec * 1000;
    } else {
      const syncStartTime = activeJob.activeCall.bothConnectedAt || activeJob.activeCall.connectedAt;
      if (syncStartTime && finalReason === "ended") {
        durationMs = Math.max(0, Date.now() - syncStartTime);
      }
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

    const targetJobId = activeJob.requestId;
    const updatedJob: JobRequest = {
      ...activeJob,
      activeCall: {
        ...activeJob.activeCall!,
        status: "ongoing",
        connectedAt: Date.now(),
        bothConnectedAt: null,
        acceptedBySession: sessionId
      }
    };
    setActiveJob(updatedJob);

    // Optimistically and authoritatively accept via server API using adminDb
    apiFetch("/api/calls/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: targetJobId, sessionId }),
    }).catch(err => console.warn("Failed to accept call via server:", err));

    try {
      await updateDoc(doc(db, "jobRequests", targetJobId), {
        "activeCall.status": "ongoing",
        "activeCall.connectedAt": Date.now(),
        "activeCall.bothConnectedAt": null,
        "activeCall.acceptedBySession": sessionId
      });
    } catch (e) {
      console.error("Failed to accept call via client updateDoc:", e);
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

  // Caller device: whoever initiated the call is the caller on their device.
  // We do not gate on fragile callerSessionId checks which caused calls to flash and close.
  const isThisDeviceCaller = isCaller;

  // Receiver device: rings on all devices of the recipient account; once answered, only the specific device that accepted connects to Agora
  const isThisDeviceAcceptedReceiver = !isCaller && (!activeCall.acceptedBySession || activeCall.acceptedBySession === sessionId);

  const isRingingForMe = activeCall.status === "ringing" && !isCaller;
  const isRingingByMe = activeCall.status === "ringing" && isThisDeviceCaller;
  const isOngoingForMe = activeCall.status === "ongoing" && (isCaller ? isThisDeviceCaller : isThisDeviceAcceptedReceiver);

  // If this device is neither the active caller nor ringing/accepted receiver, don't show overlay
  if (!isRingingForMe && !isRingingByMe && !isOngoingForMe) return null;

  // Validate bothConnectedAt: only valid if it occurred on or after the current call's timestamp
  const validBothConnectedAt = 
    activeCall.bothConnectedAt && (!activeCall.timestamp || activeCall.bothConnectedAt >= activeCall.timestamp)
      ? activeCall.bothConnectedAt
      : null;

  // Determine guaranteed names and photos directly from activeCall (0ms delay)
  const resolvedCalleeName = (activeCall as any).receiverName || (partnerName !== "Someone" ? partnerName : "Technician");
  const resolvedCalleePhoto = (activeCall as any).receiverPhoto || partnerPhoto;

  const resolvedCallerName = (activeCall as any).callerName || (partnerName !== "Someone" ? partnerName : "Customer");
  const resolvedCallerPhoto = (activeCall as any).callerPhoto || partnerPhoto;

  const inCallPartnerName = isCaller ? resolvedCalleeName : resolvedCallerName;
  const inCallPartnerPhoto = isCaller ? resolvedCalleePhoto : resolvedCallerPhoto;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div className="pointer-events-auto">
      {isRingingForMe && (
        <IncomingCallModal 
          callerName={resolvedCallerName}
          callerPhoto={resolvedCallerPhoto}
          callType={activeCall.type}
          jobTitle={activeJob.subcategory || activeJob.trade}
          onAccept={acceptCall}
          onDecline={() => endCallWithLog("declined")}
        />
      )}

      {isRingingByMe && (
        <OutgoingCallModal 
          calleeName={resolvedCalleeName}
          calleePhoto={resolvedCalleePhoto}
          callType={activeCall.type}
          onCancel={() => endCallWithLog("cancelled")}
        />
      )}

      {isOngoingForMe && (
        <AgoraCallModal 
          channelName={activeCall.channelName || activeJob.requestId}
          uid={userUid}
          isVideo={activeCall.type === "video"}
          partnerName={inCallPartnerName}
          partnerPhoto={inCallPartnerPhoto}
          connectedAt={activeCall.connectedAt || null}
          bothConnectedAt={validBothConnectedAt}
          onBothConnected={(timestamp) => handleBothConnected(activeJob.requestId, timestamp)}
          onEndCall={(sec) => endCallWithLog("ended", sec)}
        />
      )}
      </div>
    </div>
  );
}
