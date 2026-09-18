"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("A password reset link has been sent to your email.");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to send password reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center p-4 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <div className="w-full max-w-md md:max-w-4xl mx-auto md:flex brutal-card bg-white relative">
        {/* Left side: Form */}
        <div className="w-full md:w-1/2 p-6 md:p-10 border-b-4 md:border-b-0 md:border-r-4 border-black relative">
          <div className="absolute -top-4 -left-4 w-12 h-12 bg-[var(--color-brutal-pink)] brutal-border flex items-center justify-center rotate-6 z-10">
            <span className="font-black text-black text-xl">#</span>
          </div>

          <div className="flex items-center gap-3 mb-8 border-b-4 border-black pb-4">
            <Link 
              href="/login?mode=signin"
              className="w-10 h-10 bg-[var(--color-brutal-yellow)] brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-x-0 active:translate-y-0 active:shadow-none mr-2"
            >
              <ArrowLeft className="w-6 h-6 text-black stroke-[3]" />
            </Link>
            <div className="flex items-center">
              <img src="/LOGO.png" alt="N Logo" className="h-10 w-auto" />
              <span className="text-[36px] font-bold text-black leading-none tracking-tighter -ml-1.5">EED</span>
            </div>
          </div>
          
          <h2 className="text-4xl font-black mb-2 text-black uppercase leading-none">
            Reset Password
          </h2>
          <div className="mb-8 mt-4">
            <span className="text-black font-bold text-lg bg-[var(--color-brutal-yellow)] inline-block px-2 brutal-border -rotate-1">
              We'll send you a link
            </span>
          </div>

          {error && (
            <div className="bg-[var(--color-brutal-red)] text-black font-bold p-4 brutal-border brutal-shadow-sm mb-6 uppercase text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-[var(--color-brutal-green)] text-black font-bold p-4 brutal-border brutal-shadow-sm mb-6 uppercase text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleResetPassword}>
            <div className="mb-8">
              <label className="block text-lg font-black text-black mb-2 uppercase">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-5 py-4 brutal-border bg-white text-black font-medium focus:outline-none focus:bg-[var(--color-brutal-bg)] transition-colors placeholder:text-gray-400"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 text-xl brutal-btn bg-[var(--color-brutal-teal)]"
            >
              {loading ? "SENDING..." : "SEND RESET LINK"}
            </button>
          </form>
        </div>

        {/* Right side: Brutalist Banner for Desktop */}
        <div className="hidden md:flex w-full md:w-1/2 bg-[var(--color-brutal-blue)] p-10 flex-col justify-center items-center relative overflow-hidden">
          <div className="absolute top-20 left-10 w-40 h-40 bg-[var(--color-brutal-teal)] brutal-border -rotate-6"></div>
          <div className="absolute bottom-20 right-10 w-32 h-32 bg-[var(--color-brutal-red)] brutal-border rounded-full"></div>
          <h2 className="text-7xl font-black text-white text-center uppercase tracking-tighter leading-none z-10" style={{ textShadow: '4px 4px 0 #000' }}>
            DON'T <br/><span className="text-[var(--color-brutal-yellow)]">PANIC</span>
          </h2>
          <p className="text-black font-bold text-xl mt-8 z-10 bg-white border-4 border-black px-4 py-2 -rotate-1">
            Happens to the best of us!
          </p>
        </div>
      </div>
    </div>
  );
}
