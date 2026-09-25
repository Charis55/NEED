"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { ArtisanProfile, JobRequest, UserAccount } from "@/types";
import { ArrowLeft, User, Phone, MapPin, Calendar, CheckCircle, Clock, XCircle, Settings, Ban, Wrench, ShieldCheck, FileText, Briefcase, AlertTriangle, Camera, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import GlobalSpinner from "@/components/GlobalSpinner";
import Image from "next/image";

export default function AdminTechnicianProfile() {
  const params = useParams();
  const artisanId = params.artisanId as string;
  const [artisan, setArtisans] = useState<ArtisanProfile | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (artisanId) fetchTechnicianData();
  }, [artisanId]);

  const fetchTechnicianData = async () => {
    try {
      const artisanDoc = await getDoc(doc(db, "artisans", artisanId));
      if (artisanDoc.exists()) {
        const artisanData = artisanDoc.data() as ArtisanProfile;
        setArtisans(artisanData);
        
        // Fetch corresponding user account for extra settings if it exists
        const userDoc = await getDoc(doc(db, "users", artisanId));
        if (userDoc.exists()) {
          setUserAccount(userDoc.data() as UserAccount);
        }
      }

      const q = query(
        collection(db, "jobRequests"),
        where("artisanId", "==", artisanId),
        orderBy("createdAt", "desc")
      );
      const jobsSnap = await getDocs(q);
      setJobs(jobsSnap.docs.map(doc => doc.data() as JobRequest));
    } catch (error) {
      console.error("Error fetching technician data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#FFF0E5] flex justify-center items-center"><GlobalSpinner text="LOADING TECHNICIAN..." /></div>;
  }

  if (!artisan) {
    return (
      <div className="min-h-screen bg-[#FFF0E5] p-8">
        <Link href="/admin" className="inline-flex items-center gap-2 mb-8 bg-white border-2 border-black px-4 py-2 font-black uppercase shadow-[4px_4px_0_0_#000]">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="bg-white border-4 border-black p-12 text-center shadow-[8px_8px_0_0_#000]">
          <h2 className="text-3xl font-black uppercase">Technician Not Found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF0E5] pb-24">
      <div className="bg-[var(--color-brutal-yellow)] pt-12 pb-16 px-6 md:px-12 border-b-4 border-black mb-8 relative overflow-hidden">
        <div className="absolute -right-20 -bottom-20 opacity-20 transform -rotate-12 pointer-events-none">
          <Wrench className="w-96 h-96 text-black" />
        </div>
        
        <div className="max-w-5xl mx-auto relative z-10">
          <Link href="/admin" className="inline-flex items-center gap-2 mb-8 bg-white border-2 border-black px-4 py-2 font-black uppercase shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="w-32 h-32 bg-white border-4 border-black shadow-[4px_4px_0_0_#000] relative overflow-hidden">
              {artisan.profilePictureUrl ? (
                <Image src={artisan.profilePictureUrl} alt="Profile" fill className="object-cover" />
              ) : artisan.portfolioPhotoUrls && artisan.portfolioPhotoUrls.length > 0 ? (
                <Image src={artisan.portfolioPhotoUrls[0]} alt="Profile" fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-black text-5xl">
                  {artisan.name?.charAt(0) || artisan.identityVerifiedName?.charAt(0) || "T"}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">{artisan.name || artisan.identityVerifiedName || "Unnamed Tech"}</h1>
                {artisan.verified && (
                  <ShieldCheck className="w-8 h-8 text-[#CCFF00] fill-black" />
                )}
              </div>
              <p className="font-bold text-lg border-l-4 border-black pl-3 bg-white inline-block pr-3 -rotate-1">
                {artisan.trade}
              </p>
              {artisan.certificateVerificationStatus === "rejected" && (
                <p className="mt-3 font-black text-white bg-red-600 border-2 border-black px-3 py-1 uppercase tracking-widest inline-block shadow-[2px_2px_0_0_#000]">
                  ACCESS REVOKED
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-12 space-y-8">
        
        {/* Profile Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
            <h2 className="text-2xl font-black uppercase border-b-4 border-black pb-2 mb-4 flex items-center gap-2">
              <User className="w-6 h-6" /> Technician Details
            </h2>
            <div className="space-y-4 font-bold">
              <div className="flex justify-between border-b-2 border-dashed border-gray-300 pb-2">
                <span className="text-gray-500 uppercase">Verified Name</span>
                <span>{artisan.identityVerifiedName || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b-2 border-dashed border-gray-300 pb-2">
                <span className="text-gray-500 uppercase">Contact Phone</span>
                <span>{userAccount?.phone || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b-2 border-dashed border-gray-300 pb-2">
                <span className="text-gray-500 uppercase">Neighborhood</span>
                <span className="text-right">{artisan.neighborhood || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b-2 border-dashed border-gray-300 pb-2">
                <span className="text-gray-500 uppercase">Trade</span>
                <span>{artisan.trade || "N/A"}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#E5F0FF] border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
            <h2 className="text-2xl font-black uppercase border-b-4 border-black pb-2 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6" /> Verification Status
            </h2>
            <div className="space-y-4 font-bold">
              <div className="flex justify-between border-b-2 border-dashed border-gray-400 pb-2">
                <span className="text-gray-700 uppercase">Overall Status</span>
                <span className={artisan.verified ? "text-emerald-700" : "text-red-600"}>
                  {artisan.verified ? "VERIFIED" : "NOT VERIFIED"}
                </span>
              </div>
              <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-400 flex flex-col items-center text-center">
                <p className="text-sm font-bold text-gray-600 mb-2 uppercase">Review Identity Documents</p>
                <a 
                  href="https://business.didit.me" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-black text-white font-black uppercase text-xs px-4 py-2 hover:bg-[var(--color-brutal-pink)] hover:text-black border-2 border-black transition-colors flex items-center gap-2"
                >
                  Open Didit Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex justify-between border-b-2 border-dashed border-gray-400 pb-2 mt-4">
                <span className="text-gray-700 uppercase">Certificate</span>
                <span className={artisan.certificateVerificationStatus === "auto_verified" || artisan.certificateVerificationStatus === "manually_verified" ? "text-emerald-700" : artisan.certificateVerificationStatus === "rejected" ? "text-red-600" : "text-amber-600"}>
                  {(artisan.certificateVerificationStatus || "pending").toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between border-b-2 border-dashed border-gray-400 pb-2">
                <span className="text-gray-700 uppercase">Police Clearance</span>
                <span className={artisan.policeClearanceStatus === "manually_verified" ? "text-emerald-700" : artisan.policeClearanceStatus === "rejected" ? "text-red-600" : "text-amber-600"}>
                  {(artisan.policeClearanceStatus || "pending").toUpperCase()}
                </span>
              </div>
              {artisan.manualReviewRequired && (
                <div className="mt-4 bg-amber-100 border-2 border-amber-400 p-2 text-amber-800 text-sm flex gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>Flagged for review: {artisan.manualReviewReasons?.join(", ")}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bio & Skills */}
        <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
          <h2 className="text-2xl font-black uppercase border-b-4 border-black pb-2 mb-4 flex items-center gap-2">
            <User className="w-6 h-6" /> Bio & Skills
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-gray-500 uppercase tracking-widest text-xs mb-1">Bio / Experience</h3>
              <p className="font-medium text-lg leading-relaxed">{artisan.bio || "No bio provided."}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#FFF0E5] border-2 border-black p-3">
                <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Years of Experience</span>
                <span className="font-black text-xl uppercase">{artisan.yearsOfExperience || "N/A"}</span>
              </div>
              <div className="bg-[#FFF0E5] border-2 border-black p-3">
                <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Skill Level</span>
                <span className="font-black text-xl uppercase">{artisan.skillLevel || "N/A"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
          <h2 className="text-2xl font-black uppercase border-b-4 border-black pb-2 mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6" /> Documents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-2 border-dashed border-black p-4 text-center bg-gray-50">
              <h3 className="font-black uppercase mb-2">Trade Certificate</h3>
              {artisan.certificateUrl ? (
                <a href={artisan.certificateUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[var(--color-brutal-teal)] border-2 border-black px-4 py-2 font-black uppercase hover:-translate-y-1 transition-transform">
                  View Document <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <p className="text-gray-500 font-bold">No certificate provided</p>
              )}
            </div>
            <div className="border-2 border-dashed border-black p-4 text-center bg-gray-50">
              <h3 className="font-black uppercase mb-2">Police Clearance</h3>
              {artisan.policeClearanceUrl ? (
                <a href={artisan.policeClearanceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[var(--color-brutal-yellow)] border-2 border-black px-4 py-2 font-black uppercase hover:-translate-y-1 transition-transform">
                  View Document <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <p className="text-gray-500 font-bold">No clearance provided</p>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio Photos */}
        <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
          <h2 className="text-2xl font-black uppercase border-b-4 border-black pb-2 mb-4 flex items-center gap-2">
            <Camera className="w-6 h-6" /> Portfolio Photos
          </h2>
          {artisan.portfolioPhotoUrls && artisan.portfolioPhotoUrls.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {artisan.portfolioPhotoUrls.map((url, idx) => (
                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="relative aspect-square border-2 border-black block hover:opacity-80 transition-opacity">
                  <Image src={url} alt={`Portfolio ${idx}`} fill className="object-cover" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 font-bold text-center py-4">No portfolio photos uploaded.</p>
          )}
        </div>

        {/* Job History */}
        <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
          <h2 className="text-2xl font-black uppercase border-b-4 border-black pb-2 mb-6 flex items-center gap-2">
            <Briefcase className="w-6 h-6" /> Job History ({jobs.length})
          </h2>

          {jobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-bold text-gray-500 uppercase tracking-widest">No jobs found for this technician.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map(job => (
                <div key={job.requestId} className="border-4 border-black p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 text-xs font-black uppercase tracking-widest border-2 border-black ${
                        job.status === "completed" ? "bg-[var(--color-brutal-green)] text-black" :
                        job.status === "cancelled" || job.status === "declined" ? "bg-red-400 text-black" :
                        "bg-[var(--color-brutal-yellow)] text-black"
                      }`}>
                        {job.status}
                      </span>
                      <span className="font-mono text-xs font-bold text-gray-500">#{job.requestId.slice(-6)}</span>
                    </div>
                    <h3 className="font-black text-lg uppercase tracking-tight">{job.trade} - {job.subcategory}</h3>
                    <div className="text-sm font-bold text-gray-600 flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4" /> {job.preferredTime}
                    </div>
                  </div>
                  
                  <div className="text-left md:text-right">
                    <p className="font-black text-xl">
                      ₦{(job.counterOfferAmount || job.offerAmount || 0).toLocaleString()}
                    </p>
                    <p className="text-xs font-bold text-gray-500 uppercase mt-1">
                      Customer ID: {job.customerId.slice(0, 8)}...
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
