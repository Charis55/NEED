"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import SignOutButton from "@/components/SignOutButton";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setDisplayName(user.displayName || "");
      }
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (!auth.currentUser) throw new Error("Not authenticated");
      
      await updateProfile(auth.currentUser, {
        displayName: displayName
      });
      
      setSuccessMsg("Profile updated successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto pt-16 px-6">
      <h1 className="text-[3rem] font-black text-black tracking-tighter uppercase leading-none mb-8 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">
        SETTINGS
      </h1>
      
      <div className="bg-[var(--color-brutal-teal)] border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8">
        <h2 className="text-xl font-black uppercase text-black mb-4">Profile Details</h2>
        
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-black text-black mb-2 uppercase">Full Name</label>
            <input 
              type="text" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full p-4 bg-white border-4 border-black focus:outline-none focus:bg-[var(--color-brutal-yellow)] font-bold text-black transition-colors"
              placeholder="Enter your name"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-black text-black mb-2 uppercase">Email Address</label>
            <input 
              type="email" 
              value={auth.currentUser?.email || ""}
              disabled
              className="w-full p-4 bg-gray-200 border-4 border-black font-bold text-black opacity-70 cursor-not-allowed"
            />
            <p className="text-xs font-bold text-black mt-1">Email cannot be changed directly.</p>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 mt-2 bg-[var(--color-brutal-yellow)] border-4 border-black font-black uppercase text-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
          >
            {loading ? "SAVING..." : "SAVE CHANGES"}
          </button>
          
          {successMsg && (
            <div className="p-3 bg-[var(--color-brutal-green)] border-4 border-black font-black uppercase text-black text-sm mt-4 text-center">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="p-3 bg-[var(--color-brutal-red)] border-4 border-black font-black uppercase text-white text-sm mt-4 text-center">
              {errorMsg}
            </div>
          )}
        </form>
      </div>

      <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8">
        <h2 className="text-xl font-black uppercase text-black mb-4">Account Actions</h2>
        <SignOutButton className="w-full py-4 bg-[var(--color-brutal-red)] border-4 border-black font-black uppercase text-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
          SIGN OUT
        </SignOutButton>
      </div>
    </div>
  );
}
