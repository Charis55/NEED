"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { JobRequest, UserAccount } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import dynamicImport from "next/dynamic";
import { geocode } from "@/utils/location";

const TechnicianRoutingMap = dynamicImport(() => import("./TechnicianRoutingMap"), { ssr: false, loading: () => <GlobalSpinner text="LOADING MAP" /> });

export default function TechnicianRoutingWrapper({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobRequest | null>(null);
  const [customer, setCustomer] = useState<UserAccount | null>(null);
  const [destCoords, setDestCoords] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        
        // Find lat/lng for customer's neighborhood if not already known
        if (jobData.neighborhood && !destCoords) {
          try {
            const coords = await geocode(jobData.neighborhood);
            setDestCoords(coords);
          } catch (e) {
            console.error("Geocoding failed for destination", e);
            // Default fallback coords (Lagos)
            setDestCoords({ lat: 6.5244, lng: 3.3792 });
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
    <div className="w-full h-full flex flex-col border-4 border-black shadow-[8px_8px_0_0_#000] relative bg-white overflow-hidden">
      <TechnicianRoutingMap jobId={jobId} destCoords={destCoords} />
    </div>
  );
}
