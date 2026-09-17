"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { JobRequest } from "@/types";
import BackButton from "@/components/BackButton";

export default function RequestArtisanPage({ params }: { params: { artisanId: string } }) {
  const [description, setDescription] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) {
        // Redirect to login, passing the current URL to return back after login
        router.push("/login");
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
        trade: "Unknown", // Ideally we fetch the artisan's trade from context or DB, hardcoded for now or we leave it.
        description,
        neighborhood,
        preferredTime,
        offerAmount: parsedAmount,
        counterOfferAmount: null,
        platformFee: parsedAmount * 0.35,
        status: "pending",
        createdAt: Date.now(),
        completedAt: null,
      };

      await setDoc(requestRef, newRequest);
      
      // On success, go back to home or a "My Requests" page
      router.push("/?requested=true");
    } catch (err: any) {
      console.error(err);
      setError("Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="flex items-center gap-4 mb-6">
        <BackButton />
        <h1 className="text-3xl font-extrabold text-gray-900">Request Service</h1>
      </div>
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
        
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Describe the Job</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              placeholder="e.g., My generator won't start, it's a 5KVA Mikano..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Neighborhood</label>
            <input
              type="text"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              required
              placeholder="e.g., Lekki Phase 1"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Time</label>
            <input
              type="text"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              required
              placeholder="e.g., Today at 2 PM, or Tomorrow morning"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Initial Offer (NGN)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₦</span>
              <input
                type="number"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                required
                min="500"
                placeholder="5000"
                className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">The artisan can accept, decline, or counter your offer.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white font-bold text-lg py-4 px-6 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Send Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
