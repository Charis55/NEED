"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, doc, setDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { JobRequest, ArtisanProfile } from "@/types";
import BackButton from "@/components/BackButton";
import { ArrowRight, MapPin, Clock, Info } from "lucide-react";
import { reverseGeocode } from "@/utils/location";

export default function RequestArtisanPage({ params }: { params: { artisanId: string } }) {
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [description, setDescription] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  
  // Location
  const [locationData, setLocationData] = useState<{lat: number, lng: number, name: string} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchArtisan = async () => {
      try {
        const docRef = doc(db, "artisans", params.artisanId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setArtisan(docSnap.data() as ArtisanProfile);
        } else {
          setError("Artisan not found.");
        }
      } catch (err) {
        console.error("Failed to fetch artisan:", err);
        setError("Error loading artisan profile.");
      } finally {
        setFetching(false);
      }
    };
    fetchArtisan();
  }, [params.artisanId]);

  const detectLocation = () => {
    setIsLocating(true);
    setLocationError("");
    if (!("geolocation" in navigator)) {
      setLocationError("Geolocation is not supported by your browser.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const name = await reverseGeocode(latitude, longitude);
          setLocationData({ lat: latitude, lng: longitude, name });
        } catch (err) {
          setLocationError("Failed to determine neighborhood from coordinates.");
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setLocationError("Location permission denied. Please enable it to continue.");
        setIsLocating(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) {
        router.push("/login");
        return;
      }

      if (!artisan) {
        setError("Cannot submit request. Artisan data is missing.");
        setLoading(false);
        return;
      }

      if (!locationData) {
        setError("Please detect your location before sending the request.");
        setLoading(false);
        return;
      }

      const parsedAmount = parseInt(offerAmount.replace(/,/g, ''), 10);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError("Please enter a valid offer amount.");
        setLoading(false);
        return;
      }

      const requestRef = doc(collection(db, "jobRequests"));
      const newRequest: JobRequest = {
        requestId: requestRef.id,
        customerId: user.uid,
        artisanId: params.artisanId,
        trade: artisan.trade || "Unknown",
        subcategory: artisan.subcategory || "Unknown",
        description,
        neighborhood: locationData.name,
        preferredTime,
        offerAmount: parsedAmount,
        counterOfferAmount: null,
        platformFee: parsedAmount * 0.35, // Example 35% fee
        status: "pending",
        createdAt: Date.now(),
        completedAt: null,
      };

      await setDoc(requestRef, newRequest);
      
      router.push("/?requested=true");
    } catch (err: any) {
      console.error(err);
      setError("Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="bg-[var(--color-brutal-bg)] min-h-screen flex items-center justify-center p-6">
        <div className="bg-[var(--color-brutal-yellow)] brutal-card p-6 flex items-center justify-center animate-pulse">
          <h2 className="text-2xl font-black uppercase tracking-tighter">LOADING...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col font-sans selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 flex items-center gap-4 bg-[var(--color-brutal-blue)] border-b-4 border-black brutal-shadow-sm">
        <BackButton className="bg-white text-black brutal-border brutal-shadow-sm hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-0 active:shadow-none transition-all w-10 h-10 flex items-center justify-center p-0" />
        <h1 className="text-3xl font-black text-black uppercase tracking-tighter leading-none">
          Book Service
        </h1>
      </div>

      <div className="px-6 py-8 pb-24 max-w-md mx-auto w-full">
        {artisan && (
          <div className="mb-8 bg-white brutal-card p-4 flex gap-4 items-center">
            <div className="w-16 h-16 bg-gray-200 border-2 border-black flex-shrink-0 shadow-[2px_2px_0_0_#000]">
              <img 
                src={artisan.portfolioPhotoUrls?.[0] || `https://i.pravatar.cc/150?u=${artisan.artisanId}`} 
                alt={artisan.name} 
                className="w-full h-full object-cover grayscale"
              />
            </div>
            <div>
              <p className="text-sm font-bold uppercase text-gray-500 mb-1">Requesting</p>
              <h2 className="text-xl font-black uppercase tracking-tighter leading-none">{artisan.name}</h2>
              <p className="text-xs font-bold text-black border-l-2 border-black pl-1 mt-1">{artisan.subcategory || artisan.trade}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-[var(--color-brutal-red)] text-white p-4 brutal-border brutal-shadow-sm mb-8 font-bold flex items-center gap-2 uppercase tracking-tight text-sm">
            <Info className="w-5 h-5 stroke-[3]" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-[var(--color-brutal-yellow)] brutal-card p-6">
            <label className="block text-xl font-black uppercase tracking-tighter text-black mb-3 border-b-4 border-black pb-1">
              Job Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              placeholder="E.g., My kitchen sink is leaking heavily from the bottom pipe..."
              className="w-full p-3 brutal-border focus:outline-none focus:ring-4 focus:ring-black text-black font-medium resize-none bg-white placeholder:text-gray-400"
            />
          </div>

          <div className="bg-white brutal-card p-6">
            <label className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter text-black mb-1">
              <MapPin className="w-5 h-5 stroke-[3]" /> Location *
            </label>
            <p className="text-xs font-bold text-gray-500 mb-3">We need your location so the artisan knows where to go.</p>
            
            {locationData ? (
              <div className="p-4 bg-[var(--color-brutal-teal)] brutal-border font-black text-black uppercase flex justify-between items-center">
                <span className="truncate mr-2">📍 {locationData.name}</span>
                <button 
                  type="button" 
                  onClick={detectLocation}
                  className="text-xs bg-white px-2 py-1 border-2 border-black hover:-translate-y-0.5 transition-transform flex-shrink-0"
                >
                  {isLocating ? "..." : "UPDATE"}
                </button>
              </div>
            ) : (
              <button 
                type="button"
                onClick={detectLocation}
                disabled={isLocating}
                className="w-full p-4 bg-[var(--color-brutal-yellow)] brutal-btn text-black font-black uppercase text-left flex justify-between items-center"
              >
                <span>{isLocating ? "DETECTING..." : "📍 DETECT MY LOCATION"}</span>
              </button>
            )}
            
            {locationError && (
              <p className="text-[var(--color-brutal-red)] font-black text-sm mt-2 uppercase">{locationError}</p>
            )}
          </div>

          <div className="bg-[var(--color-brutal-teal)] brutal-card p-6">
            <label className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter text-black mb-3">
              <Clock className="w-5 h-5 stroke-[3]" /> Timing
            </label>
            <input
              type="text"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              required
              placeholder="E.g., Today at 2 PM, ASAP"
              className="w-full p-3 brutal-border focus:outline-none focus:ring-4 focus:ring-black text-black font-medium bg-white placeholder:text-gray-400"
            />
          </div>

          <div className="bg-[var(--color-brutal-pink)] brutal-card p-6">
            <label className="block text-lg font-black uppercase tracking-tighter text-black mb-1">
              Your Offer
            </label>
            <p className="text-xs font-bold text-black mb-3 leading-tight border-l-2 border-black pl-2">
              The artisan can accept, decline, or counter this offer.
            </p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-black text-xl">₦</span>
              <input
                type="number"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                required
                min="500"
                placeholder="5000"
                className="w-full pl-10 p-3 brutal-border focus:outline-none focus:ring-4 focus:ring-black text-black font-black text-xl bg-white placeholder:text-gray-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white brutal-btn py-4 text-xl flex items-center justify-between px-6"
          >
            <span>{loading ? "SUBMITTING..." : "SEND REQUEST"}</span>
            {!loading && <ArrowRight className="w-6 h-6 stroke-[3]" />}
          </button>
        </form>
      </div>
    </div>
  );
}
