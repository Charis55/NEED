"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // Verify if the user is actually an admin
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      
      const isHardcodedAdmin = userCredential.user.uid === "bl6OE9ODGGhIbtBo16JGqZaJ0YE2";
      
      if (isHardcodedAdmin || (userDoc.exists() && userDoc.data().isAdmin)) {
        router.push("/admin");
      } else {
        await auth.signOut();
        setError("Access Denied. You do not have administrator privileges.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleIPLogin = () => {
    // Check if the user is running this from their authorized local machine
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      localStorage.setItem("admin_bypass", "true");
      router.push("/admin");
    } else {
      setError("IP Login is only available from the authorized local network.");
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF0E5] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex justify-center mb-6">
          <Image src="/LOGO.png" alt="NEED Logo" width={80} height={80} className="w-16 h-16 object-contain" />
        </div>
        
        <h1 className="text-3xl font-black text-center uppercase tracking-tight mb-2">
          Admin Portal
        </h1>
        <p className="text-center font-bold text-gray-500 mb-8 border-b-2 border-black pb-4">
          AUTHORIZED PERSONNEL ONLY
        </p>

        {error && (
          <div className="bg-red-400 border-2 border-black p-3 mb-6 font-bold text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-black uppercase mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-black focus:outline-none focus:ring-0 focus:border-black font-bold text-lg bg-gray-50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-black uppercase mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-black focus:outline-none focus:ring-0 focus:border-black font-bold text-lg bg-gray-50 pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#CCFF00] hover:bg-[#b3e600] text-black font-black uppercase tracking-wider py-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Login to System"}
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t-2 border-black"></div>
              <span className="flex-shrink-0 mx-4 text-black font-black text-sm uppercase">OR</span>
              <div className="flex-grow border-t-2 border-black"></div>
            </div>

            <button
              type="button"
              onClick={handleIPLogin}
              className="w-full bg-white hover:bg-gray-100 text-black font-black uppercase tracking-wider py-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              Bypass via Authorized IP
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
