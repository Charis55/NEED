"use client";

import { useState, useEffect, use } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, doc, setDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { JobRequest, ArtisanProfile } from "@/types";
import BackButton from "@/components/BackButton";
import { ArrowRight, MapPin, Clock, Info, Image as ImageIcon, X } from "lucide-react";
import { reverseGeocode } from "@/utils/location";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { compressImage } from "@/utils/imageCompression";

export default function RequestArtisanPage({ params }: { params: Promise<{ artisanId: string }> }) {
  const unwrappedParams = use(params);
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [selectedServiceIndex, setSelectedServiceIndex] = useState(0);
  
  // Draft persistence — survives page refreshes and dropped connections
  const [draft, setDraft, clearDraft] = useLocalDraft(`request-${unwrappedParams.artisanId}`, {
    description: "",
    preferredDate: "",
    preferredTime: "",
    offerAmount: "",
  });
  
  // Location (not persisted — requires fresh geolocation permission)
  const [locationData, setLocationData] = useState<{lat: number, lng: number, name: string} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  
  // Media upload
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchArtisan = async () => {
      try {
        const docRef = doc(db, "artisans", unwrappedParams.artisanId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const artisanData = docSnap.data() as ArtisanProfile;
          setArtisan(artisanData);
          
          if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            
            // Pre-fill service selection
            const tradeParam = urlParams.get('trade');
            const subParam = urlParams.get('subcategory');
            if (tradeParam && subParam && artisanData.services) {
               const idx = artisanData.services.findIndex(s => s.trade === tradeParam && s.subcategory === subParam);
               if (idx !== -1) setSelectedServiceIndex(idx);
            }

            // Pre-fill description if empty
            const descParam = urlParams.get('desc');
            if (descParam && !draft.description) {
              setDraft({ description: descParam });
            }
          }
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
  }, [unwrappedParams.artisanId]);

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
  
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check size (e.g. 50MB max for videos)
    if (file.size > 50 * 1024 * 1024) {
      setError("File is too large. Maximum size is 50MB.");
      return;
    }
    
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };
  
  const uploadFileToR2 = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const res = await fetch('/api/upload-direct', {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      throw new Error("Failed to upload file");
    }
    
    const { publicUrl } = await res.json();
    return publicUrl;
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

      const parsedAmount = parseInt(draft.offerAmount.replace(/,/g, ''), 10);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError("Please enter a valid offer amount.");
        setLoading(false);
        return;
      }

      let platformFeeRate = 0.20;
      if (artisan?.createdAt) {
        const createdAtMs = typeof artisan.createdAt === "number" 
          ? artisan.createdAt 
          : (artisan.createdAt as any).toMillis?.() || Date.now();
        const daysSinceSignup = Math.floor((Date.now() - createdAtMs) / (1000 * 60 * 60 * 24));
        if (daysSinceSignup <= 30) {
          platformFeeRate = 0;
        }
      }

      let mediaUrl = null;
      if (mediaFile) {
        try {
          // Compress if image, just upload if video
          let fileToUpload = mediaFile;
          if (mediaFile.type.startsWith('image/')) {
            fileToUpload = await compressImage(mediaFile, 2);
            fileToUpload = new File([fileToUpload], mediaFile.name, { type: mediaFile.type });
          }
          mediaUrl = await uploadFileToR2(fileToUpload);
        } catch (uploadErr) {
          console.error(uploadErr);
          setError("Failed to upload media. Please try again or remove it.");
          setLoading(false);
          return;
        }
      }

      const requestRef = doc(collection(db, "jobRequests"));
      const newRequest: JobRequest & { mediaUrl?: string } = {
        requestId: requestRef.id,
        customerId: user.uid,
        artisanId: unwrappedParams.artisanId,
        trade: artisan.services?.[selectedServiceIndex]?.trade || artisan.trade || "Unknown",
        subcategory: artisan.services?.[selectedServiceIndex]?.subcategory || artisan.subcategory || "Unknown",
        description: draft.description,
        neighborhood: locationData.name,
        preferredTime: `${draft.preferredDate} at ${draft.preferredTime}`,
        offerAmount: parsedAmount,
        counterOfferAmount: null,
        platformFee: parsedAmount * platformFeeRate,
        status: "pending",
        createdAt: Date.now(),
        completedAt: null,
        ...(mediaUrl && { mediaUrl })
      };

      await setDoc(requestRef, newRequest);
      
      // Trigger Push Notification to artisan via API
      fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: unwrappedParams.artisanId,
          title: "New Job Request!",
          body: `A customer requested you for a job in ${newRequest.neighborhood}.`,
          data: { requestId: requestRef.id, type: "new_request" }
        })
      }).catch(err => console.error("Failed to push:", err));

      // Trigger New Job Request Email
      fetch('/api/emails/new-job-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artisanId: unwrappedParams.artisanId,
          customerName: user.displayName || "A customer",
          trade: newRequest.trade,
          neighborhood: newRequest.neighborhood,
          preferredTime: newRequest.preferredTime
        }),
      }).catch(e => console.error("Failed to send job request email:", e));

      clearDraft(); // Clear the saved draft on successful submission
      router.push("/?requested=true");
    } catch (err) {
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

      <div className="px-6 py-8 pb-24 max-w-3xl mx-auto w-full">
        {artisan && (
          <div className="mb-8 bg-white brutal-card p-4 flex gap-4 items-center">
            <div className="w-16 h-16 bg-gray-200 border-2 border-black flex-shrink-0 shadow-[2px_2px_0_0_#000]">
              <img 
                src={artisan.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(artisan.name || 'Artisan')}&background=random&size=150`} 
                alt={artisan.name} 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-sm font-bold uppercase text-gray-500 mb-1">Requesting</p>
              <h2 className="text-xl font-black uppercase tracking-tighter leading-none">{artisan.name}</h2>
              {artisan.services && artisan.services.length > 1 ? (
                <select 
                  className="mt-2 text-xs font-bold text-black border-2 border-black p-1 bg-[var(--color-brutal-pink)] outline-none cursor-pointer w-full"
                  value={selectedServiceIndex}
                  onChange={(e) => setSelectedServiceIndex(Number(e.target.value))}
                >
                  {artisan.services.map((svc, i) => (
                    <option key={i} value={i}>{svc.trade} • {svc.subcategory}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs font-bold text-black border-l-2 border-black pl-1 mt-1">
                  {artisan.services?.[0]?.subcategory || artisan.subcategory || artisan.trade}
                </p>
              )}
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
              value={draft.description}
              onChange={(e) => setDraft({ description: e.target.value })}
              required
              rows={4}
              placeholder="E.g., My kitchen sink is leaking heavily from the bottom pipe..."
              className="w-full p-3 brutal-border focus:outline-none focus:ring-4 focus:ring-black text-black font-medium resize-none bg-white placeholder:text-gray-400"
            />
            
            <div className="mt-4 border-4 border-black p-4 bg-white">
              <label className="block text-sm font-black uppercase tracking-tighter text-black mb-2">
                Attach Photo or Video (Optional)
              </label>
              
              {mediaPreview ? (
                <div className="relative inline-block border-4 border-black">
                  {mediaFile?.type.startsWith('video/') ? (
                    <video src={mediaPreview} className="w-full max-w-[200px] max-h-[200px] object-cover" controls />
                  ) : (
                    <img src={mediaPreview} alt="Preview" className="w-full max-w-[200px] max-h-[200px] object-cover" />
                  )}
                  <button 
                    type="button"
                    onClick={() => {
                      setMediaFile(null);
                      setMediaPreview(null);
                    }}
                    className="absolute -top-3 -right-3 w-8 h-8 bg-[var(--color-brutal-red)] border-2 border-black flex items-center justify-center text-white hover:scale-110 transition-transform"
                  >
                    <X className="w-5 h-5 stroke-[3]" />
                  </button>
                </div>
              ) : (
                <label className="w-full md:w-auto inline-flex items-center gap-2 bg-[var(--color-brutal-pink)] text-black px-4 py-3 border-4 border-black font-black uppercase text-sm cursor-pointer hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all">
                  <ImageIcon className="w-5 h-5" /> Select File
                  <input 
                    type="file" 
                    accept="image/*,video/*" 
                    onChange={handleMediaSelect} 
                    className="hidden" 
                  />
                </label>
              )}
              <p className="text-xs font-bold text-gray-500 mt-2">Helps the technician understand the issue before accepting.</p>
            </div>
          </div>

          <div className="bg-white brutal-card p-6">
            <label className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter text-black mb-1">
              <MapPin className="w-5 h-5 stroke-[3]" /> Location *
            </label>
            <p className="text-xs font-bold text-gray-500 mb-3">We need your location so the technician knows where to go.</p>
            
            {locationData ? (
              <div className="p-4 bg-[var(--color-brutal-teal)] brutal-border font-black text-black uppercase flex justify-between items-center">
                <span className="truncate mr-2 flex items-center gap-1"><MapPin className="w-4 h-4 shrink-0" /> {locationData.name}</span>
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
                <span className="flex items-center gap-2">{isLocating ? "DETECTING..." : <><MapPin className="w-5 h-5" /> DETECT MY LOCATION</>}</span>
              </button>
            )}
            
            {locationError && (
              <p className="text-[var(--color-brutal-red)] font-black text-sm mt-2 uppercase">{locationError}</p>
            )}
          </div>

          <div className="bg-[var(--color-brutal-teal)] brutal-card p-6 flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter text-black mb-3">
                <Clock className="w-5 h-5 stroke-[3]" /> Date
              </label>
              <input
                type="date"
                value={draft.preferredDate}
                onChange={(e) => setDraft({ preferredDate: e.target.value })}
                required
                className="w-full p-3 brutal-border focus:outline-none focus:ring-4 focus:ring-black text-black font-black bg-white"
              />
            </div>
            <div className="flex-1">
              <label className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter text-black mb-3">
                <Clock className="w-5 h-5 stroke-[3]" /> Time
              </label>
              <input
                type="time"
                value={draft.preferredTime}
                onChange={(e) => setDraft({ preferredTime: e.target.value })}
                required
                className="w-full p-3 brutal-border focus:outline-none focus:ring-4 focus:ring-black text-black font-black bg-white"
              />
            </div>
          </div>

          <div className="bg-[var(--color-brutal-pink)] brutal-card p-6">
            <label className="block text-lg font-black uppercase tracking-tighter text-black mb-1">
              Your Offer
            </label>
            <p className="text-xs font-bold text-black mb-3 leading-tight border-l-2 border-black pl-2">
              The technician can accept, decline, or counter this offer.
            </p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-black text-xl">₦</span>
              <input
                type="number"
                value={draft.offerAmount}
                onChange={(e) => setDraft({ offerAmount: e.target.value })}
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
            className="w-full bg-black !text-white brutal-btn py-4 text-xl flex items-center justify-between px-6"
          >
            <span>{loading ? "SUBMITTING..." : "SEND REQUEST"}</span>
            {!loading && <ArrowRight className="w-6 h-6 stroke-[3]" />}
          </button>
        </form>
      </div>
    </div>
  );
}
