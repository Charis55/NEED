"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { JobRequest, UserAccount } from "@/types";
import { Phone, MessageSquare, MapPin } from "lucide-react";
import GlobalSpinner from "@/components/GlobalSpinner";
import dynamicImport from "next/dynamic";
import { geocode } from "@/utils/location";
import { sessionId } from "@/utils/sessionId";

const TechnicianRoutingMap = dynamicImport(() => import("./TechnicianRoutingMap"), { ssr: false, loading: () => <GlobalSpinner text="LOADING MAP" /> });

export default function TechnicianRoutingWrapper({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobRequest | null>(null);
  const [customer, setCustomer] = useState<UserAccount | null>(null);
  const [destCoords, setDestCoords] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  const startCall = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!job || !customer) return;
    try {
      const { auth } = await import("@/lib/firebase");
      const { updateDoc, doc } = await import("firebase/firestore");
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      
      await updateDoc(doc(db, "jobRequests", job.requestId), {
        activeCall: {
          channelName: job.requestId,
          callerId: currentUser.uid,
          callerSessionId: sessionId,
          type: "audio",
          status: "ringing",
          timestamp: Date.now()
        }
      });
      fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: customer.uid,
          title: `Incoming audio call`,
          body: `${currentUser.displayName || 'Technician'} is calling you`,
          data: { requestId: job.requestId, type: "call" }
        })
      }).catch(err => console.error("Push failed:", err));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const jobRef = doc(db, "jobRequests", jobId);
    
    const unsubscribeJob = onSnapshot(jobRef, async (snapshot) => {
      if (snapshot.exists()) {
        const jobData = snapshot.data() as JobRequest;
        setJob(jobData);

        if (jobData.customerId && !customer) {
          const custRef = doc(db, "users", jobData.customerId);
          const custSnap = await getDoc(custRef);
          if (custSnap.exists()) {
            setCustomer(custSnap.data() as UserAccount);
          }
        }
        
        // Find lat/lng for customer's location
        if (!destCoords) {
          if (jobData.locationCoords) {
            setDestCoords(jobData.locationCoords);
          } else if (jobData.neighborhood) {
            try {
              const coords = await geocode(jobData.neighborhood);
              setDestCoords(coords);
            } catch (e) {
              console.error("Geocoding failed for destination", e);
              // Default fallback coords (Lagos)
              setDestCoords({ lat: 6.5244, lng: 3.3792 });
            }
          }
        }
        
        setLoading(false);
      } else {
        setError("Job not found.");
        setLoading(false);
      }
    }, (err) => {
      console.error(err);
      setError("Failed to load tracking data.");
      setLoading(false);
    });

    return () => unsubscribeJob();
  }, [jobId]);

  if (loading || !destCoords) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-12 bg-white border-4 border-black shadow-[8px_8px_0_0_#000]">
        <GlobalSpinner text="INITIALIZING NAVIGATION..." />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="w-full bg-[var(--color-brutal-red)] text-white p-8 border-4 border-black shadow-[8px_8px_0_0_#000] font-black text-xl text-center">
        {error || "Could not load navigation information."}
      </div>
    );
  }

  return (
    <>
      <div className="w-full lg:w-2/3 h-[50vh] lg:h-[70vh] mb-8 lg:mb-0">
        <div className="w-full h-full flex flex-col border-4 border-black shadow-[8px_8px_0_0_#000] relative bg-white overflow-hidden">
          <TechnicianRoutingMap jobId={jobId} destCoords={destCoords} />
        </div>
      </div>

      <div className="w-full lg:w-1/3 flex flex-col gap-6">
        {/* Status Panel */}
        <div className="bg-white border-4 border-black shadow-[8px_8px_0_0_#000] p-6">
          <h2 className="text-xl font-black text-black uppercase tracking-tighter mb-4 border-b-4 border-black pb-2">
            Status
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-[var(--color-brutal-teal)] border-2 border-black flex items-center justify-center text-2xl animate-bounce shadow-[2px_2px_0_0_#000] shrink-0">
              <MapPin className="w-6 h-6 stroke-[3]" />
            </div>
            <div className="min-w-0">
              <p className="font-black text-2xl uppercase tracking-tighter text-black truncate">
                {job.status === "en_route" ? "EN ROUTE" : job.status.replace('_', ' ')}
              </p>
              {(() => {
                const techLoc = job.technicianLocation;
                
                let distanceText = "-- KM";
                let etaText = "-- MINS";
                let progressPercent = 0;

                if (techLoc && destCoords) {
                  const distKm = calculateDistance(techLoc.lat, techLoc.lng, destCoords.lat, destCoords.lng);
                  distanceText = distKm < 1 ? `${Math.round(distKm * 1000)} M` : `${distKm.toFixed(1)} KM`;
                  const timeMins = Math.max(1, Math.round((distKm / 30) * 60));
                  etaText = `${timeMins} MIN${timeMins !== 1 ? 'S' : ''}`;
                  progressPercent = Math.max(0, Math.min(100, 100 - (distKm / 10) * 100));
                }
                
                if (job.status === "in_progress") {
                  distanceText = "0 M";
                  etaText = "ARRIVED";
                  progressPercent = 100;
                }

                return (
                  <>
                    <p className="text-sm font-bold text-gray-500 uppercase truncate">
                      Distance: <span className="text-black">{distanceText}</span> • ETA: <span className="text-black">{etaText}</span>
                    </p>
                  </>
                );
              })()}
            </div>
          </div>

          {(() => {
            const techLoc = job.technicianLocation;
            let progressPercent = 0;
            if (techLoc && destCoords) {
              const distKm = calculateDistance(techLoc.lat, techLoc.lng, destCoords.lat, destCoords.lng);
              progressPercent = Math.max(5, Math.min(100, 100 - (distKm / 10) * 100));
            }
            if (job.status === "in_progress") progressPercent = 100;

            return (
              <>
                <div className="w-full bg-gray-200 h-4 border-2 border-black mb-1 overflow-hidden">
                  <div className="bg-[var(--color-brutal-yellow)] h-full border-r-2 border-black transition-all" style={{ width: `${progressPercent}%` }}></div>
                </div>
                <p className="text-[10px] font-black text-right uppercase mt-1 tracking-wider text-gray-600">PROGRESS</p>
              </>
            );
          })()}
        </div>

        {/* Customer Info */}
        <div className="bg-[var(--color-brutal-yellow)] border-4 border-black shadow-[8px_8px_0_0_#000] p-6 flex flex-col gap-4">
          <div className="flex gap-4 items-center">
            <div className="w-16 h-16 bg-gray-200 border-2 border-black overflow-hidden shrink-0 shadow-[2px_2px_0_0_#000]">
              <img 
                src={customer?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer?.displayName || 'Customer')}&background=random&size=150`} 
                alt={customer?.displayName || 'Customer'} 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-xl text-black uppercase truncate">{customer?.displayName || "Customer"}</h3>
              <p className="font-bold text-sm text-black uppercase">{job.neighborhood || "Location Unknown"}</p>
            </div>
          </div>

          <div className="flex gap-3 mt-2">
            <button 
              onClick={startCall}
              className="flex-1 bg-black text-white font-black py-3 px-4 border-2 border-black flex items-center justify-center gap-2 hover:bg-white hover:text-black transition-colors shadow-[4px_4px_0_0_rgba(255,255,255,1)]"
            >
              <Phone className="w-5 h-5" /> CALL
            </button>
            <a 
              href={`/technician/chat/${job.requestId}`}
              className="flex-1 bg-white text-black font-black py-3 px-4 border-2 border-black flex items-center justify-center gap-2 hover:bg-[var(--color-brutal-blue)] transition-colors shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
            >
              <MessageSquare className="w-5 h-5" /> CHAT
            </a>
          </div>
        </div>

        {/* Job Summary */}
        <div className="bg-[var(--color-brutal-bg)] border-4 border-black shadow-[8px_8px_0_0_#000] p-6 text-sm font-bold uppercase">
          <h2 className="text-lg font-black text-black tracking-tighter mb-4 border-b-4 border-black pb-2">
            Job Details
          </h2>
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">ID:</span>
            <span className="text-black">{job.requestId.slice(-6)}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Service:</span>
            <span className="text-black">{job.subcategory}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Total:</span>
            <span className="text-black">₦{(job.counterOfferAmount || job.offerAmount || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </>
  );
}
