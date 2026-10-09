"use client";

import { useState, useEffect, use } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { JobRequest } from "@/types";
import BackButton from "@/components/BackButton";
import { ArrowRight, MapPin, Clock, ChevronLeft } from "lucide-react";
import { reverseGeocode } from "@/utils/location";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import BookingTermsCheckbox from "@/components/BookingTermsCheckbox";

export default function MultiServiceBroadcastJobPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<{ services: string }>;
}) {
  const unwrappedParams = use(params);
  const unwrappedSearchParams = use(searchParams);
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  
  // Location
  const [locationData, setLocationData] = useState<{lat: number, lng: number, name: string} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Draft persistence
  const draftKey = `job_draft_broadcast_multi_${unwrappedParams.categorySlug}_${unwrappedSearchParams.services}`;
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.description) setDescription(parsed.description);
          if (parsed.preferredDate) setPreferredDate(parsed.preferredDate);
          if (parsed.preferredTime) setPreferredTime(parsed.preferredTime);
          if (parsed.offerAmount) setOfferAmount(parsed.offerAmount);
        } catch (e) {
          console.error("Failed to parse draft", e);
        }
      }
    }
  }, [draftKey]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const draft = { description, preferredDate, preferredTime, offerAmount };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    }
  }, [description, preferredDate, preferredTime, offerAmount, draftKey]);

  const decodeSlug = (slug: string) => decodeURIComponent(slug).replace(/-/g, ' ');

  const trade = decodeSlug(unwrappedParams.categorySlug);
  const selectedServices = unwrappedSearchParams.services 
    ? unwrappedSearchParams.services.split(',').map(s => decodeSlug(s))
    : [];

  const detectLocation = async () => {
    setIsLocating(true);
    setLocationError("");

    try {
      if (Capacitor.isNativePlatform()) {
        const permStatus = await Geolocation.checkPermissions();
        if (permStatus.location !== 'granted') {
          const reqStatus = await Geolocation.requestPermissions();
          if (reqStatus.location !== 'granted') {
            setLocationError("Location permission denied. Please enable it to continue.");
            setIsLocating(false);
            return;
          }
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      });

      const { latitude, longitude } = position.coords;
      const name = await reverseGeocode(latitude, longitude);
      setLocationData({ lat: latitude, lng: longitude, name });
    } catch (err: any) {
      console.error("Location error:", err);
      setLocationError("Failed to get your location. Please ensure GPS is enabled.");
    } finally {
      setIsLocating(false);
    }
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

      if (!locationData) {
        setError("Please detect your location before posting the job.");
        setLoading(false);
        return;
      }

      const parsedAmount = parseInt(offerAmount.replace(/,/g, ''), 10);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError("Please enter a valid offer amount.");
        setLoading(false);
        return;
      }

      const platformFeeRate = 0.20;

      const requestRef = doc(collection(db, "jobRequests"));
      const newRequest: JobRequest & { services?: {trade: string, subcategory: string}[] } = {
        requestId: requestRef.id,
        customerId: user.uid,
        artisanId: null,
        isBroadcast: true,
        trade: trade,
        subcategory: selectedServices[0] || "Unknown",
        services: selectedServices.map(s => ({ trade: trade, subcategory: s })),
        description,
        neighborhood: locationData.name,
        locationCoords: { lat: locationData.lat, lng: locationData.lng },
        preferredTime: `${preferredDate} at ${preferredTime}`,
        offerAmount: parsedAmount,
        counterOfferAmount: null,
        platformFee: parsedAmount * platformFeeRate,
        status: "pending",
        createdAt: Date.now(),
        completedAt: null,
      };

      await setDoc(requestRef, newRequest);
      
      if (typeof window !== "undefined") {
        localStorage.removeItem(draftKey);
      }
      
      router.push("/?requested=true");
    } catch (err: any) {
      console.error(err);
      setError("Failed to post job.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col font-sans selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <div className="px-6 pt-12 pb-6 border-b-4 border-black bg-white">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => router.back()}
            className="w-12 h-12 bg-white brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-x-0 active:translate-y-0 active:shadow-none"
          >
            <ChevronLeft className="w-6 h-6 text-black stroke-[3]" />
          </button>
        </div>
        
        <h1 className="text-4xl font-black text-black uppercase tracking-tighter leading-none mb-4">
          POST A JOB
        </h1>
        <p className="text-black font-bold text-sm bg-[var(--color-brutal-yellow)] inline-block px-2 py-1 brutal-border shadow-[2px_2px_0_0_#000] rotate-1">
          For {trade} • {selectedServices.join(", ")}
        </p>
      </div>

      <div className="flex-1 p-6 flex flex-col max-w-3xl mx-auto w-full">
        {error && (
          <div className="bg-[var(--color-brutal-red)] text-white p-4 font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0_0_#000] mb-6 transform -rotate-1">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 flex-1">
          <div className="bg-white brutal-card p-6">
            <label className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter text-black mb-1">
              <MapPin className="w-5 h-5 stroke-[3]" /> Location *
            </label>
            <p className="text-xs font-bold text-gray-500 mb-3">We need your location so available technicians know where to go.</p>
            
            {locationData ? (
              <div className="p-4 bg-[var(--color-brutal-teal)] brutal-border font-black text-black uppercase flex justify-between items-center border-4 border-black">
                <span>{locationData.name}</span>
                <button type="button" onClick={detectLocation} className="text-sm border-b-2 border-black pb-0.5 hover:text-white transition-colors">Update</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={detectLocation}
                disabled={isLocating}
                className="w-full bg-[var(--color-brutal-yellow)] brutal-btn py-4 text-black font-black uppercase tracking-widest flex items-center justify-center gap-2 border-4 border-black"
              >
                {isLocating ? "Detecting..." : "Detect Location"}
              </button>
            )}
            {locationError && <p className="text-[var(--color-brutal-red)] text-xs font-bold mt-2">{locationError}</p>}
          </div>

          <div className="bg-white brutal-card p-6 flex flex-col md:flex-row gap-4 overflow-hidden">
            <div className="flex-1 min-w-0">
              <label className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter text-black mb-1">
                <Clock className="w-5 h-5 stroke-[3]" /> Date *
              </label>
              <input
                type="date"
                required
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="w-full max-w-full min-w-0 p-4 brutal-input text-lg font-bold border-4 border-black appearance-none"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter text-black mb-1">
                <Clock className="w-5 h-5 stroke-[3]" /> Time *
              </label>
              <input
                type="time"
                required
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full max-w-full min-w-0 p-4 brutal-input text-lg font-bold border-4 border-black appearance-none"
              />
            </div>
          </div>

          <div className="bg-white brutal-card p-6">
            <label className="block text-lg font-black uppercase tracking-tighter text-black mb-1">
              Job Description *
            </label>
            <p className="text-xs font-bold text-gray-500 mb-3 leading-tight border-l-2 border-black pl-2">
              Provide details so any interested technician knows what to expect.
            </p>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what needs to be fixed or installed..."
              className="w-full p-4 brutal-input text-lg font-medium resize-none border-4 border-black"
            />
          </div>

          <div className="bg-[var(--color-brutal-pink)] brutal-card p-6">
            <label className="block text-lg font-black uppercase tracking-tighter text-black mb-1">
              Your Budget
            </label>
            <p className="text-xs font-bold text-black mb-3 leading-tight border-l-2 border-black pl-2">
              Interested technicians can accept, decline, or counter this offer.
            </p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-black text-xl">₦</span>
              <input
                type="text"
                required
                value={offerAmount}
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/[^0-9]/g, '');
                  if (numericValue) {
                    setOfferAmount(Number(numericValue).toLocaleString());
                  } else {
                    setOfferAmount('');
                  }
                }}
                placeholder="0"
                className="w-full pl-10 pr-4 py-4 brutal-input text-xl font-black border-4 border-black"
              />
            </div>
          </div>

          <BookingTermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} />

          <div className="mt-4 mb-8">
            <button
              type="submit"
              disabled={loading || !termsAccepted}
              className="w-full bg-[var(--color-brutal-blue)] py-5 brutal-btn text-xl uppercase flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              <span className="relative z-10">{loading ? "POSTING JOB..." : "POST JOB FOR EVERYONE"}</span>
              {!loading && <ArrowRight className="relative z-10 w-6 h-6 group-hover:translate-x-2 transition-transform" strokeWidth={3} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
