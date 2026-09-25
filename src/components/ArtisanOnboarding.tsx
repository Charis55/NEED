"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ArtisanProfile } from "@/types";
import ngeohash from "ngeohash";
import { compressImage } from "@/utils/imageCompression";
import { servicesData } from "@/data/services";
import { reverseGeocode } from "@/utils/location";
import { ShieldCheck, AlertTriangle, CheckCircle, Loader2, Camera, ExternalLink } from "lucide-react";

const tradeCategories = Object.values(servicesData);

const TOTAL_STEPS = 6;

export default function ArtisanOnboarding() {
  const [step, setStep] = useState(1);

  // --- Step 1: KYC Verification (Didit SDK) ---
  const [identityVerifying, setIdentityVerifying] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [kycSessionId, setKycSessionId] = useState<string | null>(null);
  const [kycFlowCompleted, setKycFlowCompleted] = useState(false);
  const [identityError, setIdentityError] = useState("");
  // These will be populated by the webhook; stored for the profile submission
  const [identityVerifiedName, setIdentityVerifiedName] = useState<string | null>(null);
  const [identityVerifiedDOB, setIdentityVerifiedDOB] = useState<string | null>(null);
  const [identityReferenceId, setIdentityReferenceId] = useState<string | null>(null);

  // --- Step 2: Services & Location ---
  const [services, setServices] = useState<{
    tradeCategory: string;
    subcategory: string;
    hasCertification: boolean;
    certificateFile: File | null;
  }[]>([{
    tradeCategory: tradeCategories[0].id,
    subcategory: tradeCategories[0].subServices[0].title,
    hasCertification: false,
    certificateFile: null
  }]);
  const [locationData, setLocationData] = useState<{lat: number, lng: number, name: string} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  // --- Step 3: Skill Assessment ---
  const [yearsOfExperience, setYearsOfExperience] = useState("< 1 year");
  const [skillLevel, setSkillLevel] = useState("Intermediate");

  // --- Step 4: Bio ---
  const [bio, setBio] = useState("");

  // --- Step 5: Documents & Portfolio ---
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [policeClearanceFile, setPoliceClearanceFile] = useState<File | null>(null);
  const [files, setFiles] = useState<FileList | null>(null);

  // --- Step 6: Consent ---
  const [consentDataCollection, setConsentDataCollection] = useState(false);
  const [consentDocumentRetention, setConsentDocumentRetention] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // --- KYC Verification Handler (Didit SDK) ---
  const handleStartKYC = async () => {
    setIdentityVerifying(true);
    setIdentityError("");

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      // 1. Create a verification session on our backend
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        setIdentityError(
          data.error || data.detail || "Failed to create verification session. Please try again."
        );
        setIdentityVerifying(false);
        return;
      }

      setKycSessionId(data.session_id);

      // 2. Open the Didit SDK modal
      const { DiditSdk } = await import("@didit-protocol/sdk-web");

      DiditSdk.shared.onComplete = (result: any) => {
        // This is a UI hint only — the webhook is the source of truth.
        // result.type: "completed" | "cancelled" | "failed"
        if (result.type === "completed" || result.type === "cancelled") {
          setKycFlowCompleted(true);
          setIdentityVerified(true); // Allow proceeding — webhook will confirm
          setIdentityVerifying(false);
        } else {
          setIdentityError("Verification was not completed. Please try again.");
          setIdentityVerifying(false);
        }
      };

      DiditSdk.shared.startVerification({ url: data.url });
    } catch (err: any) {
      setIdentityError(err.message || "Failed to start verification. Please try again.");
      setIdentityVerifying(false);
    }
  };

  // --- Navigation ---
  const handleNext = async () => {
    setError(""); // Clear any previous errors

    if (step === 1 && !identityVerified) {
      setIdentityError("You must complete KYC verification before proceeding.");
      return;
    }
    if (step === 2 && !locationData) {
      setLocationError("Location permission is strictly required to proceed.");
      return;
    }
    if (step === 5 && !profilePictureFile) {
      setError("A Profile Picture is strictly required to proceed.");
      return;
    }
    if (step === 5 && !policeClearanceFile) {
      setError("A Police Clearance Certificate is strictly required to proceed.");
      return;
    }

    // Save progress to Firestore so partial applicants appear in admin
    const user = auth.currentUser;
    if (user) {
      try {
        const progressData: Record<string, any> = {
          artisanId: user.uid,
          userId: user.uid,
          onboardingStep: step,
          name: user.displayName || identityVerifiedName || "Applicant",
        };

        if (step >= 1) {
          progressData.identityVerificationStatus = identityVerified ? "verified" : "pending";
          progressData.identityVerifiedName = identityVerifiedName;
          progressData.identityVerifiedDOB = identityVerifiedDOB;
          progressData.identityVerificationReference = identityReferenceId;
          progressData.identityVerificationProvider = "didit";
        }
        if (step >= 2 && locationData) {
          progressData.neighborhood = locationData.name;
          progressData.lat = locationData.lat;
          progressData.lng = locationData.lng;
          const firstSvc = services[0];
          if (firstSvc) {
            const tradeTitle = (await import("@/data/services")).servicesData[firstSvc.tradeCategory]?.title || firstSvc.tradeCategory;
            progressData.trade = tradeTitle;
            progressData.subcategory = firstSvc.subcategory;
          }
        }
        if (step >= 3) {
          progressData.yearsOfExperience = yearsOfExperience;
          progressData.skillLevel = skillLevel;
        }
        if (step >= 4) {
          progressData.bio = bio;
        }

        // Use merge:true so this never overwrites the full submitted profile
        await setDoc(doc(db, "artisans", user.uid), progressData, { merge: true });
      } catch (err) {
        // Non-blocking — don't stop the user from continuing
        console.warn("Could not save onboarding progress:", err);
      }
    }

    setStep((s) => s + 1);
  };
  const handleBack = () => setStep((s) => s - 1);

  // --- Location Detection ---
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
        setLocationError("Location permission denied. This is required to proceed.");
        setIsLocating(false);
      }
    );
  };

  // --- Service Management ---
  const handleAddService = () => {
    const uniqueCategories = new Set(services.map(s => s.tradeCategory));
    let defaultCategory = tradeCategories[0].id;
    
    if (uniqueCategories.size >= 5 && !uniqueCategories.has(defaultCategory)) {
      defaultCategory = Array.from(uniqueCategories)[0] as string;
    }

    const categoryData = tradeCategories.find(c => c.id === defaultCategory) || tradeCategories[0];

    setServices([...services, {
      tradeCategory: defaultCategory,
      subcategory: categoryData.subServices[0].title,
      hasCertification: false,
      certificateFile: null
    }]);
  };

  const handleRemoveService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const updateService = (index: number, field: string, value: any) => {
    const newServices = [...services];
    (newServices[index] as any)[field] = value;
    if (field === 'tradeCategory') {
      newServices[index].subcategory = servicesData[value].subServices[0].title;
    }
    setServices(newServices);
  };

  // --- Submit Handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!consentDataCollection || !consentDocumentRetention) {
      setError("You must accept both consent checkboxes to proceed.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      // Upload helper
      const uploadFileToR2 = async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch('/api/upload-direct', { method: 'POST', body: formData });
        if (!res.ok) throw new Error("Failed to upload file");
        const { publicUrl } = await res.json();
        return publicUrl;
      };

      // Upload portfolio photos
      const photoUrls: string[] = [];
      if (files) {
        for (let i = 0; i < files.length; i++) {
          let file = files[i];
          if (file.type.startsWith('image/')) {
            file = await compressImage(file, 4);
          }
          const url = await uploadFileToR2(file);
          photoUrls.push(url);
        }
      }

      // Upload certificates for services
      const finalServices = [];
      const serviceKeys = [];
      for (const svc of services) {
        let certificateUrl: string | null = null;

        if (svc.hasCertification && svc.certificateFile) {
          let fileToUpload = svc.certificateFile;
          if (svc.certificateFile.type.startsWith('image/')) {
            fileToUpload = await compressImage(svc.certificateFile, 4);
          }
          certificateUrl = await uploadFileToR2(fileToUpload);
        }

        const tradeTitle = servicesData[svc.tradeCategory].title;
        finalServices.push({
          trade: tradeTitle,
          subcategory: svc.subcategory,
          hasCertification: svc.hasCertification,
          certificateUrl,
          isCertificateVerified: false, // Pipeline will verify
        });
        serviceKeys.push(`${svc.tradeCategory}:${svc.subcategory}`);
      }

      // Upload police clearance
      let policeClearanceUrl: string | null = null;
      if (policeClearanceFile) {
        let fileToUpload = policeClearanceFile;
        if (policeClearanceFile.type.startsWith('image/')) {
          fileToUpload = await compressImage(policeClearanceFile, 4);
        }
        policeClearanceUrl = await uploadFileToR2(fileToUpload);
      }

      // Upload profile picture
      let profilePictureUrl: string | null = null;
      if (profilePictureFile) {
        let fileToUpload = profilePictureFile;
        if (profilePictureFile.type.startsWith('image/')) {
          fileToUpload = await compressImage(profilePictureFile, 4);
        }
        profilePictureUrl = await uploadFileToR2(fileToUpload);
      }

      // Calculate geohash
      if (!locationData) throw new Error("Location data is missing.");
      const geohash = ngeohash.encode(locationData.lat, locationData.lng);

      const profile: ArtisanProfile = {
        artisanId: user.uid,
        userId: user.uid,
        name: user.displayName || identityVerifiedName || "New User",

        // Single fields for backwards compatibility
        trade: finalServices[0].trade,
        subcategory: finalServices[0].subcategory,
        hasCertification: finalServices[0].hasCertification,
        certificateUrl: finalServices[0].certificateUrl,
        isCertificateVerified: false,

        // Multi-service fields
        services: finalServices,
        serviceKeys: serviceKeys,

        yearsOfExperience,
        skillLevel,
        bio,
        neighborhood: locationData.name,
        geohash,
        lat: locationData.lat,
        lng: locationData.lng,
        profilePictureUrl: profilePictureUrl || undefined,
        portfolioPhotoUrls: photoUrls,
        hasPoliceClearance: !!policeClearanceUrl,
        policeClearanceUrl,

        // Verification Pipeline — NOT auto-verified
        verified: false,
        ratingAverage: 0,
        ratingCount: 0,
        available: false, // Cannot accept jobs until verified

        // Identity verification data — populated by Didit webhook
        identityVerificationStatus: kycFlowCompleted ? "pending" : "not_started",
        identityVerificationProvider: "didit",
        identityVerificationReference: identityReferenceId,
        identityVerifiedName: identityVerifiedName,
        identityVerifiedDOB: identityVerifiedDOB,
        kycSessionId: kycSessionId,

        // Document verification — starts as pending, Cloud Functions will process
        certificateVerificationStatus: "pending",
        certificateExtractedData: null,
        policeClearanceStatus: policeClearanceUrl ? "pending" : "rejected",
        policeClearanceExtractedData: null,
        policeClearanceExpiryDate: null,

        // Manual review — pipeline will determine
        manualReviewRequired: true, // All new profiles start in the queue
        manualReviewReasons: ["new_profile_awaiting_document_verification"],
        verificationDecisionLog: [],

        onboardingStep: 6, // Completed all steps

        createdAt: Date.now(),
      };

      await setDoc(doc(db, "artisans", user.uid), profile);

      // Also add to the review queue
      await setDoc(doc(db, "verificationReviewQueue", user.uid), {
        artisanId: user.uid,
        artisanName: user.displayName || identityVerifiedName || "Unknown",
        flaggedChecks: ["new_profile_awaiting_document_verification"],
        extractedData: {
          certificate: null,
          policeClearance: null,
          identityVerifiedName: identityVerifiedName,
        },
        certificateUrl: finalServices[0]?.certificateUrl || null,
        policeClearanceUrl: policeClearanceUrl,
        status: "pending",
        reviewedBy: null,
        reviewedAt: null,
        createdAt: Date.now(),
      });

      // Trigger Welcome Technician Email
      fetch('/api/emails/welcome-technician', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artisanId: user.uid }),
      }).catch(e => console.error("Failed to send welcome email:", e));

      router.push("/technician/dashboard");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto brutal-card bg-white p-8 md:p-12 relative">
      <h2 className="text-4xl font-black text-black mb-2 uppercase tracking-tighter">Create your Profile</h2>
      <p className="bg-[var(--color-brutal-blue)] inline-block px-2 text-black mb-8 font-black tracking-widest border-2 border-black rotate-1">STEP {step} OF {TOTAL_STEPS}</p>

      {error && (
        <div className="bg-[var(--color-brutal-red)] border-4 border-black text-black p-4 brutal-shadow-sm mb-6 font-bold uppercase text-sm">
          {error}
        </div>
      )}

      <form onSubmit={step === TOTAL_STEPS ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
        
        {/* ==================== STEP 1: KYC VERIFICATION (DIDIT) ==================== */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-8 h-8 text-black" />
              <h3 className="text-2xl font-black text-black uppercase border-b-4 border-black pb-2 flex-1">Identity Verification</h3>
            </div>

            {/* Consent & disclosure — shown before verification starts */}
            <div className="bg-[var(--color-brutal-bg)] brutal-border p-4 space-y-3">
              <p className="text-sm font-bold text-black border-l-4 border-black pl-3">
                To ensure the safety and trust of everyone on NEED, we require identity verification.
                This is a <span className="font-black">one-time check</span> powered by{" "}
                <a href="https://didit.me" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                  Didit <ExternalLink className="w-3 h-3" />
                </a>, a trusted KYC provider.
              </p>
              <div className="bg-white brutal-border p-3 text-xs font-bold text-black space-y-1">
                <p>📸 You will be asked to scan a valid government-issued ID document</p>
                <p>🤳 A quick selfie will verify it&apos;s really you (liveness check)</p>
                <p>🔒 Your data is encrypted and processed securely by Didit</p>
                <p>⏱️ The entire process takes about 2 minutes</p>
              </div>
            </div>

            {!identityVerified ? (
              <>
                {identityError && (
                  <div className="flex items-start gap-2 p-3 bg-[var(--color-brutal-red)] border-2 border-black">
                    <AlertTriangle className="w-5 h-5 text-black flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-bold text-black">{identityError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleStartKYC}
                  disabled={identityVerifying}
                  className="w-full py-4 bg-[var(--color-brutal-teal)] brutal-btn text-black font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {identityVerifying ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      LAUNCHING VERIFICATION...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      START KYC VERIFICATION
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="p-6 bg-[var(--color-brutal-teal)] brutal-border brutal-shadow space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-black" />
                  <h4 className="text-xl font-black text-black uppercase">Verification Submitted</h4>
                </div>
                <div className="bg-white brutal-border p-4 space-y-2">
                  <p className="font-black text-black text-sm">
                    Your identity verification has been submitted and is being processed.
                  </p>
                  <p className="text-xs font-bold text-black opacity-70">
                    Session ID: <span className="font-mono">{kycSessionId?.substring(0, 12)}...</span>
                  </p>
                </div>
                <p className="text-xs font-bold text-black opacity-70">
                  ✓ You can proceed with the rest of your profile while we verify your identity.
                  You&apos;ll be notified once the review is complete.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ==================== STEP 2: SERVICES & LOCATION ==================== */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-2xl font-black text-black mb-4 uppercase border-b-4 border-black pb-2">Your Services</h3>
            {services.map((svc, index) => (
              <div key={index} className="p-4 bg-[var(--color-brutal-bg)] border-4 border-black relative">
                {services.length > 1 && (
                  <button type="button" onClick={() => handleRemoveService(index)} className="absolute -top-4 -right-4 w-8 h-8 bg-[var(--color-brutal-red)] border-2 border-black flex items-center justify-center font-black hover:scale-110 transition-transform text-white">X</button>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-black text-black mb-1 uppercase">Primary Trade</label>
                    <select
                      value={svc.tradeCategory}
                      onChange={(e) => updateService(index, 'tradeCategory', e.target.value)}
                      className="w-full p-2 bg-white brutal-border focus:outline-none focus:bg-[var(--color-brutal-yellow)] text-black font-medium transition-colors"
                    >
                      {tradeCategories.map((c) => {
                        const uniqueCategories = new Set(services.map(s => s.tradeCategory));
                        const isAtLimit = uniqueCategories.size >= 5;
                        const isAlreadySelected = uniqueCategories.has(c.id);
                        const disabled = isAtLimit && !isAlreadySelected;
                        
                        return (
                          <option key={c.id} value={c.id} disabled={disabled}>
                            {c.title} {disabled ? '(Limit Reached)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-black text-black mb-1 uppercase">Specific Service (Subcategory)</label>
                    <select
                      value={svc.subcategory}
                      onChange={(e) => updateService(index, 'subcategory', e.target.value)}
                      className="w-full p-2 bg-white brutal-border focus:outline-none focus:bg-[var(--color-brutal-yellow)] text-black font-medium transition-colors"
                    >
                      {servicesData[svc.tradeCategory]?.subServices.map((sub) => (
                        <option key={sub.id} value={sub.title}>{sub.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-start gap-2 p-2 bg-[var(--color-brutal-pink)] brutal-border cursor-pointer brutal-shadow-sm hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform mt-2">
                      <input
                        type="checkbox"
                        checked={svc.hasCertification}
                        onChange={(e) => updateService(index, 'hasCertification', e.target.checked)}
                        className="w-5 h-5 border-2 border-black appearance-none checked:bg-black bg-white cursor-pointer mt-0.5"
                      />
                      <span className="text-sm font-black text-black leading-tight uppercase">I have certification for this service</span>
                    </label>
                  </div>
                  {svc.hasCertification && (
                    <div className="p-4 bg-white brutal-border border-dashed mt-2">
                      <label className="block text-sm font-black text-black mb-1 uppercase">Upload Certificate</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          if (e.target.files) updateService(index, 'certificateFile', e.target.files[0]);
                        }}
                        className="w-full text-xs text-black file:mr-2 file:py-1 file:px-2 file:border-2 file:border-black file:font-black file:bg-[var(--color-brutal-yellow)] file:text-black cursor-pointer uppercase"
                      />
                      {svc.certificateFile && (
                        <p className="text-xs font-black mt-2 bg-[var(--color-brutal-teal)] inline-block px-1 border-2 border-black">Selected: {svc.certificateFile.name}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            <button type="button" onClick={handleAddService} className="w-full py-4 bg-[var(--color-brutal-teal)] border-4 border-black text-black font-black uppercase tracking-widest mt-4 brutal-shadow hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
              + Add Another Service
            </button>
            
            <div>
              <label className="block text-lg font-black text-black mb-2 uppercase">Service Location *</label>
              <p className="text-sm font-bold text-black mb-4 border-l-4 border-black pl-2">We strictly require your location to connect you with nearby customers.</p>
              
              {locationData ? (
                <div className="p-4 bg-[var(--color-brutal-teal)] brutal-border font-black text-black uppercase flex justify-between items-center">
                  <span>📍 {locationData.name}</span>
                  <button 
                    type="button" 
                    onClick={detectLocation}
                    className="text-xs bg-white px-2 py-1 border-2 border-black hover:-translate-y-0.5 transition-transform"
                  >
                    {isLocating ? "UPDATING..." : "UPDATE"}
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
          </div>
        )}

        {/* ==================== STEP 3: SKILL ASSESSMENT ==================== */}
        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-2xl font-black text-black mb-4 uppercase">Skill Assessment</h3>
            
            <div>
              <label className="block text-lg font-black text-black mb-2 uppercase">Years of Experience</label>
              <select
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(e.target.value)}
                className="w-full p-4 bg-white brutal-border focus:outline-none focus:bg-[var(--color-brutal-bg)] text-black font-medium transition-colors"
              >
                <option value="< 1 year">Less than 1 year</option>
                <option value="1-3 years">1-3 years</option>
                <option value="3-5 years">3-5 years</option>
                <option value="5+ years">5+ years</option>
              </select>
            </div>

            <div>
              <label className="block text-lg font-black text-black mb-2 uppercase">Self-Assessed Skill Level</label>
              <select
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value)}
                className="w-full p-4 bg-white brutal-border focus:outline-none focus:bg-[var(--color-brutal-bg)] text-black font-medium transition-colors"
              >
                <option value="Beginner">Beginner (Still learning the basics)</option>
                <option value="Intermediate">Intermediate (Can handle most standard jobs)</option>
                <option value="Advanced">Advanced (Highly experienced and efficient)</option>
                <option value="Expert">Expert (Master of the trade)</option>
              </select>
            </div>
          </div>
        )}

        {/* ==================== STEP 4: BIO ==================== */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <label className="block text-lg font-black text-black mb-2 uppercase">Bio / Experience</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                required
                placeholder="Tell customers about your experience, how long you've been working, and why they should hire you..."
                rows={5}
                className="w-full p-4 bg-white brutal-border focus:outline-none focus:bg-[var(--color-brutal-bg)] text-black font-medium transition-colors resize-none placeholder:text-gray-400"
              />
            </div>
          </div>
        )}

        {/* ==================== STEP 5: DOCUMENTS & PORTFOLIO ==================== */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <label className="block text-lg font-black text-black mb-2 uppercase text-[var(--color-brutal-red)]">Profile Picture *</label>
              <p className="text-sm font-bold text-black mb-4 border-l-4 border-black pl-2">A clear, professional photo of your face is strictly required.</p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files && setProfilePictureFile(e.target.files[0])}
                className="w-full p-6 bg-[var(--color-brutal-teal)] brutal-border text-black file:mr-4 file:py-3 file:px-6 file:border-4 file:border-black file:text-sm file:font-black file:bg-[var(--color-brutal-yellow)] file:text-black hover:file:bg-white cursor-pointer file:uppercase file:transition-colors mb-6"
              />
              {profilePictureFile && (
                <p className="text-sm font-black text-black mt-2 inline-block px-2 border-2 border-black rotate-1 bg-white mb-6">Selected: {profilePictureFile.name}</p>
              )}
            </div>

            <div>
              <label className="block text-lg font-black text-black mb-2 uppercase">Portfolio Photos</label>
              <p className="text-sm font-bold text-black mb-4 border-l-4 border-black pl-2">Upload photos of your past work to build trust with customers.</p>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setFiles(e.target.files)}
                className="w-full p-6 bg-[var(--color-brutal-bg)] brutal-border text-black file:mr-4 file:py-3 file:px-6 file:border-4 file:border-black file:text-sm file:font-black file:bg-[var(--color-brutal-blue)] file:text-black hover:file:bg-white cursor-pointer file:uppercase file:transition-colors mb-6"
              />
            </div>

            <div>
              <label className="block text-lg font-black text-black mb-2 uppercase text-[var(--color-brutal-red)]">Security & Verification *</label>
              <p className="text-sm font-bold text-black mb-4 border-l-4 border-black pl-2">A valid Police Clearance Certificate is strictly required for platform safety.</p>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => e.target.files && setPoliceClearanceFile(e.target.files[0])}
                className="w-full p-6 bg-[var(--color-brutal-yellow)] brutal-border text-black file:mr-4 file:py-3 file:px-6 file:border-4 file:border-black file:text-sm file:font-black file:bg-[var(--color-brutal-red)] file:text-black hover:file:bg-white cursor-pointer file:uppercase file:transition-colors"
              />
              {policeClearanceFile && (
                <p className="text-sm font-black text-black mt-2 inline-block px-2 border-2 border-black rotate-1 bg-white">Selected: {policeClearanceFile.name}</p>
              )}
            </div>
            {files && files.length > 0 && (
              <p className="text-sm font-black text-black bg-[var(--color-brutal-pink)] inline-block px-2 border-2 border-black -rotate-1">{files.length} file(s) selected</p>
            )}
          </div>
        )}

        {/* ==================== STEP 6: CONSENT & SUBMIT ==================== */}
        {step === 6 && (
          <div className="space-y-6">
            <h3 className="text-2xl font-black text-black mb-4 uppercase border-b-4 border-black pb-2">Consent & Data Privacy</h3>
            <p className="text-sm font-bold text-black border-l-4 border-[var(--color-brutal-red)] pl-3 mb-6">
              Before submitting your profile, please review and accept the following data collection and retention policies.
              Your personal data is protected under Nigeria&apos;s data protection framework.
            </p>

            <div className="space-y-4">
              <label className="flex items-start gap-3 p-4 bg-[var(--color-brutal-bg)] brutal-border cursor-pointer hover:-translate-y-0.5 transition-transform">
                <input
                  type="checkbox"
                  checked={consentDataCollection}
                  onChange={(e) => setConsentDataCollection(e.target.checked)}
                  className="w-6 h-6 border-2 border-black appearance-none checked:bg-black bg-white cursor-pointer mt-0.5 flex-shrink-0"
                />
                <div>
                  <span className="text-sm font-black text-black uppercase block mb-1">Data Collection Consent</span>
                  <span className="text-xs font-bold text-gray-700 leading-relaxed block">
                    I consent to NEED collecting and processing my National Identification Number (NIN) or Bank Verification Number (BVN), 
                    trade certificates, Police Clearance Certificate, portfolio photos, and location data for the purpose of 
                    identity verification, trust and safety, and connecting me with customers. This data will only be accessible 
                    to me and authorized NEED administrators.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-[var(--color-brutal-bg)] brutal-border cursor-pointer hover:-translate-y-0.5 transition-transform">
                <input
                  type="checkbox"
                  checked={consentDocumentRetention}
                  onChange={(e) => setConsentDocumentRetention(e.target.checked)}
                  className="w-6 h-6 border-2 border-black appearance-none checked:bg-black bg-white cursor-pointer mt-0.5 flex-shrink-0"
                />
                <div>
                  <span className="text-sm font-black text-black uppercase block mb-1">Document Retention Policy</span>
                  <span className="text-xs font-bold text-gray-700 leading-relaxed block">
                    I understand that my uploaded documents (certificates, police clearance) will be retained for the duration 
                    of my active account. If my application is rejected, my documents will be automatically deleted after 90 days. 
                    I can request early deletion by contacting NEED support. My police clearance will need to be re-uploaded 
                    when it expires (approximately every 6 months).
                  </span>
                </div>
              </label>
            </div>

            <div className="p-4 bg-[var(--color-brutal-yellow)] brutal-border brutal-shadow-sm mt-4">
              <p className="text-xs font-black text-black uppercase mb-1">What happens next?</p>
              <p className="text-xs font-bold text-black leading-relaxed">
                After submission, your documents will be automatically scanned and cross-checked against your verified identity. 
                Most profiles are reviewed within 24-48 hours. You&apos;ll be notified once your profile is approved and you can start 
                accepting jobs.
              </p>
            </div>
          </div>
        )}

        {/* ==================== NAVIGATION BUTTONS ==================== */}
        <div className="mt-12 flex justify-between gap-4">
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="px-8 py-4 bg-white brutal-btn w-1/3"
            >
              BACK
            </button>
          )}
          
          <button
            type="submit"
            disabled={loading || (step === 1 && !identityVerified) || (step === 6 && (!consentDataCollection || !consentDocumentRetention))}
            className={`px-8 py-4 bg-[var(--color-brutal-teal)] brutal-btn flex-1 ${step === 1 ? 'w-full' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? "SAVING..." : step === TOTAL_STEPS ? "COMPLETE PROFILE" : "NEXT STEP"}
          </button>
        </div>
      </form>
    </div>
  );
}
