"use client";

import { useEffect, useState, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDoc, doc } from "firebase/firestore";
import { JobRequest } from "@/types";
import IncomingCallModal from "./IncomingCallModal";
import OutgoingCallModal from "./OutgoingCallModal";
import dynamic from "next/dynamic";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { getSessionId } from "@/utils/sessionId";
import { apiFetch } from "@/utils/apiBase";
import {
  getDeviceId,
  getPlatformName,
  getActiveOutgoingCallId,
  clearActiveOutgoingCallId,
  safeGetSession,
  safeSetSession,
  safeRemoveSession,
  notifyNativeCall,
} from "@/utils/device";

const playCallSound = (type: "pickup" | "end") => {
  if (typeof window !== "undefined") {
    // Very short, minimalist UI blip sounds
    const url =
      type === "pickup"
        ? "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"
        : "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3";
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play().catch((e) => console.warn("Audio play failed:", e));
  }
};

const AgoraCallModal = dynamic(() => import("./AgoraCallModal"), { ssr: false });

export default function GlobalCallManager() {
  const [userUid, setUserUid] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<JobRequest | null>(null);
  const [partnerName, setPartnerName] = useState<string>("Someone");
  const [partnerPhoto, setPartnerPhoto] = useState<string | undefined>();
  const [notifiedCallId, setNotifiedCallId] = useState<string | null>(null);
  const [terminalState, setTerminalState] = useState<{
    status: string;
    text: string;
    dismissAt: number;
  } | null>(null);

  const userUidRef = useRef<string | null>(null);
  userUidRef.current = userUid;
  const activeJobRef = useRef<JobRequest | null>(null);
  activeJobRef.current = activeJob;
  const terminalStateRef = useRef<typeof terminalState>(null);
  terminalStateRef.current = terminalState;
  const lastHandledUrlRef = useRef<{ url: string; time: number } | null>(null);

  const clearCallNotification = async () => {
    notifyNativeCall("clearDeliveredNotifications");
    if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        await PushNotifications.removeAllDeliveredNotifications();
      } catch (e) {
        // ignore
      }
    }
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      const uid = user ? user.uid : null;
      setUserUid(uid);
      if (uid) {
        notifyNativeCall("setUserId", { uid });
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userUid) return;

    let artisanJobs: JobRequest[] = [];
    let customerJobs: JobRequest[] = [];

    const updateCombined = (aJobs: JobRequest[], cJobs: JobRequest[]) => {
      const combined = [...aJobs, ...cJobs];
      const now = Date.now();

      // Find the most recent active call (tolerating clock skew between client and server)
      const candidateJobs = combined.filter((data) => {
        if (!data.activeCall) return false;
        const status = data.activeCall.status;
        if (status === "ringing") {
          const rawTs = data.activeCall.timestamp || (data.activeCall as any).createdAt;
          const timestamp =
            typeof rawTs === "number"
              ? rawTs
              : (rawTs as any)?.toMillis?.() || 0;

          // Reject if timestamp missing or non-positive
          if (!timestamp || timestamp <= 0) return false;

          // Tolerate generous clock skew (up to 3 minutes) between devices and server
          const ringingAge = now - timestamp;
          if (ringingAge > 180 * 1000 || ringingAge < -120 * 1000) return false;

          return true;
        }
        if (status === "ongoing" || (status as string) === "connected" || (status as string) === "accepted") {
          const rawStart = data.activeCall.bothConnectedAt || data.activeCall.connectedAt || data.activeCall.timestamp;
          const syncStartTime =
            typeof rawStart === "number"
              ? rawStart
              : (rawStart as any)?.toMillis?.() || 0;

          if (!syncStartTime || syncStartTime <= 0) return false;

          const ongoingAge = now - syncStartTime;
          // Maximum ongoing call age 45 minutes
          if (ongoingAge > 45 * 60 * 1000 || ongoingAge < -10 * 1000) return false;

          // Abandoned ongoing call: if marked ongoing but bothConnectedAt was never set within 45s
          if (!data.activeCall.bothConnectedAt && ongoingAge > 45 * 1000) return false;

          return true;
        }
        // If current active call was just marked ended remotely while we were in it, allow for 1.5s terminal display
        if (status === "ended" && activeJobRef.current?.requestId === data.requestId) {
          return true;
        }
        return false;
      });

      candidateJobs.sort(
        (a, b) =>
          ((b.activeCall as any)?.timestamp || (b.activeCall as any)?.createdAt || 0) -
          ((a.activeCall as any)?.timestamp || (a.activeCall as any)?.createdAt || 0)
      );

      const foundJob = candidateJobs.length > 0 ? candidateJobs[0] : null;

      if (foundJob && foundJob.activeCall) {
        const call = foundJob.activeCall as any;
        const status = call.status;

        // Remote decline/cancellation detection: hold for 1.5s
        if (status === "ended") {
          if (activeJobRef.current?.requestId === foundJob.requestId) {
            notifyNativeCall("endCall");
            clearCallNotification();
            playCallSound("end");
            clearActiveOutgoingCallId();
            safeRemoveSession("need_active_outgoing_call_id");
            safeRemoveSession("need_active_outgoing_call_job");
            safeRemoveSession("need_active_outgoing_call");
            safeRemoveSession("need_my_answered_call");
            safeRemoveSession("need_my_answered_call_id");

            let text = "Call Ended";
            if (call.endedReason === "declined") {
              text = "Call Declined";
            } else if (call.endedReason === "cancelled") {
              text = "Call Cancelled";
            } else if (call.endedReason === "timeout") {
              text = "No Answer";
            }

            setTerminalState({
              status: call.endedReason || "ended",
              text,
              dismissAt: now + 1500,
            });

            setTimeout(() => {
              setActiveJob(null);
              setTerminalState(null);
            }, 1500);
          }
          return;
        }

        // Active live call
        const isCallerJob = call.callerId === userUid;
        const myDeviceId = getDeviceId();
        const activeCallId = call.callId || (call as any).id;
        const registeredOutgoingCallId = getActiveOutgoingCallId();

        // 1. Outgoing Caller Isolation:
        // ONLY the exact physical device that initiated the call displays the outgoing modal & joins Agora.
        // Other devices on the same account (e.g. laptop when calling from iPhone) stay completely idle.
        if (isCallerJob) {
          const initiatedHere =
            (Boolean(activeCallId) && (
              registeredOutgoingCallId === activeCallId ||
              safeGetSession("need_active_outgoing_call_id") === activeCallId
            )) ||
            (Boolean(call.callerDeviceId) && call.callerDeviceId === myDeviceId) ||
            // Fallback keep-alive: if this device already mounted and is in this exact call, NEVER unmount!
            (activeJobRef.current?.requestId === foundJob.requestId &&
             Boolean(activeJobRef.current?.activeCall?.callId) &&
             activeJobRef.current?.activeCall?.callId === activeCallId);

          if (!initiatedHere) {
            // Outgoing call was initiated on another device — stay completely idle on this secondary device
            if (activeJobRef.current?.requestId === foundJob.requestId) {
              setActiveJob(null);
              setNotifiedCallId(null);
            }
            return;
          }
        }

        // 2. Incoming Call Multi-Device Pick Isolation (WhatsApp style):
        // If an incoming call was ringing and has now been answered on another device:
        if (
          !isCallerJob &&
          (status === "ongoing" || (status as string) === "connected" || (status as string) === "accepted")
        ) {
          const answeredHere =
            (safeGetSession("need_my_answered_call") === foundJob.requestId) ||
            (Boolean(activeCallId) && safeGetSession("need_my_answered_call_id") === activeCallId) ||
            (Boolean(call.acceptedByDeviceId) && call.acceptedByDeviceId === myDeviceId);

          if (!answeredHere) {
            // Call was answered on another device (e.g. answered on iPhone while laptop was ringing)
            // Immediately stop ringing, dismiss incoming call modal, and stay idle.
            notifyNativeCall("endCall");
            clearCallNotification();
            setActiveJob(null);
            setNotifiedCallId(null);
            return;
          }
        }

        const isGenericName = (name?: string | null) => {
          if (!name) return true;
          const lower = name.trim().toLowerCase();
          return lower === "caller" || lower === "user" || lower === "someone" || lower === "customer" || lower === "technician";
        };

        const directPartnerName = isCallerJob
          ? call.receiverName || call.callee?.displayName
          : call.callerName || call.caller?.displayName;
        const directPartnerPhoto = isCallerJob
          ? call.receiverPhoto || call.callee?.photoUrl
          : call.callerPhoto || call.caller?.photoUrl;

        if (directPartnerName && !isGenericName(directPartnerName)) {
          setPartnerName(directPartnerName);
        }
        if (directPartnerPhoto) {
          setPartnerPhoto(directPartnerPhoto);
        }

        setActiveJob((prev) => {
          if (!prev || prev.requestId !== foundJob.requestId) {
            fetchPartnerInfo(foundJob, userUid);
          }
          return foundJob;
        });

        // Trigger native CallKit / Dynamic Island & system notifications for incoming ringing calls ONLY when app is in the background
        if (status === "ringing" && !isCallerJob) {
          const isBackgrounded = typeof document !== "undefined" && document.visibilityState === "hidden";
          if (isBackgrounded) {
            setNotifiedCallId((prevNotified) => {
              if (prevNotified !== foundJob.requestId) {
                notifyNativeCall("reportIncomingCall", {
                  partnerName: directPartnerName || "Customer",
                  isVideo: (call.type || (call as any).callType) === "video",
                  jobId: foundJob.requestId,
                  uid: userUid,
                });
                return foundJob.requestId;
              }
              return prevNotified;
            });
          }
        }
      } else {
        if (!terminalStateRef.current) {
          clearCallNotification();
          setActiveJob(null);
          setNotifiedCallId(null);
        }
      }
    };

    const handleError = (err: any) => {
      console.warn("GlobalCallManager Firestore listener error:", err?.message || err);
    };

    const qArtisan = query(collection(db, "jobRequests"), where("artisanId", "==", userUid));
    const unsubArtisan = onSnapshot(qArtisan, (snap) => {
      artisanJobs = snap.docs.map((d) => ({ requestId: d.id, ...d.data() } as JobRequest));
      updateCombined(artisanJobs, customerJobs);
    }, handleError);

    const qCustomer = query(collection(db, "jobRequests"), where("customerId", "==", userUid));
    const unsubCustomer = onSnapshot(qCustomer, (snap) => {
      customerJobs = snap.docs.map((d) => ({ requestId: d.id, ...d.data() } as JobRequest));
      updateCombined(artisanJobs, customerJobs);
    }, handleError);

    return () => {
      unsubArtisan();
      unsubCustomer();
    };
  }, [userUid]);

  // Handle deep links from notification action buttons (Answer / Decline)
  useEffect(() => {
    if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
      const handleDeepLink = async (url: string) => {
        if (!url) return;
        const now = Date.now();
        if (
          lastHandledUrlRef.current &&
          lastHandledUrlRef.current.url === url &&
          now - lastHandledUrlRef.current.time < 5000
        ) {
          return;
        }
        lastHandledUrlRef.current = { url, time: now };

        const urlLower = url.toLowerCase();
        if (urlLower.includes("needapp://") || urlLower.includes("call/")) {
          let reqId: string | null = null;
          try {
            const urlObj = new URL(url);
            reqId = urlObj.searchParams.get("requestId") || urlObj.searchParams.get("jobId");
          } catch (e) {
            const match = url.match(/[?&](requestId|jobId)=([^&]+)/i);
            if (match) reqId = decodeURIComponent(match[2]);
          }

          const targetId = reqId || activeJobRef.current?.requestId;
          const isAnswer = urlLower.includes("answer");
          const isDecline = urlLower.includes("decline");

          if (isAnswer && targetId) {
            clearCallNotification();
            playCallSound("pickup");
            if (typeof window !== "undefined") {
              sessionStorage.setItem("need_my_answered_call", targetId);
            }
            apiFetch("/api/calls/accept", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requestId: targetId,
                jobId: targetId,
                sessionId: getSessionId(),
                deviceId: getDeviceId(),
                platform: getPlatformName(),
              }),
            }).catch((err) => console.warn("Failed to accept call via server:", err));
          } else if (isDecline && targetId) {
            notifyNativeCall("endCall");
            clearCallNotification();
            playCallSound("end");
            apiFetch("/api/calls/decline", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requestId: targetId,
                jobId: targetId,
                callerId: userUidRef.current,
                reason: "declined",
              }),
            }).catch(console.error);
          }
        }
      };

      App.getLaunchUrl().then((launchData) => {
        if (launchData && launchData.url) {
          handleDeepLink(launchData.url);
        }
      });

      const listenerPromise = App.addListener("appUrlOpen", (data) => {
        handleDeepLink(data.url);
      });

      return () => {
        listenerPromise.then((l) => l.remove()).catch(() => {});
      };
    }
  }, []);

  // Listen for Native CallKit & Dynamic Island answer/decline events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleNativeAnswer = (e: any) => {
      console.log("[GlobalCallManager] Native answer received from Dynamic Island / CallKit / Notification:", e?.detail);
      acceptCall();
    };

    const handleNativeDecline = (e: any) => {
      console.log("[GlobalCallManager] Native decline received from Dynamic Island / CallKit / Notification:", e?.detail);
      endCallWithLog("declined");
    };

    const handleCallInitiated = (e: any) => {
      const job = e?.detail?.job;
      if (job && job.activeCall) {
        console.log("[GlobalCallManager] Instant client-initiated call mounted:", job.requestId);
        const isGeneric = (name?: string | null) => {
          if (!name) return true;
          const lower = name.trim().toLowerCase();
          return lower === "caller" || lower === "user" || lower === "someone";
        };
        const name = job.activeCall.receiverName || job.activeCall.callee?.displayName;
        const photo = job.activeCall.receiverPhoto || job.activeCall.callee?.photoUrl;
        if (name && !isGeneric(name)) setPartnerName(name);
        if (photo) setPartnerPhoto(photo);
        setActiveJob(job);
      }
    };

    window.addEventListener("needNativeCallAnswer", handleNativeAnswer);
    window.addEventListener("needNativeCallDecline", handleNativeDecline);
    window.addEventListener("needCallInitiated", handleCallInitiated);

    return () => {
      window.removeEventListener("needNativeCallAnswer", handleNativeAnswer);
      window.removeEventListener("needNativeCallDecline", handleNativeDecline);
      window.removeEventListener("needCallInitiated", handleCallInitiated);
    };
  }, [activeJob?.requestId]);

  const fetchPartnerInfo = async (job: JobRequest, uid: string) => {
    try {
      const isCustomer = job.customerId === uid;
      const partnerId = isCustomer ? job.artisanId : job.customerId;

      // 1. Instant sessionStorage profile lookup (quota-free)
      if (typeof window !== "undefined") {
        try {
          const cachedCustomer = sessionStorage.getItem(`need_tech_customer_${job.requestId}`);
          if (cachedCustomer && !isCustomer) {
            const parsed = JSON.parse(cachedCustomer);
            const name = parsed.displayName || (parsed.firstName ? `${parsed.firstName} ${parsed.lastName || ""}`.trim() : null);
            if (name) setPartnerName(name);
            if (parsed.photoURL) setPartnerPhoto(parsed.photoURL);
            return;
          }
          const cachedArtisan = sessionStorage.getItem(`need_job_artisan_${job.requestId}`);
          if (cachedArtisan && isCustomer) {
            const parsed = JSON.parse(cachedArtisan);
            const name = parsed.name || parsed.businessName;
            if (name) setPartnerName(name);
            if (parsed.profilePictureUrl) setPartnerPhoto(parsed.profilePictureUrl);
            return;
          }
        } catch {}
      }

      if (!partnerId) return;

      const collectionName = isCustomer ? "artisans" : "users";
      let docRef = await getDoc(doc(db, collectionName, partnerId));
      if (!docRef.exists() && isCustomer) {
        docRef = await getDoc(doc(db, "users", partnerId));
      }

      if (docRef.exists()) {
        const data = docRef.data();
        if (isCustomer) {
          setPartnerName(data.businessName || data.name || data.firstName || "Technician");
          setPartnerPhoto(data.profilePictureUrl || data.photoURL);
        } else {
          setPartnerName(data.displayName || (data.firstName ? `${data.firstName} ${data.lastName || ""}`.trim() : "Customer"));
          setPartnerPhoto(data.photoURL || data.profilePictureUrl);
        }
      }
    } catch (e) {
      console.warn("fetchPartnerInfo note (quota/network):", e);
    }
  };

  // Local ringing auto-timeout: gives a full 45s of ringing opportunity on this device
  useEffect(() => {
    if (activeJob && activeJob.activeCall && activeJob.activeCall.status === "ringing") {
      const timer = setTimeout(() => {
        endCallWithLog("timeout");
      }, 45000);

      return () => clearTimeout(timer);
    }
  }, [activeJob?.requestId, (activeJob?.activeCall as any)?.callId, activeJob?.activeCall?.status]);

  const endCallWithLog = async (
    reason?: "cancelled" | "declined" | "timeout" | "ended",
    explicitDurationSec?: number
  ) => {
    if (!activeJob || !activeJob.activeCall || !userUid) return;

    playCallSound("end");
    notifyNativeCall("endCall");
    clearCallNotification();
    clearActiveOutgoingCallId();
    safeRemoveSession("need_active_outgoing_call_id");
    safeRemoveSession("need_active_outgoing_call_job");
    safeRemoveSession("need_active_outgoing_call");
    safeRemoveSession("need_my_answered_call");
    safeRemoveSession("need_my_answered_call_id");

    const targetJobId = activeJob.requestId;
    const finalReason = reason || "ended";
    const actualCallerId = activeJob.activeCall.callerId;
    const callId = (activeJob.activeCall as any)?.callId;

    let durationMs: number | null = null;
    if (typeof explicitDurationSec === "number" && explicitDurationSec > 0) {
      durationMs = explicitDurationSec * 1000;
    } else {
      const syncStartTime =
        activeJob.activeCall.bothConnectedAt || activeJob.activeCall.connectedAt;
      if (syncStartTime && finalReason === "ended") {
        durationMs = Math.max(0, Date.now() - syncStartTime);
      }
    }

    // Dismiss overlay immediately on initiator tap
    setActiveJob(null);

    // Call server to update Firestore & in-memory registry, and send cancel FCM pushes
    const endpoint = finalReason === "declined" ? "/api/calls/decline" : "/api/calls/end";
    apiFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: targetJobId,
        requestId: targetJobId,
        callId,
        callerId: actualCallerId,
        declinedBy: userUid,
        reason: finalReason,
        durationMs,
      }),
    }).catch((err) => console.error("Failed to end call via server:", err));
  };

  const acceptCall = async () => {
    if (!activeJob || !activeJob.activeCall) return;

    clearCallNotification();
    playCallSound("pickup");

    const targetJobId = activeJob.requestId;
    const effectiveSessionId = getSessionId();
    const effectiveDeviceId = getDeviceId();
    const effectivePlatform = getPlatformName();

    safeSetSession("need_my_answered_call", targetJobId);
    if ((activeJob.activeCall as any)?.callId) {
      safeSetSession("need_my_answered_call_id", (activeJob.activeCall as any).callId);
    }

    // Optimistically transition immediately into ongoing state on this device
    setActiveJob((prev) => {
      if (!prev || !prev.activeCall) return prev;
      return {
        ...prev,
        activeCall: {
          ...prev.activeCall,
          status: "ongoing",
          connectedAt: Date.now(),
          acceptedByDeviceId: effectiveDeviceId,
          acceptedByPlatform: effectivePlatform,
          acceptedBySession: effectiveSessionId,
        },
      };
    });

    apiFetch("/api/calls/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: targetJobId,
        jobId: targetJobId,
        sessionId: effectiveSessionId,
        deviceId: effectiveDeviceId,
        platform: effectivePlatform,
      }),
    }).catch((err) => console.warn("Failed to accept call via server:", err));
  };

  // Active call status poller:
  // When a call is active (ringing or ongoing), poll /api/calls/status every 1.5s.
  // This guarantees that if callee declines, caller's dial tone stops immediately (under 1.5s)
  // and if callee accepts, caller immediately connects to Agora, even if Firestore listener is throttled/blocked.
  useEffect(() => {
    if (!activeJob || !activeJob.activeCall || !userUid) return;

    const jobId = activeJob.requestId;
    const callId = (activeJob.activeCall as any).callId;
    const isCaller = activeJob.activeCall.callerId === userUid;

    let isPolling = true;

    const checkStatus = async () => {
      if (!isPolling) return;
      try {
        const res = await apiFetch(`/api/calls/status?jobId=${jobId}&callId=${callId || ""}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data || !data.success) return;

        if (data.status === "ended") {
          const endedReason = data.endedReason || "ended";
          notifyNativeCall("endCall");
          clearCallNotification();
          playCallSound("end");
          clearActiveOutgoingCallId();
          safeRemoveSession("need_active_outgoing_call_id");
          safeRemoveSession("need_active_outgoing_call_job");
          safeRemoveSession("need_active_outgoing_call");
          safeRemoveSession("need_my_answered_call");
          safeRemoveSession("need_my_answered_call_id");

          let text = "Call Ended";
          if (endedReason === "declined") {
            text = "Call Declined";
          } else if (endedReason === "cancelled") {
            text = "Call Cancelled";
          } else if (endedReason === "timeout") {
            text = "No Answer";
          }

          setTerminalState({
            status: endedReason,
            text,
            dismissAt: Date.now() + 1500,
          });

          setTimeout(() => {
            setActiveJob(null);
            setTerminalState(null);
          }, 1500);
        } else if (data.status === "ongoing" && isCaller && activeJobRef.current?.activeCall?.status === "ringing") {
          // Caller was ringing and callee accepted! Transition to ongoing immediately.
          setActiveJob((prev) => {
            if (!prev || !prev.activeCall) return prev;
            return {
              ...prev,
              activeCall: {
                ...prev.activeCall,
                status: "ongoing",
                connectedAt: data.activeCall?.connectedAt || Date.now(),
              },
            };
          });
        }
      } catch (err) {
        // Ignore network hiccups during poll
      }
    };

    const intervalId = setInterval(checkStatus, 1500);
    return () => {
      isPolling = false;
      clearInterval(intervalId);
    };
  }, [activeJob?.requestId, (activeJob?.activeCall as any)?.callId, activeJob?.activeCall?.status, userUid]);

  const handleBothConnected = async (jobId: string, timestamp: number) => {
    try {
      const { updateDoc, doc: fsDoc } = await import("firebase/firestore");
      await updateDoc(fsDoc(db, "jobRequests", jobId), {
        "activeCall.bothConnectedAt": timestamp,
      });
    } catch (e) {
      console.warn("handleBothConnected client update failed:", e);
    }
  };

  const isCallPresent = Boolean(activeJob && activeJob.activeCall && userUid);
  const rawActiveCall = activeJob?.activeCall;
  const isCaller = Boolean(isCallPresent && rawActiveCall?.callerId === userUid);

  const myDeviceId = getDeviceId();
  const activeCallId = (rawActiveCall as any)?.callId;
  const registeredOutgoingCallId = getActiveOutgoingCallId();

  // Outgoing Caller Device Isolation:
  // ONLY the exact physical device where the user tapped "Call" reflects the outgoing call
  // and connects to Agora. Other devices on the same account (e.g. laptop) stay completely idle.
  const isThisDeviceInitiator =
    (Boolean(activeCallId) && (
      registeredOutgoingCallId === activeCallId ||
      safeGetSession("need_active_outgoing_call_id") === activeCallId
    )) ||
    (Boolean((rawActiveCall as any)?.callerDeviceId) && (rawActiveCall as any)?.callerDeviceId === myDeviceId) ||
    (activeJobRef.current?.requestId === activeJob?.requestId &&
     Boolean(activeJobRef.current?.activeCall?.callId) &&
     activeJobRef.current?.activeCall?.callId === activeCallId);

  const isThisDeviceCaller = isCaller && isThisDeviceInitiator;

  // Incoming Receiver Device Isolation:
  // Once answered, only the device that tapped Answer connects to Agora.
  // Other devices that were ringing immediately stop ringing and stay idle.
  const isThisDeviceAcceptedReceiver = !isCaller && (
    (safeGetSession("need_my_answered_call") === activeJob?.requestId) ||
    (Boolean(activeCallId) && safeGetSession("need_my_answered_call_id") === activeCallId) ||
    (Boolean((rawActiveCall as any)?.acceptedByDeviceId) && (rawActiveCall as any)?.acceptedByDeviceId === myDeviceId)
  );

  const isRingingForMe = Boolean(isCallPresent && rawActiveCall?.status === "ringing" && !isCaller && !terminalState);
  const isRingingByMe = Boolean(isCallPresent && (rawActiveCall?.status === "ringing" || !!terminalState) && isThisDeviceCaller);
  const isOngoingForMe = Boolean(
    isCallPresent &&
    (rawActiveCall?.status === "ongoing" || (rawActiveCall?.status as string) === "connected" || (rawActiveCall?.status as string) === "accepted") &&
    (isCaller ? isThisDeviceCaller : isThisDeviceAcceptedReceiver) &&
    !terminalState
  );

  useEffect(() => {
    const isCallActive = isRingingForMe || isRingingByMe || isOngoingForMe;
    if (typeof document !== "undefined") {
      if (isCallActive) {
        document.body.setAttribute("data-in-call", "true");
      } else {
        document.body.removeAttribute("data-in-call");
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.removeAttribute("data-in-call");
      }
    };
  }, [isRingingForMe, isRingingByMe, isOngoingForMe]);

  if (!isCallPresent || !activeJob || !activeJob.activeCall || !userUid) return null;
  if (!isRingingForMe && !isRingingByMe && !isOngoingForMe) return null;

  const activeCall = activeJob.activeCall;

  const validBothConnectedAt =
    activeCall.bothConnectedAt &&
    (!activeCall.timestamp || activeCall.bothConnectedAt >= activeCall.timestamp)
      ? activeCall.bothConnectedAt
      : null;

  const isGeneric = (name?: string | null) => {
    if (!name) return true;
    const lower = name.trim().toLowerCase();
    return lower === "caller" || lower === "user" || lower === "someone" || lower === "customer" || lower === "technician";
  };

  const getCleanName = (candidates: (string | null | undefined)[], fallback: string) => {
    for (const cand of candidates) {
      if (cand && !isGeneric(cand)) return cand;
    }
    return fallback;
  };

  const defaultCalleeRole = activeJob.artisanId === userUid ? "Customer" : "Technician";
  const defaultCallerRole = activeJob.artisanId === userUid ? "Technician" : "Customer";

  const resolvedCalleeName = getCleanName(
    [(activeCall as any).receiverName, (activeCall as any).callee?.displayName, partnerName],
    defaultCalleeRole
  );
  const resolvedCalleePhoto =
    (activeCall as any).receiverPhoto || (activeCall as any).callee?.photoUrl || partnerPhoto;

  const resolvedCallerName = getCleanName(
    [(activeCall as any).callerName, (activeCall as any).caller?.displayName, partnerName],
    defaultCallerRole
  );
  const resolvedCallerPhoto =
    (activeCall as any).callerPhoto || (activeCall as any).caller?.photoUrl || partnerPhoto;

  const inCallPartnerName = isCaller ? resolvedCalleeName : resolvedCallerName;
  const inCallPartnerPhoto = isCaller ? resolvedCalleePhoto : resolvedCallerPhoto;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div className="pointer-events-auto">
        {isRingingForMe && (
          <IncomingCallModal
            callerName={resolvedCallerName}
            callerPhoto={resolvedCallerPhoto}
            callType={activeCall.type || (activeCall as any).callType || "audio"}
            jobTitle={activeJob.subcategory || activeJob.trade}
            onAccept={acceptCall}
            onDecline={() => endCallWithLog("declined")}
          />
        )}

        {isRingingByMe && (
          <OutgoingCallModal
            calleeName={resolvedCalleeName}
            calleePhoto={resolvedCalleePhoto}
            callType={activeCall.type || (activeCall as any).callType || "audio"}
            statusText={terminalState ? terminalState.text : "Calling..."}
            isTerminal={!!terminalState}
            onCancel={() => endCallWithLog("cancelled")}
          />
        )}

        {isOngoingForMe && (
          <AgoraCallModal
            jobId={activeJob.requestId}
            channelName={activeJob.requestId}
            uid={userUid}
            isVideo={(activeCall.type || (activeCall as any).callType) === "video"}
            isCaller={isCaller}
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
