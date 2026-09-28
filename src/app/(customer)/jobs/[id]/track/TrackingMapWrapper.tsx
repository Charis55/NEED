"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { JobRequest, ArtisanProfile } from "@/types";
import { Phone, MessageSquare, Bike, Star } from "lucide-react";
import GlobalSpinner from "@/components/GlobalSpinner";
import dynamicImport from "next/dynamic";

const TrackingMap = dynamicImport(() => import("@/components/TrackingMap"), { ssr: false, loading: () => <GlobalSpinner text="LOADING TRACKING MAP" /> });

export default function TrackingMapWrapper({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobRequest | null>(null);
  const [technician, setTechnician] = useState<ArtisanProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const jobRef = doc(db, "jobRequests", jobId);
    
    const unsubscribeJob = onSnapshot(jobRef, async (snapshot) => {
      if (snapshot.exists()) {
        const jobData = snapshot.data() as JobRequest;
        setJob(jobData);

        if (jobData.artisanId) {
          const artisanRef = doc(db, "artisans", jobData.artisanId);
          // In a real live tracking app, we would also onSnapshot the artisan profile or a dedicated location document
          // For now, we'll just getDoc to populate the initial details.
          const artisanSnap = await getDoc(artisanRef);
          if (artisanSnap.exists()) {
            setTechnician(artisanSnap.data() as ArtisanProfile);
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

  if (loading) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-12 bg-white border-4 border-black shadow-[8px_8px_0_0_#000]">
        <GlobalSpinner text="INITIALIZING TRACKER..." />
      </div>
    );
  }

  if (error || !job || !technician) {
    return (
      <div className="w-full bg-[var(--color-brutal-red)] text-white p-8 border-4 border-black shadow-[8px_8px_0_0_#000] font-black text-xl text-center">
        {error || "Could not load tracking information."}
      </div>
    );
  }

  return (
    <>
      <div className="w-full lg:w-2/3 h-[50vh] lg:h-[70vh] mb-8 lg:mb-0">
        <TrackingMap job={job} technician={technician} />
      </div>

      <div className="w-full lg:w-1/3 flex flex-col gap-6">
        {/* Status Panel */}
        <div className="bg-white border-4 border-black shadow-[8px_8px_0_0_#000] p-6">
          <h2 className="text-xl font-black text-black uppercase tracking-tighter mb-4 border-b-4 border-black pb-2">
            Status
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-[var(--color-brutal-teal)] border-2 border-black flex items-center justify-center text-2xl animate-bounce shadow-[2px_2px_0_0_#000]">
              <Bike className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <p className="font-black text-2xl uppercase tracking-tighter text-black">
                {job.status === "en_route" ? "EN ROUTE" : job.status.replace('_', ' ')}
              </p>
              <p className="text-sm font-bold text-gray-500 uppercase">Estimated arrival: 12 MINS</p>
            </div>
          </div>

          <div className="w-full bg-gray-200 h-4 border-2 border-black mb-1 overflow-hidden">
            <div className="bg-[var(--color-brutal-yellow)] h-full w-2/3 border-r-2 border-black transition-all"></div>
          </div>
          <p className="text-xs font-black text-right uppercase mt-2">66% COMPLETED</p>
        </div>

        {/* Technician Info */}
        <div className="bg-[var(--color-brutal-yellow)] border-4 border-black shadow-[8px_8px_0_0_#000] p-6 flex flex-col gap-4">
          <div className="flex gap-4 items-center">
            <div className="w-16 h-16 bg-gray-200 border-2 border-black overflow-hidden shrink-0 shadow-[2px_2px_0_0_#000]">
              <img 
                src={technician.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(technician.name || 'Tech')}&background=random&size=150`} 
                alt={technician.name} 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-xl text-black uppercase truncate">{technician.name || "Technician"}</h3>
              <p className="font-bold text-sm text-black uppercase">{technician.trade}</p>
              <p className="text-xs font-black bg-white px-2 py-1 border-2 border-black inline-block mt-1">
                <span className="flex items-center justify-center gap-1"><Star className="w-3 h-3" /> {technician.ratingAverage.toFixed(1)}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-2">
            <a 
              href={`tel:${technician.userId}`} // Replace with actual phone if available in profile
              className="flex-1 bg-black text-white font-black py-3 px-4 border-2 border-black flex items-center justify-center gap-2 hover:bg-white hover:text-black transition-colors shadow-[4px_4px_0_0_rgba(255,255,255,1)]"
            >
              <Phone className="w-5 h-5" /> CALL
            </a>
            <a 
              href={`/chat/${job.requestId}`}
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
