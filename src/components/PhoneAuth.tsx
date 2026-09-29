"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { UserAccount } from "@/types";
import { ArrowRight, Phone } from "lucide-react";
import { sendCustomOtp, verifyCustomOtp } from "@/app/actions/authActions";

interface PhoneAuthProps {
  role: "customer" | "artisan";
  onSuccess?: () => void;
  isLogin?: boolean;
}

export default function PhoneAuth({ role, onSuccess, isLogin = true }: PhoneAuthProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const router = useRouter();

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    
    const formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith("+")) {
      setError("Please include country code, e.g., +2348012345678");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await sendCustomOtp(formattedPhone);
      if (result.success) {
        setStep("otp");
      } else {
        setError(result.error || "Failed to send verification code.");
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error(err);
      setError(err.message || "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;

    setLoading(true);
    setError("");

    try {
      const result = await verifyCustomOtp(phoneNumber.trim(), otp);
      
      if (!result.success || !result.credentials) {
        setError(result.error || "Invalid OTP");
        setLoading(false);
        return;
      }

      const { email, password } = result.credentials;
      
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (error: unknown) {
        const authErr = error as Error & { code?: string };
        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/invalid-login-credentials') {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
        } else {
          throw authErr;
        }
      }

      const userDocRef = doc(db, "users", userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        const newUser: UserAccount = {
          userId: userCredential.user.uid,
          phone: phoneNumber.trim(),
          displayName: "New User",
          role: role,
          createdAt: Date.now(),
        };
        await setDoc(userDocRef, newUser);
        
        if (role === "artisan") {
          router.push("/onboarding");
        } else {
          router.push("/explore");
        }
      } else {
        const userData = userDoc.data() as UserAccount;
        if (userData.role === "artisan") {
          const artisanDoc = await getDoc(doc(db, "artisans", userCredential.user.uid));
          if (artisanDoc.exists() && artisanDoc.data()?.onboardingStep === 6) {
            router.push("/technician/dashboard");
          } else {
            router.push("/onboarding");
          }
        } else {
          router.push("/explore");
        }
      }
      
      if (onSuccess) onSuccess();
    } catch (error: unknown) {
      console.error(error);
      setError("An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {error && (
        <div className="bg-[var(--color-brutal-red)] text-white p-4 brutal-border mb-6 font-bold text-sm">
          {error}
        </div>
      )}

      {step === "phone" ? (
        <form onSubmit={sendOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-black text-black mb-2 uppercase">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+2348012345678"
                className="w-full pl-12 pr-4 py-4 brutal-border bg-white text-black font-medium focus:outline-none focus:bg-[var(--color-brutal-bg)] transition-colors placeholder:text-gray-400"
                required
              />
            </div>
            <p className="text-xs font-bold text-gray-500 mt-2">Make sure to include your country code (e.g. +234)</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-brutal-yellow)] text-black brutal-btn py-4 flex justify-between items-center px-6"
          >
            <span className="font-black uppercase">{loading ? "Sending..." : "Send Code"}</span>
            <ArrowRight className="w-6 h-6 stroke-[3]" />
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-black text-black mb-2 uppercase">Enter 6-digit Code</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="123456"
              maxLength={6}
              className="w-full px-5 py-4 text-center tracking-widest text-2xl brutal-border bg-white text-black font-black focus:outline-none focus:bg-[var(--color-brutal-bg)] transition-colors"
              required
            />
            <p className="text-xs font-bold text-[var(--color-brutal-teal)] mt-2 text-center bg-black py-1">Check the IDE terminal logs for the OTP!</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-brutal-blue)] text-black brutal-btn py-4 flex justify-between items-center px-6"
          >
            <span className="font-black uppercase">{loading ? "Verifying..." : "Verify & Sign In"}</span>
            <ArrowRight className="w-6 h-6 stroke-[3]" />
          </button>
          <button
            type="button"
            onClick={() => setStep("phone")}
            className="w-full text-center mt-4 text-sm font-bold uppercase underline decoration-2 underline-offset-4"
          >
            Use a different number
          </button>
        </form>
      )}
    </div>
  );
}
