"use client";

import { useState, useEffect, use } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, doc, setDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { JobRequest, ArtisanProfile } from "@/types";
import BackButton from "@/components/BackButton";
import { ArrowRight, MapPin, Clock, Info, Image as ImageIcon, X, Check, Coins, Sparkles, ShieldCheck, Star } from "lucide-react";
import { reverseGeocode } from "@/utils/location";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { compressImage } from "@/utils/imageCompression";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import BookingTermsCheckbox from "@/components/BookingTermsCheckbox";
import { to12HourFormat } from "@/utils/formatTime";
import { apiFetch } from "@/utils/apiBase";

export default function RequestArtisanPage({ params }: { params: Promise<{ artisanId: string }> }) {
  const unwrappedParams = use(params);
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [selectedServiceIndices, setSelectedServiceIndices] = useState<number[]>([0]);
  
  // Customer loyalty credits state
  const [availableCreditsNaira, setAvailableCreditsNaira] = useState(0);
  const [applyCredits, setApplyCredits] = useState(true);

  // Repeat customer loyalty tier state
  const [pairStatus, setPairStatus] = useState<{
    completedCount: number;
    pairJobNumber: number;
    currentRatePercent: number;
    savingsPercent: number;
    tierLabel: string;
    isRepeatClient: boolean;
  } | null>(null);
  
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
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
            const servicesParam = urlParams.get('services');
            
            if (servicesParam && artisanData.services) {
               const requestedServices = servicesParam.split(',').map(s => decodeURIComponent(s).replace(/-/g, ' ').toLowerCase());
               const indices = artisanData.services
                 .map((s, index) => requestedServices.includes(s.subcategory.toLowerCase()) ? index : -1)
                 .filter(index => index !== -1);
               if (indices.length > 0) setSelectedServiceIndices(indices);
            } else if (tradeParam && subParam && artisanData.services) {
               const idx = artisanData.services.findIndex(s => s.trade === tradeParam && s.subcategory === subParam);
               if (idx !== -1) setSelectedServiceIndices([idx]);
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

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        apiFetch(`/api/credits/my-credits?customerId=${user.uid}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setAvailableCreditsNaira(data.availableBalanceNaira || 0);
            }
          })
          .catch(console.error);

        apiFetch(`/api/pairs/status?customerId=${user.uid}&artisanId=${unwrappedParams.artisanId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setPairStatus(data);
            }
          })
          .catch(console.error);
      }
    });
    return () => unsubscribe();
  }, [unwrappedParams.artisanId]);

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

    const res = await apiFetch('/api/upload-direct', {
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
    if (!draft.description.trim()) errors.description = "Please provide a job description.";
    if (!locationData) errors.location = "Please detect your location before sending.";
    if (!draft.preferredDate) errors.preferredDate = "Please select a preferred date.";
    if (!draft.preferredTime) errors.preferredTime = "Please select a preferred time.";
    
    const parsedAmount = parseInt(draft.offerAmount.replace(/,/g, ''), 10);
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

      if (!artisan) {
        setError("Cannot submit request. Artisan data is missing.");
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

      const selectedServices = selectedServiceIndices.map(idx => artisan.services?.[idx] || { trade: artisan.trade, subcategory: artisan.subcategory });
      
      const checkoutRes = await apiFetch("/api/checkout/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: user.uid,
          artisanId: unwrappedParams.artisanId,
          trade: selectedServices[0]?.trade || "Unknown",
          subcategory: selectedServices[0]?.subcategory || "Unknown",
          services: selectedServices.map(s => ({ trade: s.trade || "Unknown", subcategory: s.subcategory || "Unknown" })),
          description: draft.description,
          neighborhood: locationData?.name || "",
          locationCoords: { lat: locationData?.lat || 0, lng: locationData?.lng || 0 },
          preferredTime: `${draft.preferredDate} at ${to12HourFormat(draft.preferredTime)}`,
          offerAmount: parsedAmount,
          applyCredits: applyCredits && availableCreditsNaira > 0,
          mediaUrl
        })
      });

      const checkoutData = await checkoutRes.json();
      
      if (!checkoutRes.ok) {
        throw new Error(checkoutData.error || "Failed to initialize payment");
      }

      clearDraft(); // Clear the saved draft on successful submission

      // Redirect to Paystack to complete the deposit
      if (checkoutData.authorizationUrl) {
        window.location.href = checkoutData.authorizationUrl;
      } else {
        router.push("/jobs");
      }
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

  const parsedOfferNaira = parseInt(draft.offerAmount.replace(/,/g, ''), 10) || 0;
  const estimatedDepositNaira = parsedOfferNaira >= 500 
    ? Math.max(1000, Math.round(parsedOfferNaira * 0.25))
    : 0;
  const creditDiscountNaira = applyCredits ? Math.min(estimatedDepositNaira, availableCreditsNaira) : 0;
  const payableDepositNaira = Math.max(0, estimatedDepositNaira - creditDiscountNaira);

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
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {artisan.services.map((svc, i) => {
                    const isSelected = selectedServiceIndices.includes(i);
                    return (
                      <label key={i} className={`flex items-center gap-3 p-3 brutal-border cursor-pointer transition-all ${isSelected ? 'bg-[var(--color-brutal-yellow)] shadow-[4px_4px_0_0_#000] -translate-y-1' : 'bg-white hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-[2px_2px_0_0_#000]'}`}>
                        <div className={`w-6 h-6 border-4 border-black flex items-center justify-center shrink-0 ${isSelected ? 'bg-[var(--color-brutal-pink)]' : 'bg-white'}`}>
                          {isSelected && <Check className="w-4 h-4 stroke-[4] text-black" />}
                        </div>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedServiceIndices(prev => [...prev, i]);
                            } else {
                              if (selectedServiceIndices.length > 1) {
                                setSelectedServiceIndices(prev => prev.filter(idx => idx !== i));
                              }
                            }
                          }} 
                          className="hidden" 
                        />
                        <span className="font-black text-sm uppercase leading-tight tracking-tight">{svc.trade}<br/><span className="text-xs font-bold text-gray-700">{svc.subcategory}</span></span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm font-black uppercase text-black bg-[var(--color-brutal-pink)] inline-block px-3 py-1 brutal-border shadow-[2px_2px_0_0_#000] mt-3 -rotate-1">
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

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <div className="bg-[var(--color-brutal-yellow)] brutal-card p-6">
            <label className="block text-xl font-black uppercase tracking-tighter text-black mb-3 border-b-4 border-black pb-1">
              Job Description
            </label>
            {formErrors.description && <p className="text-[var(--color-brutal-red)] text-sm font-black mb-2 uppercase border-2 border-[var(--color-brutal-red)] bg-white p-1 px-2">{formErrors.description}</p>}
            <textarea
              value={draft.description}
              onChange={(e) => {
                setDraft({ description: e.target.value });
                if (formErrors.description) setFormErrors(prev => ({ ...prev, description: "" }));
              }}
              rows={4}
              placeholder="E.g., My kitchen sink is leaking heavily from the bottom pipe..."
              className={`w-full p-3 brutal-border focus:outline-none focus:ring-4 focus:ring-black text-black font-medium resize-none bg-white placeholder:text-gray-400 ${formErrors.description ? 'border-[var(--color-brutal-red)] border-4' : ''}`}
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
            {formErrors.location && <p className="text-[var(--color-brutal-red)] text-sm font-black mb-2 uppercase border-2 border-[var(--color-brutal-red)] bg-white p-1 px-2">{formErrors.location}</p>}
            
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

          <div className="bg-[var(--color-brutal-teal)] brutal-card p-6 flex flex-col md:flex-row gap-4 overflow-hidden">
            <div className="flex-1 min-w-0">
              <label className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter text-black mb-3">
                <Clock className="w-5 h-5 stroke-[3]" /> Date
              </label>
              {formErrors.preferredDate && <p className="text-[var(--color-brutal-red)] text-xs font-black mb-1 uppercase">{formErrors.preferredDate}</p>}
              <input
                type="date"
                value={draft.preferredDate}
                onChange={(e) => {
                  setDraft({ preferredDate: e.target.value });
                  if (formErrors.preferredDate) setFormErrors(prev => ({ ...prev, preferredDate: "" }));
                }}
                className={`w-full max-w-full min-w-0 p-3 brutal-border focus:outline-none focus:ring-4 focus:ring-black text-black font-black bg-white appearance-none ${formErrors.preferredDate ? 'border-[var(--color-brutal-red)] border-4' : ''}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter text-black mb-3">
                <Clock className="w-5 h-5 stroke-[3]" /> Time
              </label>
              {formErrors.preferredTime && <p className="text-[var(--color-brutal-red)] text-xs font-black mb-1 uppercase">{formErrors.preferredTime}</p>}
              <input
                type="time"
                value={draft.preferredTime}
                onChange={(e) => {
                  setDraft({ preferredTime: e.target.value });
                  if (formErrors.preferredTime) setFormErrors(prev => ({ ...prev, preferredTime: "" }));
                }}
                className={`w-full max-w-full min-w-0 p-3 brutal-border focus:outline-none focus:ring-4 focus:ring-black text-black font-black bg-white appearance-none ${formErrors.preferredTime ? 'border-[var(--color-brutal-red)] border-4' : ''}`}
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
              {formErrors.offerAmount && <p className="text-[var(--color-brutal-red)] text-sm font-black mb-2 uppercase border-2 border-[var(--color-brutal-red)] bg-white p-1 px-2">{formErrors.offerAmount}</p>}
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-black text-xl">₦</span>
              <input
                type="number"
                value={draft.offerAmount}
                onChange={(e) => {
                  setDraft({ offerAmount: e.target.value });
                  if (formErrors.offerAmount) setFormErrors(prev => ({ ...prev, offerAmount: "" }));
                }}
                min="500"
                placeholder="5000"
                className={`w-full pl-10 p-3 brutal-border focus:outline-none focus:ring-4 focus:ring-black text-black font-black text-xl bg-white placeholder:text-gray-400 ${formErrors.offerAmount ? 'border-[var(--color-brutal-red)] border-4' : ''}`}
              />
            </div>
          </div>

          {/* Deposit & Escrow Breakdown with Credit Application */}
          <div className="bg-white brutal-card p-6 border-4 border-black space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <span className="font-black text-sm uppercase tracking-wider text-black flex items-center gap-1.5">
                <Coins className="w-4 h-4 stroke-[3] text-black" />
                Deposit & Escrow Protection
              </span>
              <span className="bg-[var(--color-brutal-blue)] text-white text-[10px] font-black uppercase px-2 py-0.5 border border-black">
                25% Escrow
              </span>
            </div>

            <div className="space-y-2.5 text-sm font-bold">
              {pairStatus && pairStatus.isRepeatClient && (
                <div className="bg-[var(--color-brutal-green)] border-2 border-black p-3 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs uppercase text-black flex items-center gap-1.5">
                      <Star className="w-4 h-4 fill-black stroke-black" />
                      Repeat Client Loyalty Discount
                    </span>
                    <span className="bg-black text-white font-black text-xs px-2 py-0.5 border border-black">
                      {pairStatus.currentRatePercent}% Fee (Saves {pairStatus.savingsPercent}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-black font-bold">
                    {pairStatus.tierLabel}. You and this technician pay lower fees by booking through NEED!
                  </p>
                </div>
              )}

              <div className="flex justify-between items-center text-gray-700">
                <span>Estimated Required Deposit:</span>
                <span className="font-black text-black">
                  {estimatedDepositNaira > 0 ? `₦${estimatedDepositNaira.toLocaleString()}` : "Enter offer above"}
                </span>
              </div>

              {availableCreditsNaira > 0 ? (
                <div className="bg-[var(--color-brutal-yellow)] border-2 border-black p-3 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyCredits}
                      onChange={(e) => setApplyCredits(e.target.checked)}
                      className="mt-0.5 w-5 h-5 accent-black border-2 border-black cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs uppercase text-black flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 fill-black" />
                          Apply Reward Credits
                        </span>
                        <span className="bg-[var(--color-brutal-green)] text-black font-black text-xs px-1.5 border border-black">
                          -₦{creditDiscountNaira.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-black/80 font-bold mt-0.5">
                        You have ₦{availableCreditsNaira.toLocaleString()} available in loyalty rewards!
                      </p>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="bg-[var(--color-brutal-teal)]/30 border-2 border-black p-2.5 text-xs font-black uppercase text-black flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 text-black" />
                  <span>Pay deposit in-app to earn ₦300 loyalty reward credit!</span>
                </div>
              )}

              <div className="pt-2 border-t-2 border-black flex justify-between items-center text-base">
                <span className="font-black uppercase text-black">Deposit Payable Now:</span>
                <div className="text-right">
                  {payableDepositNaira === 0 && estimatedDepositNaira > 0 ? (
                    <span className="bg-[var(--color-brutal-green)] text-black px-2 py-1 font-black text-xs uppercase border-2 border-black inline-block">
                      ₦0 (Covered by Credits!)
                    </span>
                  ) : (
                    <span className="font-black text-xl text-black">
                      ₦{payableDepositNaira.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-bold text-gray-600 uppercase border-t border-black/20 pt-2">
              <ShieldCheck className="w-4 h-4 text-[var(--color-brutal-green)] shrink-0" />
              <span>Held safely in escrow until you confirm job completion.</span>
            </div>
          </div>

          <div>
            {formErrors.terms && <p className="text-[var(--color-brutal-red)] text-sm font-black mb-2 uppercase border-2 border-[var(--color-brutal-red)] bg-white p-1 px-2">{formErrors.terms}</p>}
            <BookingTermsCheckbox checked={termsAccepted} onChange={(checked) => {
              setTermsAccepted(checked);
              if (checked && formErrors.terms) setFormErrors(prev => ({ ...prev, terms: "" }));
            }} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black !text-white brutal-btn py-4 text-xl flex items-center justify-between px-6"
          >
            <span>
              {loading 
                ? "SUBMITTING..." 
                : (payableDepositNaira === 0 && estimatedDepositNaira > 0 
                    ? "CONFIRM BOOKING (FREE DEPOSIT)" 
                    : `PAY DEPOSIT & SEND (${payableDepositNaira > 0 ? `₦${payableDepositNaira.toLocaleString()}` : "REQUEST"})`)}
            </span>
            {!loading && <ArrowRight className="w-6 h-6 stroke-[3]" />}
          </button>
        </form>
      </div>
    </div>
  );
}
