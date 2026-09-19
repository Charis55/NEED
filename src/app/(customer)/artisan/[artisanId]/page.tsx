"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { ArtisanProfile, Review } from "@/types";
import { ChevronLeft, Star, MapPin, BadgeCheck, Clock, Calendar, X } from "lucide-react";
import BackButton from "@/components/BackButton";
import GlobalSpinner from "@/components/GlobalSpinner";

export default function ArtisanProfilePage({ params }: { params: Promise<{ artisanId: string }> }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [artisanUser, setArtisanUser] = useState<any>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"about" | "reviews">("about");
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, "artisans", unwrappedParams.artisanId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setArtisan(docSnap.data() as ArtisanProfile);
          
          const userDocSnap = await getDoc(doc(db, "users", unwrappedParams.artisanId));
          if (userDocSnap.exists()) {
            setArtisanUser(userDocSnap.data());
          }
          
          // Fetch Reviews
          const q = query(
            collection(db, "reviews"),
            where("artisanId", "==", unwrappedParams.artisanId),
          );
          const reviewSnap = await getDocs(q);
          const reviewData = reviewSnap.docs.map(d => d.data() as Review).sort((a, b) => b.createdAt - a.createdAt);
          setReviews(reviewData);
        } else {
          router.push("/explore");
        }
      } catch (err) {
        console.error("Failed to fetch artisan profile", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [unwrappedParams.artisanId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center p-4">
        <GlobalSpinner text="LOADING TECHNICIAN" />
      </div>
    );
  }

  if (!artisan) return null;

  return (
    <div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col font-sans pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 flex-shrink-0 bg-white border-b-4 border-black">
        <div className="flex justify-between items-center mb-6">
          <BackButton className="w-12 h-12 bg-white text-black brutal-border brutal-shadow-sm flex items-center justify-center p-0 hover:-translate-y-1 transition-transform" />
          
          <button 
            onClick={() => router.push(`/artisans/${artisan.artisanId}/request`)}
            className="px-4 py-2 bg-[var(--color-brutal-yellow)] font-black uppercase text-sm border-2 border-black brutal-shadow-sm hover:-translate-y-1 transition-transform"
          >
            REQUEST
          </button>
        </div>
        
        <div className="flex flex-col items-center text-center mt-2">
          <div 
            className="w-32 h-32 bg-[var(--color-brutal-blue)] brutal-border brutal-shadow mb-4 overflow-hidden cursor-pointer hover:scale-105 transition-transform"
            onClick={() => setFullscreenImage(artisan.portfolioPhotoUrls?.[0] || "https://i.pravatar.cc/1024?u=" + artisan.artisanId)}
          >
            <img 
              src={artisan.portfolioPhotoUrls?.[0] || "https://i.pravatar.cc/150?u=" + artisan.artisanId} 
              alt={artisan.name} 
              className="w-full h-full object-cover grayscale contrast-125"
            />
          </div>
          
          <h1 className="text-4xl font-black text-black uppercase tracking-tighter leading-tight">{artisanUser?.displayName || (artisanUser?.firstName ? `${artisanUser.firstName} ${artisanUser.lastName}` : "Technician")}</h1>
          {artisan.services && artisan.services.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2 mt-2 max-w-sm">
              {artisan.services.map((svc, i) => (
                <p key={i} className={`text-black text-xs font-bold uppercase bg-[var(--color-brutal-pink)] px-2 ${i % 2 === 0 ? 'rotate-1' : '-rotate-1'} border-2 border-black inline-block`}>
                  {svc.trade} • {svc.subcategory}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-black font-bold uppercase mt-1 bg-[var(--color-brutal-pink)] px-2 rotate-1 border-2 border-black inline-block">
              {artisan.trade} • {artisan.subcategory}
            </p>
          )}

          <div className="flex items-center gap-3 mt-4">
            <div className="inline-flex items-center gap-1 bg-white text-black border-2 border-black px-3 py-1 font-black text-sm shadow-[2px_2px_0_0_#000]">
              <Star className="w-4 h-4 fill-[var(--color-brutal-yellow)]" />
              <span>{artisan.ratingAverage > 0 ? artisan.ratingAverage.toFixed(1) : "NEW"}</span>
              <span className="text-gray-500 ml-1">({artisan.ratingCount})</span>
            </div>
            {artisan.isCertificateVerified && (
              <div className="inline-flex items-center gap-1 bg-[var(--color-brutal-teal)] text-black border-2 border-black px-3 py-1 font-black text-sm shadow-[2px_2px_0_0_#000]">
                <BadgeCheck className="w-4 h-4 stroke-[3]" />
                <span>CERTIFIED</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex w-full border-b-4 border-black bg-white sticky top-0 z-10">
        <button 
          onClick={() => setActiveTab("about")}
          className={`flex-1 py-4 font-black uppercase text-lg border-r-4 border-black transition-colors ${
            activeTab === "about" ? "bg-[var(--color-brutal-yellow)] text-black" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          About
        </button>
        <button 
          onClick={() => setActiveTab("reviews")}
          className={`flex-1 py-4 font-black uppercase text-lg transition-colors ${
            activeTab === "reviews" ? "bg-[var(--color-brutal-yellow)] text-black" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          Reviews
        </button>
      </div>

      {/* Tab Content */}
      <div className="px-6 pt-8">
        {activeTab === "about" && (
          <div className="space-y-6">
            <div className="bg-white border-4 border-black p-5 brutal-shadow-sm">
              <h2 className="text-xl font-black uppercase mb-4 border-b-2 border-black pb-2">Location</h2>
              <div className="flex items-center gap-3 font-bold text-black uppercase">
                <MapPin className="w-6 h-6 stroke-[3] text-[var(--color-brutal-pink)]" />
                {artisan.neighborhood}
              </div>
            </div>

            <div className="bg-white border-4 border-black p-5 brutal-shadow-sm">
              <h2 className="text-xl font-black uppercase mb-4 border-b-2 border-black pb-2">Experience</h2>
              <div className="flex items-center gap-3 font-bold text-black uppercase mb-3">
                <Clock className="w-6 h-6 stroke-[3] text-[var(--color-brutal-blue)]" />
                {artisan.yearsOfExperience} Years
              </div>
              <div className="flex items-center gap-3 font-bold text-black uppercase">
                <BadgeCheck className="w-6 h-6 stroke-[3] text-[var(--color-brutal-teal)]" />
                Skill: {artisan.skillLevel}
              </div>
            </div>

            <div className="bg-white border-4 border-black p-5 brutal-shadow-sm">
              <h2 className="text-xl font-black uppercase mb-4 border-b-2 border-black pb-2">Biography</h2>
              <p className="font-medium text-black leading-relaxed">
                {artisan.bio || "No biography provided."}
              </p>
            </div>

            {artisan.portfolioPhotoUrls && artisan.portfolioPhotoUrls.length > 0 && (
              <div className="bg-white border-4 border-black p-5 brutal-shadow-sm">
                <h2 className="text-xl font-black uppercase mb-4 border-b-2 border-black pb-2">Portfolio</h2>
                <div className="grid grid-cols-2 gap-4">
                  {artisan.portfolioPhotoUrls.map((url, i) => (
                    <div 
                      key={i} 
                      className="aspect-square bg-gray-200 border-2 border-black overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setFullscreenImage(url)}
                    >
                      <img src={url} alt={`Portfolio ${i}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-6">
            {reviews.length === 0 ? (
              <div className="bg-white border-4 border-black p-8 text-center brutal-shadow-sm">
                <div className="text-4xl mb-4">⭐</div>
                <h3 className="text-2xl font-black uppercase text-black mb-2">No Reviews Yet</h3>
                <p className="font-bold text-gray-500">Be the first to hire and review {artisan.name || "this pro"}!</p>
              </div>
            ) : (
              reviews.map((review) => (
                <div key={review.reviewId} className="bg-white border-4 border-black p-5 brutal-shadow-sm flex flex-col relative">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex text-[var(--color-brutal-yellow)] mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`w-5 h-5 ${star <= review.rating ? "fill-current" : "stroke-black"}`} />
                        ))}
                      </div>
                      <p className="font-black uppercase text-sm">{review.jobTitle}</p>
                    </div>
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 border border-black">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <p className="font-medium text-black mb-4">"{review.comment}"</p>
                  
                  {review.photos && review.photos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                      {review.photos.map((photo, i) => (
                        <div 
                          key={i} 
                          className="w-20 h-20 flex-shrink-0 border-2 border-black bg-gray-200 cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => setFullscreenImage(photo)}
                        >
                          <img src={photo} alt="Work done" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Image Lightbox */}
      {fullscreenImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setFullscreenImage(null)}>
          <button 
            onClick={() => setFullscreenImage(null)}
            className="absolute top-6 right-6 w-12 h-12 bg-white border-4 border-black flex items-center justify-center hover:bg-[var(--color-brutal-red)] hover:text-white transition-colors brutal-shadow-sm z-10"
          >
            <X className="w-8 h-8 stroke-[3]" />
          </button>
          
          <img 
            src={fullscreenImage} 
            alt="Fullscreen View" 
            className="max-w-full max-h-[90vh] object-contain border-4 border-black brutal-shadow bg-white"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
}
