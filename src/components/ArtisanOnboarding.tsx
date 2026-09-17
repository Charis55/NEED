"use client";

import { useState } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import { ArtisanProfile } from "@/types";
import ngeohash from "ngeohash";

const TRADES = [
  "Generator Repair",
  "AC Servicing",
  "Plumber",
  "Electrician",
  "Tailor"
];

const NEIGHBORHOODS: Record<string, { lat: number; lng: number }> = {
  "Lekki Phase 1": { lat: 6.4531, lng: 3.4720 },
  "Ikeja": { lat: 6.6018, lng: 3.3515 },
  "Yaba": { lat: 6.5095, lng: 3.3711 },
  "Victoria Island": { lat: 6.4281, lng: 3.4219 }
};

export default function ArtisanOnboarding() {
  const [step, setStep] = useState(1);
  const [trade, setTrade] = useState(TRADES[0]);
  const [neighborhood, setNeighborhood] = useState(Object.keys(NEIGHBORHOODS)[0]);
  const [bio, setBio] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleNext = () => setStep((s) => s + 1);
  const handleBack = () => setStep((s) => s - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      // Upload photos
      const photoUrls: string[] = [];
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const storageRef = ref(storage, `artisan-photos/${user.uid}/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          const url = await getDownloadURL(snapshot.ref);
          photoUrls.push(url);
        }
      }

      // Calculate geohash
      const location = NEIGHBORHOODS[neighborhood];
      const geohash = ngeohash.encode(location.lat, location.lng);

      const profile: ArtisanProfile = {
        artisanId: user.uid,
        userId: user.uid,
        trade,
        bio,
        neighborhood,
        geohash,
        lat: location.lat,
        lng: location.lng,
        portfolioPhotoUrls: photoUrls,
        verified: false,
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
    <div className="w-full max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Create your Artisan Profile</h2>
      <p className="text-gray-500 mb-8">Step {step} of 3</p>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
        
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary Trade</label>
              <select
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                {TRADES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary Neighborhood</label>
              <select
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                {Object.keys(NEIGHBORHOODS).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bio / Experience</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                required
                placeholder="Tell customers about your experience, how long you've been working, and why they should hire you..."
                rows={5}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Portfolio Photos</label>
              <p className="text-xs text-gray-500 mb-4">Upload photos of your past work to build trust with customers.</p>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setFiles(e.target.files)}
                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                required
              />
            </div>
            {files && files.length > 0 && (
              <p className="text-sm text-green-600">{files.length} file(s) selected.</p>
            )}
          </div>
        )}

        <div className="mt-8 flex justify-between">
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Back
            </button>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 ${step === 1 ? 'ml-auto' : ''}`}
          >
            {loading ? "Saving..." : step === 3 ? "Complete Profile" : "Next Step"}
          </button>
        </div>
      </form>
    </div>
  );
}
