"use client";

import { useState, useEffect, use } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { JobRequest } from "@/types";
import BackButton from "@/components/BackButton";
import { ArrowRight, MapPin, Clock, ChevronLeft, Image as ImageIcon, X } from "lucide-react";
import { reverseGeocode } from "@/utils/location";
import { compressImage } from "@/utils/imageCompression";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import BookingTermsCheckbox from "@/components/BookingTermsCheckbox";

export default function BroadcastJobPage({ params }: { params: Promise<{ categorySlug: string, subSlug: string }> }) {
  const unwrappedParams = use(params);
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  
  // Location
  const [locationData, setLocationData] = useState<{lat: number, lng: number, name: string} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const router = useRouter();

  // Draft persistence
  const draftKey = `job_draft_broadcast_${unwrappedParams.categorySlug}_${unwrappedParams.subSlug}`;
  
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
  const subcategory = decodeSlug(unwrappedParams.subSlug);

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

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
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
    
    // Custom Validation
    const errors: Record<string, string> = {};
    if (!locationData) errors.location = "Please detect your location.";
    if (!preferredDate) errors.preferredDate = "Please select a date.";
    if (!preferredTime) errors.preferredTime = "Please select a time.";
    if (!description.trim()) errors.description = "Please describe the job.";
    
    const parsedAmount = parseInt(offerAmount.replace(/,/g, ''), 10);
    if (isNaN(parsedAmount) || parsedAmount < 500) {
      errors.offerAmount = "Please enter an offer amount of at least ₦500.";
    }
    
    if (!termsAccepted) {
      errors.terms = "You must accept the Booking Terms & Conditions.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setError("Please check the highlighted fields and try again.");
      return;
    }

    setFormErrors({});
    setLoading(true);
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) {
        router.push("/login");
        return;
      }

      let mediaUrl: string | null = null;
      if (mediaFile) {
        try {
          let fileToUpload = mediaFile;
          if (mediaFile.type.startsWith('image/')) {
            fileToUpload = await compressImage(mediaFile, 2);
            fileToUpload = new File([fileToUpload], mediaFile.name, { type: mediaFile.type });
          }
          mediaUrl = await uploadFileToR2(fileToUpload);
        } catch (uploadErr) {
          console.error("Upload error:", uploadErr);
          setError("Failed to upload media attachment. Please try again.");
          setLoading(false);
          return;
        }
      }

      const platformFeeRate = 0.20;

      const requestRef = doc(collection(db, "jobRequests"));
      const newRequest: JobRequest = {
        requestId: requestRef.id,
        customerId: user.uid,
        artisanId: null,
        isBroadcast: true,
        trade: trade,
        subcategory: subcategory,
        description,
        mediaUrl: mediaUrl || null,
        neighborhood: locationData?.name || "",
        locationCoords: { lat: locationData?.lat || 0, lng: locationData?.lng || 0 },
        preferredTime: `${preferredDate} at ${preferredTime}`,
        offerAmount: parsedAmount,
        agreedPrice: parsedAmount * 100,
        depositStatus: "none",
        depositPaid: 0,
        depositRequired: Math.round(parsedAmount * 100 * 0.25),
        counterOfferAmount: null,
        platformFee: parsedAmount * platformFeeRate,
        status: "pending",
        state: "pending",
        createdAt: Date.now(),
        completedAt: null,
      };

      await setDoc(requestRef, newRequest);
      
      if (typeof window !== "undefined") {
        localStorage.removeItem(draftKey);
      }
      
      router.push("/?requested=true");
    } catch (err) {
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
          For {trade} • {subcategory}
        </p>
      </div>

      <div className="flex-1 p-6 flex flex-col max-w-3xl mx-auto w-full">
        {error && (
          <div className="bg-[var(--color-brutal-red)] text-white p-4 font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0_0_#000] mb-6 transform -rotate-1">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6 flex-1">
          <div className="bg-white brutal-card p-6">
            <label className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter text-black mb-1">
              <MapPin className="w-5 h-5 stroke-[3]" /> Location *
            </label>
            <p className="text-xs font-bold text-gray-500 mb-3">We need your location so available technicians know where to go.</p>
            {formErrors.location && <p className="text-[var(--color-brutal-red)] text-sm font-black mb-2 uppercase border-2 border-[var(--color-brutal-red)] bg-white p-1 px-2">{formErrors.location}</p>}
            
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
              {formErrors.preferredDate && <p className="text-[var(--color-brutal-red)] text-xs font-black mb-1 uppercase">{formErrors.preferredDate}</p>}
              <input
                type="date"
                value={preferredDate}
                onChange={(e) => {
                  setPreferredDate(e.target.value);
                  if (formErrors.preferredDate) setFormErrors(prev => ({...prev, preferredDate: ""}));
                }}
                className={`w-full max-w-full min-w-0 p-4 brutal-input text-lg font-bold appearance-none ${formErrors.preferredDate ? 'border-[var(--color-brutal-red)] border-4' : 'border-4 border-black'}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter text-black mb-1">
                <Clock className="w-5 h-5 stroke-[3]" /> Time *
              </label>
              {formErrors.preferredTime && <p className="text-[var(--color-brutal-red)] text-xs font-black mb-1 uppercase">{formErrors.preferredTime}</p>}
              <input
                type="time"
                value={preferredTime}
                onChange={(e) => {
                  setPreferredTime(e.target.value);
                  if (formErrors.preferredTime) setFormErrors(prev => ({...prev, preferredTime: ""}));
                }}
                className={`w-full max-w-full min-w-0 p-4 brutal-input text-lg font-bold appearance-none ${formErrors.preferredTime ? 'border-[var(--color-brutal-red)] border-4' : 'border-4 border-black'}`}
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
            {formErrors.description && <p className="text-[var(--color-brutal-red)] text-sm font-black mb-2 uppercase border-2 border-[var(--color-brutal-red)] bg-white p-1 px-2">{formErrors.description}</p>}
            <textarea
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (formErrors.description) setFormErrors(prev => ({...prev, description: ""}));
              }}
              placeholder="Describe what needs to be fixed or installed..."
              className={`w-full p-4 brutal-input text-lg font-medium resize-none ${formErrors.description ? 'border-[var(--color-brutal-red)] border-4' : 'border-4 border-black'}`}
            />

            {/* Media Attachment (Photo or Video) */}
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
                    className="absolute -top-3 -right-3 w-8 h-8 bg-[var(--color-brutal-red)] border-2 border-black flex items-center justify-center text-white hover:scale-110 transition-transform shadow-[2px_2px_0_0_#000]"
                  >
                    <X className="w-5 h-5 stroke-[3]" />
                  </button>
                </div>
              ) : (
                <label className="w-full md:w-auto inline-flex items-center gap-2 bg-[var(--color-brutal-pink)] text-black px-4 py-3 border-4 border-black font-black uppercase text-sm cursor-pointer hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all shadow-[2px_2px_0_0_#000]">
                  <ImageIcon className="w-5 h-5" /> Select File (Photo or Video)
                  <input 
                    type="file" 
                    accept="image/*,video/*" 
                    onChange={handleMediaSelect} 
                    className="hidden" 
                  />
                </label>
              )}
              <p className="text-xs font-bold text-gray-500 mt-2">Helps technicians understand the issue before claiming.</p>
            </div>
          </div>

          <div className="bg-[var(--color-brutal-pink)] brutal-card p-6">
            <label className="block text-lg font-black uppercase tracking-tighter text-black mb-1">
              Your Budget
            </label>
            <p className="text-xs font-bold text-black mb-3 leading-tight border-l-2 border-black pl-2">
              Interested technicians can accept, decline, or counter this offer.
            </p>
            {formErrors.offerAmount && <p className="text-[var(--color-brutal-red)] text-sm font-black mb-2 uppercase border-2 border-[var(--color-brutal-red)] bg-white p-1 px-2">{formErrors.offerAmount}</p>}
            <div className="relative flex items-center">
              <span className="absolute left-4 font-black text-2xl text-black pointer-events-none select-none">₦</span>
              <input
                type="text"
                value={offerAmount}
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/[^0-9]/g, '');
                  if (numericValue) {
                    setOfferAmount(Number(numericValue).toLocaleString());
                  } else {
                    setOfferAmount('');
                  }
                  if (formErrors.offerAmount) setFormErrors(prev => ({...prev, offerAmount: ""}));
                }}
                placeholder="0"
                className={`w-full pl-12 pr-4 py-4 brutal-input text-2xl font-black bg-white ${formErrors.offerAmount ? 'border-[var(--color-brutal-red)] border-4' : 'border-4 border-black'}`}
              />
            </div>
          </div>

          <div>
            {formErrors.terms && <p className="text-[var(--color-brutal-red)] text-sm font-black mb-2 uppercase border-2 border-[var(--color-brutal-red)] bg-white p-1 px-2">{formErrors.terms}</p>}
            <BookingTermsCheckbox checked={termsAccepted} onChange={(checked) => {
              setTermsAccepted(checked);
              if (checked && formErrors.terms) setFormErrors(prev => ({ ...prev, terms: "" }));
            }} />
          </div>

          <div className="mt-4 mb-8">
            <button
              type="submit"
              disabled={loading}
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
