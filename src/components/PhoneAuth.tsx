"use client";

import { useState, useEffect, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { UserAccount } from "@/types";

export default function PhoneAuth() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [step, setStep] = useState<"phone" | "code" | "role">("phone");
  const [role, setRole] = useState<"customer" | "artisan">("customer");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!(window as any).recaptchaVerifier && recaptchaContainerRef.current) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: "invisible",
        callback: () => {
          // reCAPTCHA solved
        },
      });
    }
  }, []);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const appVerifier = (window as any).recaptchaVerifier;
      if (!appVerifier) throw new Error("reCAPTCHA not initialized");
      
      const formattedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      
      setConfirmationResult(confirmation);
      setStep("code");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to send verification code. Ensure number is in international format (e.g. +1234567890).");
      // Reset reCAPTCHA on error
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.render().then((widgetId: any) => {
          (window as any).grecaptcha.reset(widgetId);
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    
    setError("");
    setLoading(true);

    try {
      const result = await confirmationResult.confirm(verificationCode);
      const user = result.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data() as UserAccount;
        if (userData.role === "artisan") {
          router.push("/dashboard");
        } else {
          router.push("/");
        }
      } else {
        setStep("role");
      }
    } catch (err: any) {
      console.error(err);
      setError("Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user authenticated");

      const newUser: UserAccount = {
        userId: user.uid,
        phone: user.phoneNumber || phoneNumber,
        displayName,
        role,
        createdAt: Date.now(),
      };

      await setDoc(doc(db, "users", user.uid), newUser);

      if (role === "artisan") {
        router.push("/onboarding"); // We'll build this in Phase 4
      } else {
        router.push("/");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to create profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 md:p-8 rounded-xl shadow-lg border border-gray-100">
      <div ref={recaptchaContainerRef}></div>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md mb-6 text-sm">
          {error}
        </div>
      )}

      {step === "phone" && (
        <form onSubmit={handleSendCode}>
          <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">Sign In or Sign Up</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+12345678900"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
              required
            />
            <p className="text-xs text-gray-500 mt-2">Include your country code (e.g., +1 for US)</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-medium p-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Verification Code"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={handleVerifyCode}>
          <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">Enter Code</h2>
          <p className="text-sm text-gray-600 mb-6 text-center">Sent to {phoneNumber}</p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code</label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="123456"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center text-xl tracking-widest text-gray-900"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-medium p-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify Code"}
          </button>
          <button
            type="button"
            onClick={() => setStep("phone")}
            className="w-full mt-4 text-gray-500 text-sm hover:text-gray-700"
          >
            Back to phone entry
          </button>
        </form>
      )}

      {step === "role" && (
        <form onSubmit={handleCompleteProfile}>
          <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">Complete Profile</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">I want to...</label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`border rounded-lg p-4 cursor-pointer text-center transition ${role === 'customer' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <input type="radio" name="role" value="customer" checked={role === 'customer'} onChange={() => setRole('customer')} className="sr-only" />
                <span className="font-medium block mb-1">Hire</span>
                <span className="text-xs">Find an artisan</span>
              </label>
              
              <label className={`border rounded-lg p-4 cursor-pointer text-center transition ${role === 'artisan' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <input type="radio" name="role" value="artisan" checked={role === 'artisan'} onChange={() => setRole('artisan')} className="sr-only" />
                <span className="font-medium block mb-1">Work</span>
                <span className="text-xs">Offer services</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-medium p-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Saving..." : "Continue"}
          </button>
        </form>
      )}
    </div>
  );
}
