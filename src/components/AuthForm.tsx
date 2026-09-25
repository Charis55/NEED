"use client";

import { useState, useEffect, useRef } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { 
  GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, setPersistence, browserLocalPersistence, browserSessionPersistence
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { compressImage } from "@/utils/imageCompression";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserAccount } from "@/types";
import ImageCropper from "@/components/ImageCropper";
import { Eye, EyeOff, ArrowLeft, Upload, X, Check } from "lucide-react";
import TermsDisclaimer from "@/components/TermsDisclaimer";

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  
  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConstraints, setShowPasswordConstraints] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  // Profile completion fields
  const [phoneNumber, setPhoneNumber] = useState("");
  const [step, setStep] = useState<"auth" | "role">("auth");
  const [role, setRole] = useState<"customer" | "artisan">("customer");
  const [lockRole, setLockRole] = useState(false);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  
  // Profile Image
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCropImageSrc(URL.createObjectURL(file));
      setShowCropper(true);
      // Reset input so they can select the same file again if they cancel
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCropComplete = (croppedFile: File) => {
    setProfileFile(croppedFile);
    setProfilePreview(URL.createObjectURL(croppedFile));
    setShowCropper(false);
    setCropImageSrc(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setCropImageSrc(null);
  };

  const uploadAndSetPhoto = async (user: any) => {
    if (profileFile) {
      try {
        const uploadTask = async () => {
          const compressedFile = await compressImage(profileFile, 3);
          
          const formData = new FormData();
          formData.append("file", compressedFile);

          const res = await fetch('/api/upload-direct', {
            method: 'POST',
            body: formData
          });
          
          if (!res.ok) throw new Error("Failed to upload image");
          const { publicUrl } = await res.json();
          await updateProfile(user, { photoURL: publicUrl });
          return publicUrl;
        };
        
        const photoURL = await Promise.race([
          uploadTask(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Upload timeout (CORS or network issue)")), 8000))
        ]);
        return photoURL as string;
      } catch (err) {
        console.error("Failed to upload profile picture", err);
      }
    }
    return user.photoURL || "";
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("role") === "artisan") {
        setRole("artisan");
        setLockRole(true);
      } else if (params.get("role") === "customer") {
        setRole("customer");
        setLockRole(true);
      }
      if (params.get("mode") === "signup") {
        setIsLogin(false);
      }
    }
  }, []);

  const handlePostLogin = async (user: any, nameToSave?: string) => {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data() as UserAccount;
      if (userData.role === "artisan") {
        const artisanDoc = await getDoc(doc(db, "artisans", user.uid));
        if (artisanDoc.exists()) {
          router.push("/technician/dashboard");
        } else {
          setStep("role");
        }
      } else {
        router.push("/explore");
      }
    } else {
      // If we just signed up with email, we passed nameToSave
      if (nameToSave && !user.displayName) {
        await updateProfile(user, { displayName: nameToSave });
      }
      setStep("role");
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const userDocRef = doc(db, "users", result.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        if (!isLogin) {
          // Explicitly signed up via a signup page
          const newUser: UserAccount = {
            userId: result.user.uid,
            phone: result.user.phoneNumber || "",
            displayName: result.user.displayName || "User",
            role: role, // The role from the URL param
            createdAt: Date.now(),
          };
          await setDoc(userDocRef, newUser);
          
          if (role === "artisan") {
            router.push("/onboarding");
          } else {
            // Trigger Welcome Customer Email
            fetch('/api/emails/welcome-customer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: result.user.uid }),
            }).catch(e => console.error("Failed to send welcome email:", e));

            router.push("/explore");
          }
          return;
        } else {
          // Tried to sign in, but no account exists.
          setStep("role");
          return;
        }
      } else {
        // Account exists
        const userData = userDoc.data() as UserAccount;
        if (userData.role === "artisan") {
          const artisanDoc = await getDoc(doc(db, "artisans", result.user.uid));
          if (artisanDoc.exists()) {
            router.push("/technician/dashboard");
          } else {
            setStep("role");
          }
        } else {
          router.push("/explore");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      let result;
      let fullName = "";
      
      if (!isLogin) {
        if (!firstName || !lastName || !phoneNumber) {
          throw new Error("Please fill in all fields.");
        }
        
        // Password constraints
        const minLength = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        if (!minLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
          throw new Error("Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character.");
        }

        if (!termsAccepted) {
          throw new Error("You must accept the Security Disclaimer & Terms to continue.");
        }
        fullName = `${firstName} ${lastName}`.trim();
        result = await createUserWithEmailAndPassword(auth, email, password);
        
        await updateProfile(result.user, { displayName: fullName });
        
        const newUser: UserAccount = {
          userId: result.user.uid,
          phone: phoneNumber,
          displayName: fullName,
          role: role,
          createdAt: Date.now(),
        };
        await setDoc(doc(db, "users", result.user.uid), newUser);
        
        const uploadedPhotoURL = await uploadAndSetPhoto(result.user);
        
        if (role === "artisan") {
          router.push("/onboarding");
        } else {
          router.push("/explore");
        }
        return; // Skip handlePostLogin since we handled it
      } else {
        result = await signInWithEmailAndPassword(auth, email, password);
        await handlePostLogin(result.user, fullName);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!termsAccepted) {
      setError("You must accept the Security Disclaimer & Terms to continue.");
      setLoading(false);
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user authenticated");

      let finalName = user.displayName;
      if (!finalName && firstName && lastName) {
        finalName = `${firstName} ${lastName}`.trim();
        await updateProfile(user, { displayName: finalName });
      }

      const newUser: UserAccount = {
        userId: user.uid,
        phone: user.phoneNumber || phoneNumber || "",
        displayName: finalName || "",
        role,
        createdAt: Date.now(),
      };

      await setDoc(doc(db, "users", user.uid), newUser);

      const uploadedPhotoURL = await uploadAndSetPhoto(user);

      if (role === "artisan") {
        router.push("/onboarding"); 
      } else {
        router.push("/explore");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to create profile.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "role") {
    return (
      <>
      {showCropper && cropImageSrc && (
        <ImageCropper 
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
      <div className="w-full max-w-md md:max-w-5xl mx-auto md:flex brutal-card bg-[var(--color-brutal-yellow)] relative">
        <div className="w-full md:w-1/2 p-6 md:p-10 border-b-4 md:border-b-0 md:border-r-4 border-black relative">
          <div className="absolute -top-4 -left-4 w-12 h-12 bg-[var(--color-brutal-teal)] brutal-border flex items-center justify-center -rotate-6 z-10">
            <span className="font-black text-black">#2</span>
          </div>
          
          <div className="flex items-center gap-3 mb-8 border-b-4 border-black pb-4">
            <button 
              type="button" 
              onClick={() => router.back()} 
              className="w-10 h-10 bg-white brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-x-0 active:translate-y-0 active:shadow-none mr-2"
            >
              <ArrowLeft className="w-6 h-6 text-black stroke-[3]" />
            </button>
            <div className="flex items-center">
              <img src="/LOGO.png" alt="N Logo" className="h-10 w-auto" />
              <span className="text-[36px] font-bold text-black leading-none tracking-tighter -ml-1.5">EED</span>
            </div>
          </div>
          
          <form onSubmit={handleCompleteProfile}>
            <h2 className="text-4xl font-black mb-2 text-black uppercase tracking-tight">Complete Profile</h2>
            <p className="text-black font-medium mb-8 text-lg bg-white inline-block px-2 brutal-border -rotate-1">Just a few details</p>
            
            {error && <div className="bg-[var(--color-brutal-red)] text-black font-bold p-4 brutal-border brutal-shadow-sm mb-6 uppercase text-sm">{error}</div>}

            <div className="mb-6">
              <label className="block text-lg font-black text-black mb-2 uppercase">Profile Picture (Optional)</label>
              <div className="flex items-center gap-4">
                <div 
                  className="w-20 h-20 bg-gray-200 brutal-border brutal-shadow-sm flex items-center justify-center cursor-pointer relative overflow-hidden"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {profilePreview ? (
                    <>
                      <img src={profilePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setProfileFile(null); setProfilePreview(null); }}
                        className="absolute top-0 right-0 bg-[var(--color-brutal-red)] text-white p-1 brutal-border hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <Upload className="w-8 h-8 text-black opacity-50" />
                  )}
                </div>
                <div className="text-sm font-bold text-gray-500 uppercase">
                  <p>Upload a clear photo</p>
                  <p className="text-xs mt-1">Max 3MB (auto-compressed)</p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageSelect} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-lg font-black text-black mb-2 uppercase">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+2348012345678"
                className="w-full px-5 py-4 brutal-border bg-white text-black font-medium focus:outline-none focus:bg-[var(--color-brutal-bg)] transition-colors placeholder:text-gray-400"
                required
              />
            </div>

            <div className="mb-8">
              <label className="block text-lg font-black text-black mb-3 uppercase">I want to...</label>
              <div className="grid grid-cols-2 gap-4">
                <label className={`brutal-border p-4 cursor-pointer text-center transition-all ${role === 'customer' ? 'bg-[var(--color-brutal-teal)] brutal-shadow-sm translate-x-[-2px] translate-y-[-2px]' : 'bg-white hover:bg-gray-100'}`}>
                  <input type="radio" name="role" value="customer" checked={role === 'customer'} onChange={() => setRole('customer')} className="sr-only" />
                  <span className="font-black text-xl block mb-1 uppercase">Hire</span>
                  <span className="text-sm font-medium border-t-2 border-black pt-1 block">Find a technician</span>
                </label>
                
                <label className={`brutal-border p-4 cursor-pointer text-center transition-all ${role === 'artisan' ? 'bg-[var(--color-brutal-teal)] brutal-shadow-sm translate-x-[-2px] translate-y-[-2px]' : 'bg-white hover:bg-gray-100'}`}>
                  <input type="radio" name="role" value="artisan" checked={role === 'artisan'} onChange={() => setRole('artisan')} className="sr-only" />
                  <span className="font-black text-xl block mb-1 uppercase">Work</span>
                  <span className="text-sm font-medium border-t-2 border-black pt-1 block">Offer services</span>
                </label>
              </div>
            </div>

            <div className="mb-8 p-4 border-4 border-black bg-[var(--color-brutal-bg)] flex items-start gap-3">
              <div className="relative flex items-center mt-1">
                <input 
                  type="checkbox" 
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-6 h-6 border-4 border-black appearance-none checked:bg-black bg-white cursor-pointer flex-shrink-0" 
                />
                {termsAccepted && <svg className="w-4 h-4 absolute left-1 top-1 text-white pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
              </div>
              <div>
                <p className="text-black font-bold uppercase text-sm leading-tight">
                  I have read and unconditionally agree to the{" "}
                  <button type="button" onClick={() => setShowTerms(true)} className="text-[var(--color-brutal-red)] underline decoration-2 underline-offset-2 hover:bg-black hover:text-white transition-colors">
                    Security Disclaimer & Terms of Service
                  </button>.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--color-brutal-red)] py-4 brutal-btn text-xl"
            >
              {loading ? "SAVING..." : "COMPLETE SETUP"}
            </button>
          </form>
        </div>

        {/* Right side (Brutalist Banner for Desktop) */}
        <div className="hidden md:flex w-full md:w-1/2 bg-[var(--color-brutal-blue)] p-10 flex-col justify-center items-center relative overflow-hidden">
          <div className="absolute top-10 right-10 w-32 h-32 bg-white brutal-border rotate-12"></div>
          <div className="absolute bottom-10 left-10 w-24 h-24 bg-[var(--color-brutal-pink)] brutal-border rounded-full"></div>
          <h2 className="text-6xl font-black text-white text-center uppercase tracking-tighter leading-none z-10" style={{ textShadow: '4px 4px 0 #000' }}>
            ALMOST <br/><span className="text-[var(--color-brutal-yellow)]">THERE!</span>
          </h2>
          <p className="text-white font-bold text-xl mt-6 z-10 bg-black px-4 py-2 rotate-2 brutal-border">
            Customize your experience
          </p>
        </div>
      </div>
      {showTerms && <TermsDisclaimer role={role} onClose={() => setShowTerms(false)} />}
      </>
    );
  }

  return (
    <>
    {showCropper && cropImageSrc && (
      <ImageCropper 
        imageSrc={cropImageSrc}
        onCropComplete={handleCropComplete}
        onCancel={handleCropCancel}
      />
    )}
    <div className="w-full max-w-md md:max-w-5xl mx-auto md:flex brutal-card bg-white relative">
      {/* Left side: Form */}
      <div className="w-full md:w-1/2 p-6 md:p-10 border-b-4 md:border-b-0 md:border-r-4 border-black relative">
        <div className="absolute -top-4 -left-4 w-12 h-12 bg-[var(--color-brutal-pink)] brutal-border flex items-center justify-center rotate-6 z-10">
          <span className="font-black text-black text-xl">#1</span>
        </div>

        <div className="flex items-center gap-3 mb-8 border-b-4 border-black pb-4">
          <button 
            type="button" 
            onClick={() => router.back()} 
            className="w-10 h-10 bg-[var(--color-brutal-yellow)] brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-x-0 active:translate-y-0 active:shadow-none mr-2"
          >
            <ArrowLeft className="w-6 h-6 text-black stroke-[3]" />
          </button>
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <img src="/LOGO.png" alt="N Logo" className="h-10 w-auto" />
            <span className="text-[36px] font-bold text-black leading-none tracking-tighter -ml-1.5">EED</span>
          </Link>
        </div>
        
        <h2 className="text-4xl font-black mb-2 text-black uppercase leading-none">
          {isLogin ? "Welcome Back!" : "Setup NEED Account"}
        </h2>
        <div className="mb-8 mt-4">
          <span className="text-black font-bold text-lg bg-[var(--color-brutal-yellow)] inline-block px-2 brutal-border -rotate-1">
            {isLogin ? "Login to continue" : "Create your account"}
          </span>
        </div>

        {error && (
          <div className="bg-[var(--color-brutal-red)] text-black font-bold p-4 brutal-border brutal-shadow-sm mb-6 uppercase text-sm">
            {error}
          </div>
        )}

        {/* Social Buttons (Only for Login) */}
        {isLogin && (
          <>
            <div className="mb-8">
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-white text-black text-xl py-3 px-4 brutal-btn"
              >
                <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                GOOGLE SIGN IN
              </button>
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 border-t-4 border-black"></div>
              <span className="text-black font-black uppercase text-xl">OR</span>
              <div className="flex-1 border-t-4 border-black"></div>
            </div>
          </>
        )}

        <form onSubmit={handleEmailAuth}>
          {!isLogin && (
            <>
              {!lockRole && (
                <div className="flex bg-[var(--color-brutal-bg)] p-2 brutal-border mb-6 relative">
                  <button
                    type="button"
                    onClick={() => setRole("customer")}
                    className={`flex-1 py-3 text-sm font-black uppercase transition-all z-10 ${role === "customer" ? "bg-[var(--color-brutal-blue)] brutal-border brutal-shadow-sm text-black translate-x-[-2px] translate-y-[-2px]" : "text-black hover:bg-gray-200 border-4 border-transparent"}`}
                  >
                    CUSTOMER
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("artisan")}
                    className={`flex-1 py-3 text-sm font-black uppercase transition-all z-10 ${role === "artisan" ? "bg-[var(--color-brutal-blue)] brutal-border brutal-shadow-sm text-black translate-x-[-2px] translate-y-[-2px]" : "text-black hover:bg-gray-200 border-4 border-transparent"}`}
                  >
                    TECHNICIAN
                  </button>
                </div>
              )}

              <div className="mb-6 mt-4">
                <label className="block text-lg font-black text-black mb-2 uppercase">Profile Picture (Optional)</label>
                <div className="flex items-center gap-4">
                  <div 
                    className="w-20 h-20 bg-gray-200 brutal-border brutal-shadow-sm flex items-center justify-center cursor-pointer relative overflow-hidden"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {profilePreview ? (
                      <>
                        <img src={profilePreview} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setProfileFile(null); setProfilePreview(null); }}
                          className="absolute top-0 right-0 bg-[var(--color-brutal-red)] text-white p-1 brutal-border hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <Upload className="w-8 h-8 text-black opacity-50" />
                    )}
                  </div>
                  <div className="text-sm font-bold text-gray-500 uppercase">
                    <p>Upload a clear photo</p>
                    <p className="text-xs mt-1">Max 3MB</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageSelect} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-lg font-black text-black mb-2 uppercase">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First"
                    className="w-full px-5 py-4 brutal-border bg-white text-black font-medium focus:outline-none focus:bg-[var(--color-brutal-bg)] transition-colors placeholder:text-gray-400"
                    required={!isLogin}
                  />
                </div>
                <div>
                  <label className="block text-lg font-black text-black mb-2 uppercase">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last"
                    className="w-full px-5 py-4 brutal-border bg-white text-black font-medium focus:outline-none focus:bg-[var(--color-brutal-bg)] transition-colors placeholder:text-gray-400"
                    required={!isLogin}
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-lg font-black text-black mb-2 uppercase">Phone</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+2348012345678"
                  className="w-full px-5 py-4 brutal-border bg-white text-black font-medium focus:outline-none focus:bg-[var(--color-brutal-bg)] transition-colors placeholder:text-gray-400"
                  required={!isLogin}
                />
              </div>
            </>
          )}

          <div className="mb-6">
            <label className="block text-lg font-black text-black mb-2 uppercase">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full px-5 py-4 brutal-border bg-white text-black font-medium focus:outline-none focus:bg-[var(--color-brutal-bg)] transition-colors placeholder:text-gray-400"
              required
            />
          </div>

          <div className="mb-6 relative">
            <label className="block text-lg font-black text-black mb-2 uppercase">Password</label>
            <div className="relative border-4 border-black bg-white focus-within:bg-[var(--color-brutal-bg)] transition-colors">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => !isLogin && setShowPasswordConstraints(true)}
                placeholder="••••••••"
                className="w-full pl-5 pr-14 py-4 text-black font-medium focus:outline-none bg-transparent placeholder:text-gray-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-0 bottom-0 w-14 border-l-4 border-black flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                {showPassword ? <EyeOff className="w-6 h-6 stroke-[3]" /> : <Eye className="w-6 h-6 stroke-[3]" />}
              </button>
            </div>
            
            {!isLogin && showPasswordConstraints && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border-4 border-black brutal-shadow-sm p-4 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center border-b-[3px] border-black pb-2 mb-3">
                  <h3 className="text-black font-black uppercase text-sm">Password Requirements</h3>
                  <button type="button" onClick={() => setShowPasswordConstraints(false)} className="text-black hover:text-[var(--color-brutal-red)] transition-colors hover:scale-110">
                    <X className="w-5 h-5 stroke-[3]" />
                  </button>
                </div>
                <p className="text-black font-bold text-xs mb-3 bg-[var(--color-brutal-yellow)] inline-block px-1.5 border-2 border-black -rotate-1">To keep your account secure:</p>
                <ul className="space-y-2.5 mb-4">
                  {[
                    { label: "Minimum 8 characters", passed: password.length >= 8 },
                    { label: "Require uppercase character", passed: /[A-Z]/.test(password) },
                    { label: "Require lowercase character", passed: /[a-z]/.test(password) },
                    { label: "Require special character", passed: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
                    { label: "Require numeric character", passed: /\d/.test(password) }
                  ].map((req, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 border-black flex items-center justify-center flex-shrink-0 transition-colors ${req.passed ? 'bg-[var(--color-brutal-green)]' : 'bg-white'}`}>
                        {req.passed && <Check className="w-3 h-3 text-black stroke-[4]" />}
                      </div>
                      <span className={`text-xs font-black uppercase leading-tight ${req.passed ? 'text-gray-500 line-through decoration-black decoration-2' : 'text-black'}`}>{req.label}</span>
                    </li>
                  ))}
                </ul>
                <button 
                  type="button" 
                  onClick={() => setShowPasswordConstraints(false)}
                  className="w-full py-2 bg-[var(--color-brutal-teal)] border-2 border-black text-black font-black text-sm uppercase hover:-translate-y-1 hover:shadow-[2px_2px_0_0_#000] transition-all"
                >
                  Got it
                </button>
              </div>
            )}

            {isLogin && (
              <div className="mt-2 text-right">
                <Link href="/forgot-password" className="text-sm font-black uppercase text-black hover:text-[var(--color-brutal-blue)] hover:underline decoration-2 underline-offset-2 transition-colors">
                  Forgot Password?
                </Link>
              </div>
            )}
          </div>

          {isLogin && (
            <div className="flex items-center justify-between mb-8 p-4 border-4 border-black bg-[var(--color-brutal-teal)]">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-6 h-6 border-4 border-black appearance-none checked:bg-black bg-white cursor-pointer" 
                  />
                  {rememberMe && <svg className="w-4 h-4 absolute left-1 top-1 text-white pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                </div>
                <span className="text-lg font-black uppercase text-black">Remember Me</span>
              </label>
            </div>
          )}

          {!isLogin && (
            <div className="mb-8 p-4 border-4 border-black bg-[var(--color-brutal-bg)] flex items-start gap-3 mt-8">
              <div className="relative flex items-center mt-1">
                <input 
                  type="checkbox" 
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-6 h-6 border-4 border-black appearance-none checked:bg-black bg-white cursor-pointer flex-shrink-0" 
                />
                {termsAccepted && <svg className="w-4 h-4 absolute left-1 top-1 text-white pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
              </div>
              <div>
                <p className="text-black font-bold uppercase text-sm leading-tight">
                  I have read and unconditionally agree to the{" "}
                  <button type="button" onClick={() => setShowTerms(true)} className="text-[var(--color-brutal-red)] underline decoration-2 underline-offset-2 hover:bg-black hover:text-white transition-colors">
                    Security Disclaimer & Terms of Service
                  </button>.
                </p>
              </div>
            </div>
          )}

          <div className={!isLogin ? "mt-4" : ""}>
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 text-xl brutal-btn ${isLogin ? 'bg-[var(--color-brutal-teal)]' : 'bg-[var(--color-brutal-yellow)]'}`}
            >
              {loading ? "PLEASE WAIT..." : (isLogin ? "SIGN IN" : "CREATE ACCOUNT")}
            </button>
          </div>

          <div className="mt-8 text-center bg-gray-100 brutal-border p-4">
            <span className="text-black font-bold uppercase mr-2">
              {isLogin ? "No account?" : "Already joined?"}
            </span>
            <button
              type="button"
              onClick={() => {
                router.push(isLogin ? `/login?mode=signup&role=${role}` : `/login?mode=signin`);
                setIsLogin(!isLogin);
              }}
              className="text-lg font-black text-black hover:text-[var(--color-brutal-blue)] underline decoration-4 underline-offset-4 uppercase transition-colors"
            >
              {isLogin ? "Sign Up" : "Log In"}
            </button>
          </div>
        </form>
      </div>

      {/* Right side: Brutalist Banner for Desktop */}
      <div className="hidden md:flex w-full md:w-1/2 bg-[var(--color-brutal-yellow)] p-10 flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute top-20 left-10 w-40 h-40 bg-[var(--color-brutal-teal)] brutal-border -rotate-6"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-[var(--color-brutal-red)] brutal-border rounded-full"></div>
        <h2 className="text-7xl font-black text-black text-center uppercase tracking-tighter leading-none z-10">
          {isLogin ? (
            <>WELCOME <br/><span className="bg-white px-2 mt-2 inline-block brutal-border rotate-2">BACK</span></>
          ) : (
            <>JOIN <br/><span className="bg-[var(--color-brutal-pink)] px-2 mt-2 inline-block brutal-border -rotate-2">NEED</span></>
          )}
        </h2>
        <p className="text-black font-bold text-xl mt-8 z-10 bg-white border-4 border-black px-4 py-2 -rotate-1">
          {isLogin ? "Ready to get things done?" : "The best pros in town."}
        </p>
      </div>
    </div>
    {showTerms && <TermsDisclaimer role={role} onClose={() => setShowTerms(false)} />}
    </>
  );
}
