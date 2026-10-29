"use client";

import { useState, useEffect, useRef } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { updateProfile, updateEmail, deleteUser, User, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import SignOutButton from "@/components/SignOutButton";
import { UserAccount } from "@/types";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAlert } from "@/components/AlertProvider";
import ImageCropper from "@/components/ImageCropper";
import UserAvatar from "@/components/UserAvatar";
import AccountStrikesSection from "@/components/AccountStrikesSection";
import CustomerCreditsCard from "@/components/CustomerCreditsCard";
import { Camera, FileText, Building2, Info, User as UserIcon, ExternalLink, HelpCircle, Pencil, ArrowLeft, ChevronRight, Wrench, ShieldCheck, Coins } from "lucide-react";
import { compressImage } from "@/utils/imageCompression";
import { servicesData } from "@/data/services";
import { isNativeApp } from "@/utils/platform";

interface SharedSettingsProps {
  isArtisan?: boolean;
}

export default function SharedSettings({ isArtisan = false }: SharedSettingsProps) {
  const router = useRouter();
  const { showAlert } = useAlert();

  const [activeTab, setActiveTab] = useState<"profile" | "credits" | "notifications" | "about">("profile");
  const [accountSubmenu, setAccountSubmenu] = useState<null | "profile" | "services" | "credits" | "security">(null);

  const [authUser, setAuthUser] = useState<User | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Advanced Services Management
  const [artisanServices, setArtisanServices] = useState<{
    trade: string;
    subcategory: string;
    hasCertification: boolean;
    certificateUrl: string | null;
    isCertificateVerified: boolean;
    certificateFile: File | null;
  }[]>([]);

  // Edit Service Form State
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [editServiceForm, setEditServiceForm] = useState<{
    trade: string;
    subcategory: string;
    hasCertification: boolean;
    certificateFile: File | null;
    certificateUrl: string | null;
  }>({
    trade: "",
    subcategory: "",
    hasCertification: false,
    certificateFile: null,
    certificateUrl: null,
  });

  // New Service Form State
  const defaultTrade = Object.values(servicesData)[0]?.title || "Plumbing";
  const defaultSub = Object.values(servicesData)[0]?.subServices[0]?.title || "";
  const [newServiceForm, setNewServiceForm] = useState({
    trade: defaultTrade,
    subcategory: defaultSub,
    hasCertification: false,
    certificateFile: null as File | null
  });
  const [showAddForm, setShowAddForm] = useState(false);

  const [preferences, setPreferences] = useState({
    pushNotifications: true,
    inAppNotifications: true,
    messagingNotifications: true,
    locationEnabled: true
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const tabParam = new URLSearchParams(window.location.search).get("tab");
      if (tabParam === "credits" && !isArtisan) {
        setActiveTab("profile");
        setAccountSubmenu("credits");
      } else if (tabParam === "services" && isArtisan) {
        setActiveTab("profile");
        setAccountSubmenu("services");
      } else if (tabParam === "security") {
        setActiveTab("profile");
        setAccountSubmenu("security");
      }
    }
  }, [isArtisan]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setAuthUser(user);
        setEmail(user.email || "");
        setPhotoURL(user.photoURL || null);

        try {
          // Initialize from auth profile first
          if (user.displayName) {
            const parts = user.displayName.split(' ');
            setFirstName(parts[0] || "");
            setLastName(parts.slice(1).join(' ') || "");
          }

          const userDoc = await getDoc(doc(db, "users", user.uid));
          let dbPhotoURL = null;

          if (userDoc.exists()) {
            const data = userDoc.data() as UserAccount;
            if (data.firstName) setFirstName(data.firstName);
            if (data.lastName) setLastName(data.lastName);
            setPhone(data.phone || "");
            if (data.photoURL) dbPhotoURL = data.photoURL;

            if (data.preferences) {
              setPreferences({ inAppNotifications: true, ...data.preferences });
            }
          }

          if (isArtisan) {
            const artisanDoc = await getDoc(doc(db, "artisans", user.uid));
            if (artisanDoc.exists()) {
              const data = artisanDoc.data();
              if (data.services) {
                setArtisanServices(data.services.map((s: Record<string, unknown>) => ({ ...s, certificateFile: null })));
              }
              if (data.profilePictureUrl) dbPhotoURL = data.profilePictureUrl;
            }
          }

          if (dbPhotoURL && !user.photoURL) {
            setPhotoURL(dbPhotoURL);
          } else if (dbPhotoURL) {
            setPhotoURL(dbPhotoURL);
          }
        } catch (e) {
          console.error("Error fetching user data", e);
        }
      } else {
        if (isNativeApp()) {
          router.push("/login");
        } else {
          router.push("/");
        }
      }
    });
    return () => unsubscribe();
  }, [router, isArtisan]);

  const handleUniversalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!authUser) throw new Error("Not authenticated");

      // Validate artisan services
      if (isArtisan) {
        const serviceSet = new Set(artisanServices.map(s => `${s.trade}:${s.subcategory}`));
        if (serviceSet.size !== artisanServices.length) {
          throw new Error("You have duplicate services. Please remove or change them.");
        }
        if (artisanServices.length === 0) {
          throw new Error("You must have at least one service.");
        }
      }

      const newDisplayName = `${firstName} ${lastName}`.trim();

      if (authUser.displayName !== newDisplayName) {
        await updateProfile(authUser, { displayName: newDisplayName });
      }

      let emailChanged = false;
      if (authUser.email !== email) {
        await updateEmail(authUser, email);
        emailChanged = true;
      }

      const userUpdatePayload: any = {
        firstName,
        lastName,
        displayName: newDisplayName,
        phone,
      };

      if (emailChanged) {
        userUpdatePayload.email = email;
      }

      await updateDoc(doc(db, "users", authUser.uid), userUpdatePayload);

      // Artisan specific updates (Email sync & Services & Certificates)
      if (isArtisan) {
        const uploadFileToR2 = async (file: File) => {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch('/api/upload-direct', { method: 'POST', body: formData });
          if (!res.ok) throw new Error("Failed to upload file");
          const { publicUrl } = await res.json();
          return publicUrl;
        };

        const finalServices = [];
        const serviceKeys = [];

        for (const svc of artisanServices) {
          let certificateUrl = svc.certificateUrl;

          if (svc.hasCertification && svc.certificateFile) {
            let fileToUpload = svc.certificateFile;
            if (svc.certificateFile.type.startsWith('image/')) {
              fileToUpload = await compressImage(svc.certificateFile, 4);
            }
            certificateUrl = await uploadFileToR2(fileToUpload);
          }

          finalServices.push({
            trade: svc.trade,
            subcategory: svc.subcategory,
            hasCertification: svc.hasCertification,
            certificateUrl,
            isCertificateVerified: svc.isCertificateVerified,
          });
          serviceKeys.push(`${svc.trade}:${svc.subcategory}`);
        }

        const artisanUpdatePayload: Record<string, unknown> = {
          services: finalServices,
          serviceKeys: serviceKeys,
        };

        if (emailChanged) {
          artisanUpdatePayload.email = email;
        }

        if (finalServices.length > 0) {
          artisanUpdatePayload.trade = finalServices[0].trade;
          artisanUpdatePayload.subcategory = finalServices[0].subcategory;
          artisanUpdatePayload.hasCertification = finalServices[0].hasCertification;
          artisanUpdatePayload.certificateUrl = finalServices[0].certificateUrl;
          artisanUpdatePayload.isCertificateVerified = finalServices[0].isCertificateVerified;
        }

        await updateDoc(doc(db, "artisans", authUser.uid), artisanUpdatePayload);
        setArtisanServices(finalServices.map(s => ({ ...s, certificateFile: null })));
      }

      if (emailChanged) {
        showAlert("Email updated successfully. Please sign in again for security.", "success");
        try {
          const { notifyNativeCall } = await import("@/utils/device");
          notifyNativeCall("signOut");
        } catch (e) {}
        await auth.signOut();
        if (isNativeApp()) {
          router.push("/login");
        } else {
          router.push("/");
        }
        return;
      }

      showAlert("Settings saved successfully!", "success");
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      if (err.code === "auth/requires-recent-login") {
        showAlert("Changing your email requires recent authentication. Please sign out and sign in again.", "error");
      } else {
        showAlert(err.message || "Failed to save settings", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = async (key: keyof typeof preferences) => {
    const newPreferences = {
      ...preferences,
      [key]: !preferences[key]
    };

    setPreferences(newPreferences);

    try {
      if (authUser) {
        await updateDoc(doc(db, "users", authUser.uid), { preferences: newPreferences });
        showAlert("Preference updated", "success");
      }
    } catch (err) {
      console.error(err);
      showAlert("Failed to update preference", "error");
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setCropperSrc(URL.createObjectURL(file));
      e.target.value = "";
    }
  };

  const handleCropComplete = async (croppedFile: File) => {
    setCropperSrc(null);
    setUploadingImage(true);
    try {
      const user = auth.currentUser || authUser;
      if (!user) {
        showAlert("Authentication error. Please sign in again.", "error");
        return;
      }

      const compressed = await compressImage(croppedFile, 3);

      const formData = new FormData();
      formData.append("file", compressed, `${user.uid}_${Date.now()}.jpg`);
      const res = await fetch('/api/upload-direct', { method: 'POST', body: formData });
      if (!res.ok) throw new Error("Failed to upload profile picture");
      const { publicUrl } = await res.json();

      const oldPhotoURL = user.photoURL;

      await updateProfile(user, { photoURL: publicUrl });
      await updateDoc(doc(db, "users", user.uid), { photoURL: publicUrl });

      try {
        const artisanRef = doc(db, "artisans", user.uid);
        const artSnap = await getDoc(artisanRef);
        if (artSnap.exists()) {
          await updateDoc(artisanRef, { profilePictureUrl: publicUrl });
        }
      } catch (e) {
        console.error("Failed to update artisan profile picture", e);
      }

      setPhotoURL(publicUrl);
      showAlert("Profile picture updated!", "success");

      if (oldPhotoURL && !oldPhotoURL.includes("firebasestorage.googleapis.com")) {
        fetch('/api/delete-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: oldPhotoURL })
        }).catch(err => console.error("Failed to delete old photo:", err));
      }
    } catch (error) {
      console.error(error);
      showAlert("Failed to upload profile picture", "error");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddService = () => {
    const tradeCategories = Object.values(servicesData);
    const defaultCategory = tradeCategories[0].title;

    // Check limit and uniqueness
    const uniqueCategories = new Set(artisanServices.map(s => s.trade));
    if (uniqueCategories.size >= 5 && !uniqueCategories.has(newServiceForm.trade)) {
      showAlert("You can only offer services in up to 5 different trades.", "error");
      return;
    }

    if (artisanServices.some(s => s.trade === newServiceForm.trade && s.subcategory === newServiceForm.subcategory)) {
      showAlert("You already offer this specific service.", "error");
      return;
    }

    setArtisanServices([...artisanServices, {
      trade: newServiceForm.trade,
      subcategory: newServiceForm.subcategory,
      hasCertification: newServiceForm.hasCertification,
      certificateUrl: null,
      isCertificateVerified: false,
      certificateFile: newServiceForm.certificateFile
    }]);

    setNewServiceForm({
      trade: defaultCategory,
      subcategory: tradeCategories[0].subServices[0].title,
      hasCertification: false,
      certificateFile: null
    });
    setShowAddForm(false);
  };

  const handleRemoveService = (index: number) => {
    setArtisanServices(artisanServices.filter((_, i) => i !== index));
    if (editingServiceIndex === index) {
      setEditingServiceIndex(null);
    }
  };

  const handleStartEditService = (index: number) => {
    const svc = artisanServices[index];
    setEditingServiceIndex(index);
    setEditServiceForm({
      trade: svc.trade,
      subcategory: svc.subcategory,
      hasCertification: svc.hasCertification,
      certificateFile: svc.certificateFile || null,
      certificateUrl: svc.certificateUrl || null,
    });
    setShowAddForm(false);
  };

  const handleUpdateEditService = (field: string, value: any) => {
    const updated = { ...editServiceForm, [field]: value };
    if (field === 'trade') {
      const categoryData = Object.values(servicesData).find(c => c.title === value);
      if (categoryData) {
        updated.subcategory = categoryData.subServices[0].title;
      }
    }
    setEditServiceForm(updated);
  };

  const handleSaveEditService = () => {
    if (editingServiceIndex === null) return;
    const duplicate = artisanServices.some((s, idx) => 
      idx !== editingServiceIndex && s.trade === editServiceForm.trade && s.subcategory === editServiceForm.subcategory
    );
    if (duplicate) {
      showAlert("You already offer this specific service.", "error");
      return;
    }
    const updatedServices = [...artisanServices];
    const oldSvc = updatedServices[editingServiceIndex];
    updatedServices[editingServiceIndex] = {
      ...oldSvc,
      trade: editServiceForm.trade,
      subcategory: editServiceForm.subcategory,
      hasCertification: editServiceForm.hasCertification,
      certificateFile: editServiceForm.certificateFile,
      certificateUrl: editServiceForm.certificateFile ? null : editServiceForm.certificateUrl,
      isCertificateVerified: editServiceForm.certificateFile ? false : (oldSvc.trade === editServiceForm.trade && oldSvc.subcategory === editServiceForm.subcategory ? oldSvc.isCertificateVerified : false),
    };
    setArtisanServices(updatedServices);
    setEditingServiceIndex(null);
    showAlert("Service updated. Click SAVE CHANGES to save all updates.", "success");
  };

  const handleUpdateNewService = <K extends keyof typeof newServiceForm>(field: K, value: typeof newServiceForm[K]) => {
    const updated = { ...newServiceForm, [field]: value };
    if (field === 'trade') {
      const categoryData = Object.values(servicesData).find(c => c.title === value);
      if (categoryData) {
        updated.subcategory = categoryData.subServices[0].title;
      }
    }
    setNewServiceForm(updated);
  };


  const handleDeleteAccount = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    setLoading(true);
    try {
      if (!authUser) return;

      const idToken = await authUser.getIdToken();

      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      // Delete the user from Firebase Auth on the client side
      await authUser.delete();

      try {
        const { notifyNativeCall } = await import("@/utils/device");
        notifyNativeCall("signOut");
      } catch (e) {}
      await auth.signOut();
      if (isNativeApp()) {
        router.push("/login");
      } else {
        router.push("/");
      }
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      if (err.code === "auth/requires-recent-login") {
        showAlert("Deleting your account requires recent authentication. Please sign out and sign in again.", "error");
      } else {
        showAlert(err.message || "Failed to delete account", "error");
      }
      setDeleteConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] px-6 md:px-12 pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <h1 className="text-[3rem] font-black text-black tracking-tighter uppercase leading-none mb-8 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">
        SETTINGS
      </h1>

      {/* Tabs */}
      <div className="flex w-full border-b-4 border-black mb-8 relative">
        <button
          onClick={() => { setActiveTab("profile"); setAccountSubmenu(null); }}
          className={`flex-1 py-3 md:py-4 font-black uppercase text-xs sm:text-sm md:text-lg border-r-4 border-black transition-colors ${activeTab === "profile" ? "bg-[var(--color-brutal-yellow)] text-black" : "bg-white text-gray-400 hover:bg-gray-100"
            }`}
        >
          Account
        </button>
        <button
          onClick={() => { setActiveTab("notifications"); setAccountSubmenu(null); }}
          className={`flex-1 py-3 md:py-4 font-black uppercase text-xs sm:text-sm md:text-lg border-r-4 border-black transition-colors ${activeTab === "notifications" ? "bg-[var(--color-brutal-yellow)] text-black" : "bg-white text-gray-400 hover:bg-gray-100"
            }`}
        >
          Alerts
        </button>
        <button
          onClick={() => { setActiveTab("about"); setAccountSubmenu(null); }}
          className={`flex-1 py-3 md:py-4 font-black uppercase text-xs sm:text-sm md:text-lg transition-colors ${activeTab === "about" ? "bg-[var(--color-brutal-yellow)] text-black" : "bg-white text-gray-400 hover:bg-gray-100"
            }`}
        >
          About
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        {activeTab === "profile" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* SUBMENU: MAIN LIST (when no submenu is selected) */}
            {accountSubmenu === null && (
              <div className="space-y-6">
                {/* User Overview Header Card */}
                <div className="bg-[var(--color-brutal-yellow)] border-4 border-black p-5 sm:p-6 shadow-[6px_6px_0_0_#000] flex items-center gap-4 sm:gap-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-3 border-black overflow-hidden bg-white shadow-[2px_2px_0_0_#000] shrink-0">
                    <UserAvatar photoURL={photoURL} name={firstName || "User"} className="w-full h-full text-2xl sm:text-3xl font-black text-black" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-xl sm:text-2xl font-black uppercase text-black truncate leading-tight">
                        {firstName ? `${firstName} ${lastName}`.trim() : "My Account"}
                      </h2>
                      <span className="bg-black text-white px-2 py-0.5 text-[10px] sm:text-xs font-black uppercase tracking-wider">
                        {isArtisan ? "Technician" : "Customer"}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-gray-800 truncate">{email || "No email"}</p>
                    {phone && <p className="text-xs font-bold text-gray-700 mt-0.5">{phone}</p>}
                  </div>
                </div>

                {/* Neobrutalist Settings Submenu List */}
                <div className="space-y-3 sm:space-y-4">
                  {/* 1. Profile Details (Both) */}
                  <button
                    type="button"
                    onClick={() => setAccountSubmenu("profile")}
                    className="w-full bg-white border-4 border-black p-4 sm:p-5 shadow-[4px_4px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_#000] transition-all flex items-center justify-between text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 sm:gap-4">
                      <div className="w-12 h-12 bg-[var(--color-brutal-pink)] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000] group-hover:rotate-6 transition-transform">
                        <UserIcon className="w-6 h-6 stroke-[2.5] text-black" />
                      </div>
                      <div>
                        <h3 className="font-black text-base sm:text-lg uppercase text-black leading-tight">Profile</h3>
                        <p className="font-bold text-xs sm:text-sm text-gray-600">Personal info, photo & contact details</p>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 stroke-[3] text-black shrink-0 group-hover:translate-x-1 transition-transform" />
                  </button>

                  {/* 2. Manage Services (Technicians only) */}
                  {isArtisan && (
                    <button
                      type="button"
                      onClick={() => setAccountSubmenu("services")}
                      className="w-full bg-white border-4 border-black p-4 sm:p-5 shadow-[4px_4px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_#000] transition-all flex items-center justify-between text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5 sm:gap-4">
                        <div className="w-12 h-12 bg-[var(--color-brutal-yellow)] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000] group-hover:rotate-6 transition-transform">
                          <Wrench className="w-6 h-6 stroke-[2.5] text-black" />
                        </div>
                        <div>
                          <h3 className="font-black text-base sm:text-lg uppercase text-black leading-tight">Manage Services</h3>
                          <p className="font-bold text-xs sm:text-sm text-gray-600">
                            {artisanServices.length} active service{artisanServices.length === 1 ? '' : 's'} & certifications
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-6 h-6 stroke-[3] text-black shrink-0 group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}

                  {/* 2. Credits (Customers only) */}
                  {!isArtisan && (
                    <button
                      type="button"
                      onClick={() => setAccountSubmenu("credits")}
                      className="w-full bg-white border-4 border-black p-4 sm:p-5 shadow-[4px_4px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_#000] transition-all flex items-center justify-between text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5 sm:gap-4">
                        <div className="w-12 h-12 bg-[var(--color-brutal-green)] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000] group-hover:rotate-6 transition-transform">
                          <Coins className="w-6 h-6 stroke-[2.5] text-black" />
                        </div>
                        <div>
                          <h3 className="font-black text-base sm:text-lg uppercase text-black leading-tight">Credits</h3>
                          <p className="font-bold text-xs sm:text-sm text-gray-600">
                            Bonus, reward & refund credits balance
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-6 h-6 stroke-[3] text-black shrink-0 group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}

                  {/* 3. Account Security & Actions (Both) */}
                  <button
                    type="button"
                    onClick={() => setAccountSubmenu("security")}
                    className="w-full bg-white border-4 border-black p-4 sm:p-5 shadow-[4px_4px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_#000] transition-all flex items-center justify-between text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 sm:gap-4">
                      <div className="w-12 h-12 bg-[var(--color-brutal-teal)] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000] group-hover:rotate-6 transition-transform">
                        <ShieldCheck className="w-6 h-6 stroke-[2.5] text-black" />
                      </div>
                      <div>
                        <h3 className="font-black text-base sm:text-lg uppercase text-black leading-tight">Account Security & Actions</h3>
                        <p className="font-bold text-xs sm:text-sm text-gray-600">Password reset, standing, sign out & delete</p>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 stroke-[3] text-black shrink-0 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            )}

            {/* SUBMENU 1: PROFILE DETAILS */}
            {accountSubmenu === "profile" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-200">
                <button
                  type="button"
                  onClick={() => setAccountSubmenu(null)}
                  className="inline-flex items-center gap-2 bg-white border-3 border-black px-3.5 py-1.5 font-black text-xs sm:text-sm uppercase shadow-[2px_2px_0_0_#000] hover:bg-[var(--color-brutal-yellow)] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 stroke-[3]" /> Back to Account
                </button>

                {/* Profile Picture Change Section */}
                <div className="flex flex-col items-center mb-6">
                  <div className="relative mb-3">
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-black overflow-hidden bg-[var(--color-brutal-yellow)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      {uploadingImage ? (
                        <div className="w-full h-full flex items-center justify-center bg-black/10">
                          <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : (
                        <UserAvatar photoURL={photoURL} name={firstName || "User"} className="w-full h-full text-4xl text-black font-black" />
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 w-9 h-9 sm:w-10 sm:h-10 bg-[var(--color-brutal-pink)] border-3 border-black rounded-full flex justify-center items-center cursor-pointer hover:scale-110 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform">
                      <Camera className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3]" />
                      <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                    </label>
                  </div>
                  <p className="font-black uppercase text-xs sm:text-sm text-gray-500">Tap icon to change</p>
                </div>

                <form onSubmit={handleUniversalSave}>
                  <div className="bg-[var(--color-brutal-teal)] border-4 border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-6">
                    <h2 className="text-xl font-black uppercase text-black mb-4">Personal Details</h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-black text-black mb-2 uppercase">First Name</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full p-4 bg-white border-4 border-black focus:outline-none focus:bg-[var(--color-brutal-yellow)] font-bold text-black transition-colors"
                        placeholder="John"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-black text-black mb-2 uppercase">Last Name</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full p-4 bg-white border-4 border-black focus:outline-none focus:bg-[var(--color-brutal-yellow)] font-bold text-black transition-colors"
                        placeholder="Doe"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-black mb-2 uppercase">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-4 bg-white border-4 border-black focus:outline-none focus:bg-[var(--color-brutal-yellow)] font-bold text-black transition-colors"
                      placeholder="john@example.com"
                      required
                    />
                    <p className="text-xs font-bold mt-2 uppercase bg-black text-white inline-block px-1">Note: Changing email forces logout</p>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-black mb-2 uppercase">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-4 bg-white border-4 border-black focus:outline-none focus:bg-[var(--color-brutal-yellow)] font-bold text-black transition-colors"
                      placeholder="+2348012345678"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 sm:py-5 bg-[var(--color-brutal-green)] border-4 border-black font-black text-lg sm:text-xl uppercase text-black hover:-translate-y-1 shadow-[4px_4px_0_0_#000] hover:shadow-[6px_6px_0_0_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? "SAVING CHANGES..." : "SAVE CHANGES"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SUBMENU 2: MANAGE SERVICES (Technicians only) */}
        {accountSubmenu === "services" && isArtisan && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-200">
            <button
              type="button"
              onClick={() => setAccountSubmenu(null)}
              className="inline-flex items-center gap-2 bg-white border-3 border-black px-3.5 py-1.5 font-black text-xs sm:text-sm uppercase shadow-[2px_2px_0_0_#000] hover:bg-[var(--color-brutal-yellow)] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 stroke-[3]" /> Back to Account
            </button>

            <form onSubmit={handleUniversalSave}>
                <div className="bg-[var(--color-brutal-bg)] p-5 sm:p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                  <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-2">Manage Services</h2>
                  <p className="text-xs sm:text-sm font-bold text-black border-l-4 border-black pl-3 mb-6">
                    You can add, edit, or remove services and attach certificates. Adding specific services improves your matching rate.
                  </p>
                  {/* Existing Services List */}
                  <div className="mb-8">
                    <h3 className="text-lg font-black uppercase text-black border-b-4 border-black pb-2 mb-4">Your Active Services</h3>

                    {artisanServices.length === 0 ? (
                      <p className="p-4 bg-gray-100 border-4 border-black font-bold text-sm uppercase">You have no services added. Add one below!</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {artisanServices.map((svc, index) => (
                          <div key={index} className="bg-white border-4 border-black p-4 relative flex flex-col hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all">
                            {/* Action Buttons: Remove & Edit Pen */}
                            <div className="absolute -top-3 -right-3 flex flex-col gap-1.5 z-10">
                              <button
                                type="button"
                                onClick={() => handleRemoveService(index)}
                                className="w-8 h-8 bg-[var(--color-brutal-red)] border-2 border-black flex items-center justify-center font-black text-white hover:scale-110 transition-transform shadow-[2px_2px_0_0_#000] cursor-pointer"
                                title="Remove Service"
                              >
                                X
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEditService(index)}
                                className="w-8 h-8 bg-[var(--color-brutal-yellow)] border-2 border-black flex items-center justify-center font-black text-black hover:scale-110 transition-transform shadow-[2px_2px_0_0_#000] cursor-pointer"
                                title="Edit Service & Certificate"
                              >
                                <Pencil className="w-4 h-4 stroke-[2.5]" />
                              </button>
                            </div>
                            <h4 className="font-black text-lg uppercase leading-tight mb-1 pr-8">{svc.trade}</h4>
                            <p className="font-bold text-gray-600 text-xs uppercase mb-3 border-l-2 border-black pl-2">{svc.subcategory}</p>

                            <div className="mt-auto pt-2 border-t-2 border-dashed border-gray-300 flex items-center justify-between">
                              {svc.isCertificateVerified ? (
                                <span className="bg-[var(--color-brutal-green)] text-black text-[10px] font-black px-2 py-0.5 border-2 border-black uppercase">Verified</span>
                              ) : svc.certificateUrl || svc.certificateFile ? (
                                <span className="bg-[var(--color-brutal-yellow)] text-black text-[10px] font-black px-2 py-0.5 border-2 border-black uppercase">
                                  {svc.certificateFile ? "New Cert Attached" : "Cert Pending"}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-gray-400 uppercase">No Certificate</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inline Edit Service Form */}
                  {editingServiceIndex !== null && (
                    <div className="p-6 bg-[var(--color-brutal-yellow)] border-4 border-black mb-8 shadow-[6px_6px_0_0_#000]">
                      <div className="flex justify-between items-center mb-4 border-b-3 border-black pb-2">
                        <h3 className="text-xl font-black uppercase text-black flex items-center gap-2">
                          <Pencil className="w-5 h-5 stroke-[3]" />
                          Edit Service #{editingServiceIndex + 1}
                        </h3>
                        <button 
                          type="button"
                          onClick={() => setEditingServiceIndex(null)}
                          className="w-7 h-7 bg-white border-2 border-black font-black flex items-center justify-center hover:bg-black hover:text-white text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-black text-black mb-1 uppercase">Primary Trade</label>
                          <select
                            value={editServiceForm.trade}
                            onChange={(e) => handleUpdateEditService('trade', e.target.value)}
                            className="w-full p-3 bg-white border-4 border-black focus:outline-none focus:bg-white text-black font-bold uppercase"
                          >
                            {Object.values(servicesData).map((c) => (
                              <option key={c.id} value={c.title}>{c.title}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-black text-black mb-1 uppercase">Specific Service (Subcategory)</label>
                          <select
                            value={editServiceForm.subcategory}
                            onChange={(e) => handleUpdateEditService('subcategory', e.target.value)}
                            className="w-full p-3 bg-white border-4 border-black focus:outline-none focus:bg-white text-black font-bold uppercase"
                          >
                            {Object.values(servicesData).find(c => c.title === editServiceForm.trade)?.subServices.map((sub) => (
                              <option key={sub.id} value={sub.title}>{sub.title}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="flex items-start gap-2 p-3 bg-white border-4 border-black cursor-pointer shadow-[2px_2px_0_0_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform mt-2">
                            <input
                              type="checkbox"
                              checked={editServiceForm.hasCertification}
                              onChange={(e) => handleUpdateEditService('hasCertification', e.target.checked)}
                              className="w-5 h-5 border-2 border-black appearance-none checked:bg-black bg-white cursor-pointer mt-0.5"
                            />
                            <span className="text-sm font-black text-black leading-tight uppercase">I have certification for this service</span>
                          </label>
                        </div>

                        {editServiceForm.hasCertification && (
                          <div className="p-4 bg-white border-4 border-black mt-2">
                            <label className="block text-sm font-black text-black uppercase mb-1">Upload / Replace Certificate</label>
                            <p className="text-xs font-bold text-gray-500 uppercase mb-3">Upload your license, training certificate, or trade qualification (PDF or Image).</p>
                            
                            {editServiceForm.certificateUrl && !editServiceForm.certificateFile && (
                              <div className="mb-3 flex items-center gap-2 p-2 bg-[var(--color-brutal-teal)] border-2 border-black">
                                <FileText className="w-4 h-4" />
                                <a href={editServiceForm.certificateUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-black uppercase underline truncate">
                                  View Current Certificate ↗
                                </a>
                              </div>
                            )}

                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => {
                                if (e.target.files) handleUpdateEditService('certificateFile', e.target.files[0]);
                              }}
                              className="w-full text-xs text-black file:mr-2 file:py-1 file:px-2 file:border-2 file:border-black file:font-black file:bg-[var(--color-brutal-teal)] file:text-black cursor-pointer uppercase bg-gray-50 p-1 border-2 border-black"
                            />
                            {editServiceForm.certificateFile && (
                              <p className="text-xs font-black mt-2 bg-[var(--color-brutal-green)] inline-block px-1 border-2 border-black uppercase">
                                New File Selected: {editServiceForm.certificateFile.name}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex gap-4 pt-2">
                          <button
                            type="button"
                            onClick={() => setEditingServiceIndex(null)}
                            className="flex-1 py-3 bg-white border-4 border-black text-black font-black uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5 transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEditService}
                            className="flex-[2] py-3 bg-[var(--color-brutal-green)] border-4 border-black text-black font-black uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5 transition-all cursor-pointer"
                          >
                            Save Service Updates
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Add New Service Form */}
                  {showAddForm ? (
                    <div className="p-6 bg-[var(--color-brutal-teal)] border-4 border-black mb-6 shadow-[4px_4px_0_0_#000]">
                      <h3 className="text-lg font-black uppercase text-black mb-4">Add a New Service</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-black text-black mb-1 uppercase">Primary Trade</label>
                          <select
                            value={newServiceForm.trade}
                            onChange={(e) => handleUpdateNewService('trade', e.target.value)}
                            className="w-full p-3 bg-white border-4 border-black focus:outline-none focus:bg-[var(--color-brutal-yellow)] text-black font-bold transition-colors uppercase"
                          >
                            {Object.values(servicesData).map((c) => {
                              const uniqueCategories = new Set(artisanServices.map(s => s.trade));
                              const isAtLimit = uniqueCategories.size >= 5;
                              const isAlreadySelected = uniqueCategories.has(c.title);
                              const disabled = isAtLimit && !isAlreadySelected;

                              return (
                                <option key={c.id} value={c.title} disabled={disabled}>
                                  {c.title} {disabled ? '(Limit Reached)' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-black text-black mb-1 uppercase">Specific Service (Subcategory)</label>
                          <select
                            value={newServiceForm.subcategory}
                            onChange={(e) => handleUpdateNewService('subcategory', e.target.value)}
                            className="w-full p-3 bg-white border-4 border-black focus:outline-none focus:bg-[var(--color-brutal-yellow)] text-black font-bold transition-colors uppercase"
                          >
                            {Object.values(servicesData).find(c => c.title === newServiceForm.trade)?.subServices.map((sub) => (
                              <option key={sub.id} value={sub.title}>{sub.title}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="flex items-start gap-2 p-3 bg-white border-4 border-black cursor-pointer shadow-[2px_2px_0_0_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform mt-2">
                            <input
                              type="checkbox"
                              checked={newServiceForm.hasCertification}
                              onChange={(e) => handleUpdateNewService('hasCertification', e.target.checked)}
                              className="w-5 h-5 border-2 border-black appearance-none checked:bg-black bg-white cursor-pointer mt-0.5"
                            />
                            <span className="text-sm font-black text-black leading-tight uppercase">I have certification for this service</span>
                          </label>
                        </div>

                        {newServiceForm.hasCertification && (
                          <div className="p-4 bg-[var(--color-brutal-blue)] border-4 border-black mt-2">
                            <label className="block text-sm font-black text-black uppercase mb-2">Upload Certificate</label>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => {
                                if (e.target.files) handleUpdateNewService('certificateFile', e.target.files[0]);
                              }}
                              className="w-full text-xs text-black file:mr-2 file:py-1 file:px-2 file:border-2 file:border-black file:font-black file:bg-[var(--color-brutal-yellow)] file:text-black cursor-pointer uppercase bg-white p-1 border-2 border-black"
                            />
                            {newServiceForm.certificateFile && (
                              <p className="text-xs font-black mt-2 bg-white inline-block px-1 border-2 border-black uppercase">Selected: {newServiceForm.certificateFile.name}</p>
                            )}
                          </div>
                        )}

                        <div className="flex gap-4 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowAddForm(false)}
                            className="flex-1 py-3 bg-white border-4 border-black text-black font-black uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5 transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddService}
                            className="flex-[2] py-3 bg-[var(--color-brutal-pink)] border-4 border-black text-black font-black uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5 transition-all"
                          >
                            Add to List
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAddForm(true)}
                      className="w-full py-4 bg-[var(--color-brutal-yellow)] border-4 border-black text-black font-black uppercase tracking-widest mb-6 shadow-[4px_4px_0_0_#000] hover:-translate-y-1 transition-all"
                    >
                      + Add New Service
                    </button>
                  )}

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 sm:py-5 bg-[var(--color-brutal-green)] border-4 border-black font-black text-lg sm:text-xl uppercase text-black hover:-translate-y-1 shadow-[4px_4px_0_0_#000] hover:shadow-[6px_6px_0_0_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {loading ? "SAVING CHANGES..." : "SAVE CHANGES"}
                      </button>
                    </div>
                  </div>
                </form>
            </div>
          )}

          {/* SUBMENU 2: CREDITS (Customers only) */}
          {accountSubmenu === "credits" && !isArtisan && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-200">
              <button
                type="button"
                onClick={() => setAccountSubmenu(null)}
                className="inline-flex items-center gap-2 bg-white border-3 border-black px-3.5 py-1.5 font-black text-xs sm:text-sm uppercase shadow-[2px_2px_0_0_#000] hover:bg-[var(--color-brutal-yellow)] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 stroke-[3]" /> Back to Account
              </button>

              {authUser && <CustomerCreditsCard customerId={authUser.uid} />}
            </div>
          )}

          {/* SUBMENU 3: ACCOUNT SECURITY & ACTIONS */}
          {accountSubmenu === "security" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-200">
              <button
                type="button"
                onClick={() => setAccountSubmenu(null)}
                className="inline-flex items-center gap-2 bg-white border-3 border-black px-3.5 py-1.5 font-black text-xs sm:text-sm uppercase shadow-[2px_2px_0_0_#000] hover:bg-[var(--color-brutal-yellow)] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 stroke-[3]" /> Back to Account
              </button>

              {/* Account Status & Security */}
              {authUser && (
                <AccountStrikesSection
                  userId={authUser.uid}
                  userType={isArtisan ? "artisan" : "customer"}
                />
              )}

              <div className="bg-white border-4 border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4">
                <h2 className="text-xl font-black uppercase text-black mb-4">Account Security & Actions</h2>

                <button
                  type="button"
                  className="w-full py-4 bg-[var(--color-brutal-yellow)] border-4 border-black font-black uppercase text-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none text-xs sm:text-sm cursor-pointer"
                  onClick={async () => {
                    if (!authUser || !authUser.email) {
                      showAlert("No email associated with this account.", "error");
                      return;
                    }
                    try {
                      await sendPasswordResetEmail(auth, authUser.email);
                      showAlert(`Password reset email sent to ${authUser.email}.`, "success");
                    } catch (error: unknown) {
                      showAlert((error as Error).message || "Failed to send password reset email.", "error");
                    }
                  }}
                  disabled={loading}
                >
                  CHANGE PASSWORD
                </button>

                <SignOutButton className="w-full py-4 bg-gray-200 border-4 border-black font-black uppercase text-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-xs sm:text-sm cursor-pointer">
                  SIGN OUT
                </SignOutButton>

                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className={`w-full py-4 border-4 border-black font-black uppercase transition-all ${deleteConfirm
                      ? "bg-[var(--color-brutal-red)] text-white hover:bg-red-700 animate-pulse"
                      : "bg-white text-[var(--color-brutal-red)] hover:bg-[var(--color-brutal-red)] hover:text-white"
                    } hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xs sm:text-sm cursor-pointer`}
                >
                  {deleteConfirm ? "CLICK AGAIN TO CONFIRM DELETE" : "DELETE ACCOUNT"}
                </button>
              </div>
            </div>
          )}
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="bg-[var(--color-brutal-pink)] border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-black uppercase text-black mb-6 border-b-2 border-black pb-2">Preferences</h2>

            <div className="space-y-6">
              <label className="flex items-center justify-between cursor-pointer group bg-white p-4 border-4 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all">
                <span className="font-black uppercase text-black">Push Notifications</span>
                <div className={`w-14 h-8 border-4 border-black transition-colors relative ${preferences.pushNotifications ? "bg-[var(--color-brutal-green)]" : "bg-white"}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-black transition-transform ${preferences.pushNotifications ? "translate-x-7" : "translate-x-1"}`}></div>
                </div>
                <input type="checkbox" className="sr-only" checked={preferences.pushNotifications} onChange={() => handlePreferenceChange("pushNotifications")} />
              </label>

              <label className="flex items-center justify-between cursor-pointer group bg-white p-4 border-4 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all">
                <span className="font-black uppercase text-black">In-App Notifications</span>
                <div className={`w-14 h-8 border-4 border-black transition-colors relative ${preferences.inAppNotifications ? "bg-[var(--color-brutal-green)]" : "bg-white"}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-black transition-transform ${preferences.inAppNotifications ? "translate-x-7" : "translate-x-1"}`}></div>
                </div>
                <input type="checkbox" className="sr-only" checked={preferences.inAppNotifications} onChange={() => handlePreferenceChange("inAppNotifications")} />
              </label>

              <label className="flex items-center justify-between cursor-pointer group bg-white p-4 border-4 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all">
                <span className="font-black uppercase text-black">Messaging Alerts</span>
                <div className={`w-14 h-8 border-4 border-black transition-colors relative ${preferences.messagingNotifications ? "bg-[var(--color-brutal-green)]" : "bg-white"}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-black transition-transform ${preferences.messagingNotifications ? "translate-x-7" : "translate-x-1"}`}></div>
                </div>
                <input type="checkbox" className="sr-only" checked={preferences.messagingNotifications} onChange={() => handlePreferenceChange("messagingNotifications")} />
              </label>

              <label className="flex items-center justify-between cursor-pointer group bg-white p-4 border-4 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all">
                <span className="font-black uppercase text-black">Location Tracking</span>
                <div className={`w-14 h-8 border-4 border-black transition-colors relative ${preferences.locationEnabled ? "bg-[var(--color-brutal-green)]" : "bg-white"}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-black transition-transform ${preferences.locationEnabled ? "translate-x-7" : "translate-x-1"}`}></div>
                </div>
                <input type="checkbox" className="sr-only" checked={preferences.locationEnabled} onChange={() => handlePreferenceChange("locationEnabled")} />
              </label>
            </div>
          </div>
        )}

        {activeTab === "about" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Link
              href={isArtisan ? "/technician/help" : "/help"}
              className="block bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--color-brutal-yellow)] border-4 border-black flex items-center justify-center shrink-0 group-hover:bg-black group-hover:text-[var(--color-brutal-yellow)] transition-colors">
                  <HelpCircle className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase text-black tracking-tighter">Help Center & Support</h2>
                  <p className="font-bold text-gray-600">Get help, read FAQs, and contact support.</p>
                </div>
              </div>
            </Link>

            <div className="bg-[var(--color-brutal-blue)] border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
              <div className="flex items-center gap-4 mb-4 border-b-4 border-black pb-4">
                <div className="w-12 h-12 bg-white border-4 border-black flex items-center justify-center shrink-0">
                  <Info className="w-6 h-6 stroke-[3] text-black" />
                </div>
                <h2 className="text-2xl font-black uppercase text-black tracking-tighter">The NEED Vision</h2>
              </div>
              <p className="text-black font-bold text-lg leading-snug">
                NEED is a premium service marketplace designed to bridge the gap between skilled technicians and customers. Whether you&apos;re booking a quick repair or a major project, NEED makes every interaction seamless.
              </p>
            </div>

            <div className="bg-[var(--color-brutal-teal)] border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
              <div className="flex items-center gap-4 mb-4 border-b-4 border-black pb-4">
                <div className="w-12 h-12 bg-white border-4 border-black flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6 stroke-[3] text-black" />
                </div>
                <h2 className="text-2xl font-black uppercase text-black tracking-tighter">Developed by CharisCorp</h2>
              </div>
              <p className="text-black font-bold text-lg leading-snug">
                CharisCorp is an elite software engineering collective dedicated to building high-fidelity digital products. We specialize in creating fluid, high-performance applications that redefine user experience standards.
              </p>
            </div>

            <div className="bg-[var(--color-brutal-pink)] border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
              <div className="flex items-center gap-4 mb-4 border-b-4 border-black pb-4">
                <div className="w-12 h-12 bg-white border-4 border-black flex items-center justify-center shrink-0">
                  <UserIcon className="w-6 h-6 stroke-[3] text-black" />
                </div>
                <h2 className="text-2xl font-black uppercase text-black tracking-tighter">The Visionary</h2>
              </div>
              <p className="text-black font-bold text-lg leading-snug mb-4">
                <span className="uppercase text-xl font-black border-b-2 border-black mb-2 inline-block">Graduate Engr. Obunezi Chidugam Charis, B.Sc. (Software Engineering), GMCPN</span><br />
                <span className="font-black text-xl">CEO & Lead Architect</span><br /><br />
                A forward-thinking engineer with a passion for building software that isn&apos;t just functional, but inspiring. Under his leadership, CharisCorp continues to push the boundaries of what&apos;s possible in the digital ecosystem.
              </p>
              <a
                href="https://charis-portfolio-orpin.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-black text-white font-black uppercase py-3 px-6 border-4 border-white hover:bg-white hover:text-black hover:border-black transition-colors shadow-[4px_4px_0_0_#fff] hover:shadow-[4px_4px_0_0_#000]"
              >
                <ExternalLink className="w-5 h-5 stroke-[3]" />
                View Portfolio
              </a>
            </div>

            <div className="text-center pt-8 pb-4">
              <p className="font-black text-black uppercase tracking-widest text-lg mb-1">NEED v1.0</p>
              <p className="font-bold text-gray-500 uppercase text-xs">© 2026 CharisCorp. All rights reserved.</p>
            </div>
          </div>
        )}

        {cropperSrc && (
          <ImageCropper
            imageSrc={cropperSrc}
            onCropComplete={handleCropComplete}
            onCancel={() => setCropperSrc(null)}
          />
        )}
      </div>
    </div>
  );
}
