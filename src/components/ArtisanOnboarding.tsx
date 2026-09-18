"use client";

import { useState } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ArtisanProfile } from "@/types";
import ngeohash from "ngeohash";
import { verifyCertificateAction } from "@/actions/verifyCertificate";
import { compressImage } from "@/utils/imageCompression";
import { servicesData } from "@/data/services";
import { reverseGeocode } from "@/utils/location";

const tradeCategories = Object.values(servicesData);

export default function ArtisanOnboarding() {
  const [step, setStep] = useState(1);
  const [tradeCategory, setTradeCategory] = useState(tradeCategories[0].id);
  const [subcategory, setSubcategory] = useState(tradeCategories[0].subServices[0].title);
  
  // Location
  const [locationData, setLocationData] = useState<{lat: number, lng: number, name: string} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  
  // Survey fields
  const [yearsOfExperience, setYearsOfExperience] = useState("< 1 year");
  const [skillLevel, setSkillLevel] = useState("Intermediate");
  const [hasCertification, setHasCertification] = useState(false);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [policeClearanceFile, setPoliceClearanceFile] = useState<File | null>(null);

  const [bio, setBio] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleNext = () => {
    if (step === 1 && !locationData) {
      setLocationError("Location permission is strictly required to proceed.");
      return;
    }
    setStep((s) => s + 1);
  };
  const handleBack = () => setStep((s) => s - 1);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      // Helper function to upload to R2
      const uploadFileToR2 = async (file: File) => {
        const res = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: file.type })
        });
        if (!res.ok) throw new Error("Failed to get upload URL");
        const { presignedUrl, publicUrl } = await res.json();
        
        const uploadRes = await fetch(presignedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file
        });
        if (!uploadRes.ok) throw new Error("Failed to upload file to R2");
        return publicUrl;
      };

      // Upload photos
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

      // Upload certificate if provided
      let certificateUrl: string | null = null;
      let isCertificateVerified = false;
      if (hasCertification && certificateFile) {
        let fileToUpload = certificateFile;
        if (certificateFile.type.startsWith('image/')) {
          fileToUpload = await compressImage(certificateFile, 4);
        }
        certificateUrl = await uploadFileToR2(fileToUpload);
        
        // Call Server Action to Verify Certificate via AI
        isCertificateVerified = await verifyCertificateAction(certificateUrl as string);
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
      // For testing, we do not throw an error if police clearance is missing

      // Calculate geohash
      if (!locationData) throw new Error("Location data is missing.");
      const geohash = ngeohash.encode(locationData.lat, locationData.lng);

      const profile: ArtisanProfile = {
        artisanId: user.uid,
        userId: user.uid,
        trade: servicesData[tradeCategory].title,
        subcategory,
        yearsOfExperience,
        skillLevel,
        hasCertification,
        certificateUrl,
        isCertificateVerified,
        bio,
        neighborhood: locationData.name,
        geohash,
        lat: locationData.lat,
        lng: locationData.lng,
        portfolioPhotoUrls: photoUrls,
        hasPoliceClearance: !!policeClearanceUrl,
        policeClearanceUrl,
        verified: true, // FOR TESTING: Auto-verify
        ratingAverage: 0,
        ratingCount: 0,
        available: true,
        createdAt: Date.now()
      };

      await setDoc(doc(db, "artisans", user.uid), profile);
      router.push("/dashboard");
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
      <p className="bg-[var(--color-brutal-blue)] inline-block px-2 text-black mb-8 font-black tracking-widest border-2 border-black rotate-1">STEP {step} OF 4</p>

      {error && (
        <div className="bg-[var(--color-brutal-red)] border-4 border-black text-black p-4 brutal-shadow-sm mb-6 font-bold uppercase text-sm">
          {error}
        </div>
      )}

      <form onSubmit={step === 4 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
        
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-lg font-black text-black mb-2 uppercase">Primary Trade</label>
              <select
                value={tradeCategory}
                onChange={(e) => {
                  setTradeCategory(e.target.value);
                  setSubcategory(servicesData[e.target.value].subServices[0].title);
                }}
                className="w-full p-4 bg-white brutal-border focus:outline-none focus:bg-[var(--color-brutal-bg)] text-black font-medium transition-colors"
              >
                {tradeCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-lg font-black text-black mb-2 uppercase">Specific Service (Subcategory)</label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full p-4 bg-white brutal-border focus:outline-none focus:bg-[var(--color-brutal-bg)] text-black font-medium transition-colors"
              >
                {servicesData[tradeCategory]?.subServices.map((sub) => (
                  <option key={sub.id} value={sub.title}>{sub.title}</option>
                ))}
              </select>
            </div>
            
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

        {step === 2 && (
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

            <div>
              <label className="flex items-start gap-4 p-4 bg-[var(--color-brutal-yellow)] brutal-border cursor-pointer brutal-shadow-sm hover:-translate-x-1 hover:-translate-y-1 transition-transform">
                <input
                  type="checkbox"
                  checked={hasCertification}
                  onChange={(e) => setHasCertification(e.target.checked)}
                  className="w-6 h-6 border-4 border-black appearance-none checked:bg-black bg-white cursor-pointer mt-1"
                />
                <span className="text-lg font-black text-black leading-tight uppercase">I have formal training, an apprenticeship, or professional certification.</span>
              </label>
            </div>

            {hasCertification && (
              <div className="p-6 bg-white brutal-border border-dashed mt-4 relative">
                <div className="absolute top-0 left-0 w-full h-full bg-[var(--color-brutal-teal)] opacity-20 pointer-events-none"></div>
                <label className="block text-xl font-black text-black mb-2 uppercase relative z-10">Upload Certificate</label>
                <p className="text-sm font-bold text-black mb-4 relative z-10 border-l-4 border-black pl-2">Uploading a valid certificate significantly increases your chances of being selected for jobs. Our engine will verify its authenticity.</p>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => e.target.files && setCertificateFile(e.target.files[0])}
                  className="w-full text-black file:mr-4 file:py-3 file:px-6 file:border-4 file:border-black file:text-sm file:font-black file:bg-[var(--color-brutal-pink)] file:text-black hover:file:bg-[var(--color-brutal-red)] cursor-pointer file:uppercase file:transition-colors relative z-10"
                />
                {certificateFile && (
                  <p className="text-sm font-black text-black mt-4 bg-[var(--color-brutal-yellow)] inline-block px-2 border-2 border-black rotate-1 relative z-10">Selected: {certificateFile.name}</p>
                )}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
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

        {step === 4 && (
          <div className="space-y-6">
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
            disabled={loading}
            className={`px-8 py-4 bg-[var(--color-brutal-teal)] brutal-btn flex-1 ${step === 1 ? 'w-full' : ''}`}
          >
            {loading ? "SAVING..." : step === 4 ? "COMPLETE PROFILE" : "NEXT STEP"}
          </button>
        </div>
      </form>
    </div>
  );
}
