"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDoc, doc, updateDoc, runTransaction, increment } from "firebase/firestore";
import { JobRequest } from "@/types";
import IncomingCallModal from "./IncomingCallModal";
import OutgoingCallModal from "./OutgoingCallModal";
import dynamic from "next/dynamic";

const AgoraCallModal = dynamic(() => import("./AgoraCallModal"), { ssr: false });
export default function GlobalCallManager() {
  const [userUid, setUserUid] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<JobRequest | null>(null);
  const [partnerName, setPartnerName] = useState<string>("Someone");
  const [partnerPhoto, setPartnerPhoto] = useState<string | undefined>();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setUserUid(user ? user.uid : null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userUid) return;

    const qArtisan = query(collection(db, "jobRequests"), where("artisanId", "==", userUid));
    const qCustomer = query(collection(db, "jobRequests"), where("customerId", "==", userUid));

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
    };

    const unsubArtisan = onSnapshot(qArtisan, handleSnapshot);
    const unsubCustomer = onSnapshot(qCustomer, handleSnapshot);

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
      // Check how long it has been ringing
      const elapsed = Date.now() - activeJob.activeCall.timestamp;
      const remaining = 60000 - elapsed;
      if (remaining <= 0) {
        endCallWithLog("timeout");
      } else {
        const timer = setTimeout(() => {
          endCallWithLog("timeout");
        }, remaining);
        return () => clearTimeout(timer);
      }
    }
  }, [activeJob]);

  const endCallWithLog = async (reason?: "cancelled" | "declined" | "timeout" | "ended") => {
    if (!activeJob || !activeJob.activeCall || !userUid) return;
    
    // Optimistically hide UI
    const jobToProcess = activeJob;
    setActiveJob(null);

    try {
      await runTransaction(db, async (transaction) => {
        const jobRef = doc(db, "jobRequests", jobToProcess.requestId);
        const jobDoc = await transaction.get(jobRef);
        if (!jobDoc.exists()) return;
        
        const data = jobDoc.data() as JobRequest;
        if (!data.activeCall || data.activeCall.status === "ended") return;
        
        const isVideo = data.activeCall.type === "video";
        let durationText = "Missed Call";
        if (data.activeCall.connectedAt) {
          const durationMs = Date.now() - data.activeCall.connectedAt;
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
        const receiverId = data.customerId === data.activeCall.callerId ? data.artisanId : data.customerId;

        transaction.update(jobRef, {
          "activeCall.status": "ended",
          lastMessageText: messageText,
          lastMessageSenderId: data.activeCall.callerId,
          lastMessageAt: Date.now(),
          ...(receiverId ? { [`unreadCount.${receiverId}`]: increment(1) } : {})
        });

        const msgRef = doc(collection(db, "jobRequests", jobToProcess.requestId, "messages"));
        transaction.set(msgRef, {
          text: messageText,
          senderId: data.activeCall.callerId,
          createdAt: Date.now()
        });
      });
    } catch (e) {
      console.error("Failed to end call", e);
    }
  };

  const acceptCall = async () => {
    if (!activeJob) return;
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
