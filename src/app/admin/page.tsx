"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { ArtisanProfile } from "@/types";
import { BadgeCheck, XCircle, MapPin, Briefcase, Star, Trash2 } from "lucide-react";
import Image from "next/image";

export default function AdminDashboard() {
  const [artisans, setArtisans] = useState<ArtisanProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "verified">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchArtisans();
  }, []);

  const fetchArtisans = async () => {
    try {
      const q = query(collection(db, "artisans"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const fetchedArtisans = snapshot.docs.map(doc => doc.data() as ArtisanProfile);
      setArtisans(fetchedArtisans);
    } catch (error) {
      console.error("Error fetching artisans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (artisanId: string, status: boolean) => {
    setActionLoading(artisanId);
    try {
      await updateDoc(doc(db, "artisans", artisanId), {
        verified: status
      });
      // Update local state to reflect change without refetching all
      setArtisans(prev => 
        prev.map(a => a.artisanId === artisanId ? { ...a, verified: status } : a)
      );
    } catch (error) {
      console.error("Error updating artisan verification:", error);
      alert("Failed to update verification status.");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredArtisans = artisans.filter(a => filter === "verified" ? a.verified : !a.verified);

  if (loading) {
    return <div className="text-center py-20 animate-pulse text-gray-500">Loading technicians...</div>;
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Technician Verification</h1>
          <p className="text-gray-500 mb-8">View and verify technician profiles.</p>
        </div>

        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
          <button
            onClick={() => setFilter("pending")}
            className={`px-4 py-2 rounded-md font-medium text-sm transition ${
              filter === "pending" 
                ? "bg-gray-900 text-white shadow" 
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Pending Review ({artisans.filter(a => !a.verified).length})
          </button>
          <button
            onClick={() => setFilter("verified")}
            className={`px-4 py-2 rounded-md font-medium text-sm transition ${
              filter === "verified" 
                ? "bg-gray-900 text-white shadow" 
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Verified ({artisans.filter(a => a.verified).length})
          </button>
        </div>
      </div>

      {filteredArtisans.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm">
          <BadgeCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No technicians found</h3>
          <p className="text-gray-500">
            {filter === "pending" ? "You're all caught up! No pending verifications." : "No verified technicians yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredArtisans.map((artisan) => (
            <div key={artisan.artisanId} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      {artisan.trade}
                      {artisan.verified && <BadgeCheck className="w-5 h-5 text-emerald-500" />}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <MapPin className="w-4 h-4 mr-1" />
                      {artisan.neighborhood}
                    </div>
                  </div>
                  <div className="flex items-center bg-gray-50 px-2 py-1 rounded-md text-sm font-medium">
                    <Star className="w-4 h-4 text-amber-400 mr-1 fill-amber-400" />
                    {artisan.ratingAverage.toFixed(1)} ({artisan.ratingCount})
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-6 line-clamp-3">
                  {artisan.bio}
                </p>

                {artisan.portfolioPhotoUrls && artisan.portfolioPhotoUrls.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Portfolio</h4>
                    <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                      {artisan.portfolioPhotoUrls.map((url, i) => (
                        <div key={i} className="relative w-20 h-20 flex-shrink-0 snap-start">
                          <Image 
                            src={url} 
                            alt="Portfolio photo" 
                            fill 
                            className="object-cover rounded-lg border border-gray-200" 
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-gray-400 mt-auto">
                  Joined: {new Date(artisan.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                {!artisan.verified ? (
                  <>
                    <button
                      onClick={() => handleVerify(artisan.artisanId, true)}
                      disabled={actionLoading === artisan.artisanId}
                      className="flex-1 bg-emerald-400 hover:bg-emerald-500 text-gray-900 font-bold py-2.5 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <BadgeCheck className="w-5 h-5" />
                      {actionLoading === artisan.artisanId ? "Verifying..." : "Verify Profile"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleVerify(artisan.artisanId, false)}
                    disabled={actionLoading === artisan.artisanId}
                    className="flex-1 bg-white border border-gray-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300 text-gray-700 font-bold py-2.5 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5" />
                    {actionLoading === artisan.artisanId ? "Revoking..." : "Revoke Verification"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
