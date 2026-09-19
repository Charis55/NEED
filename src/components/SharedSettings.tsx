"use client";

import { useState, useEffect, useRef } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { updateProfile, updateEmail, deleteUser, User } from "firebase/auth";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import SignOutButton from "@/components/SignOutButton";
import { UserAccount } from "@/types";
import { useRouter } from "next/navigation";
import { useAlert } from "@/components/AlertProvider";
import ImageCropper from "@/components/ImageCropper";
import UserAvatar from "@/components/UserAvatar";
import { Camera, FileText } from "lucide-react";
import { compressImage } from "@/utils/imageCompression";

interface SharedSettingsProps {
  isArtisan?: boolean;
}

export default function SharedSettings({ isArtisan = false }: SharedSettingsProps) {
  const router = useRouter();
  const { showAlert } = useAlert();
  
  const [activeTab, setActiveTab] = useState<"profile" | "account" | "notifications">("profile");
  
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

  // Artisan Certificates
  const [certificates, setCertificates] = useState<string[]>([]);
  const [uploadingCert, setUploadingCert] = useState(false);

  const [preferences, setPreferences] = useState({
    pushNotifications: true,
    messagingNotifications: true,
    locationEnabled: true
  });
  
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
          if (userDoc.exists()) {
            const data = userDoc.data() as UserAccount;
            if (data.firstName) setFirstName(data.firstName);
            if (data.lastName) setLastName(data.lastName);
            setPhone(data.phone || "");
            
            if (data.preferences) {
              setPreferences(data.preferences);
            }
          }

          if (isArtisan) {
            const artisanDoc = await getDoc(doc(db, "artisans", user.uid));
            if (artisanDoc.exists()) {
              const data = artisanDoc.data();
              setCertificates(data.certificates || []);
            }
          }
        } catch (e) {
          console.error("Error fetching user data", e);
        }
      } else {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router, isArtisan]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!authUser) throw new Error("Not authenticated");
      
      const newDisplayName = `${firstName} ${lastName}`.trim();
      
      if (authUser.displayName !== newDisplayName) {
        await updateProfile(authUser, { displayName: newDisplayName });
      }

      let emailChanged = false;
      if (authUser.email !== email) {
        await updateEmail(authUser, email);
        emailChanged = true;
      }

      await updateDoc(doc(db, "users", authUser.uid), { 
        firstName,
        lastName,
        displayName: newDisplayName,
        phone,
      });
      
      if (emailChanged) {
        showAlert("Email updated successfully. Please sign in again for security.", "success");
        await auth.signOut();
        router.push("/");
        return;
      }

      showAlert("Profile settings saved successfully!", "success");
    } catch (err: any) {
      if (err.code === "auth/requires-recent-login") {
        showAlert("Changing your email requires recent authentication. Please sign out and sign in again.", "error");
      } else {
        showAlert(err.message || "Failed to save profile settings", "error");
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
      
      const storageRef = ref(storage, `profile_pictures/${user.uid}_${Date.now()}.jpg`);
      await uploadBytes(storageRef, compressed, { contentType: croppedFile.type });
      const publicUrl = await getDownloadURL(storageRef);

      const oldPhotoURL = user.photoURL;

      await updateProfile(user, { photoURL: publicUrl });
      await updateDoc(doc(db, "users", user.uid), { photoURL: publicUrl });
      
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

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadingCert(true);
    try {
      const user = auth.currentUser || authUser;
      if (!user) throw new Error("Not authenticated");

      const certRef = ref(storage, `certificates/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(certRef, file, { contentType: file.type });
      const publicUrl = await getDownloadURL(certRef);

      const newCerts = [...certificates, publicUrl];
      await updateDoc(doc(db, "artisans", user.uid), { certificates: newCerts });
      setCertificates(newCerts);
      showAlert("Certificate uploaded successfully!", "success");
    } catch (error) {
      console.error("Certificate upload failed:", error);
      showAlert("Failed to upload certificate.", "error");
    } finally {
      setUploadingCert(false);
      e.target.value = "";
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    
    setLoading(true);
    try {
      if (!authUser) return;
      
      await deleteDoc(doc(db, "users", authUser.uid));
      if (isArtisan) {
        await deleteDoc(doc(db, "artisans", authUser.uid));
      }
      
      await deleteUser(authUser);
      router.push("/");
    } catch (err: any) {
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
    <div className="max-w-xl mx-auto pt-16 px-6 pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <h1 className="text-[3rem] font-black text-black tracking-tighter uppercase leading-none mb-8 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">
        SETTINGS
      </h1>
      
      {/* Tabs */}
      <div className="flex w-full border-b-4 border-black mb-8 relative">
        <button 
          onClick={() => setActiveTab("profile")}
          className={`flex-1 py-4 font-black uppercase text-sm md:text-lg border-r-4 border-black transition-colors ${
            activeTab === "profile" ? "bg-[var(--color-brutal-yellow)] text-black" : "bg-white text-gray-400 hover:bg-gray-100"
          }`}
        >
          Profile
        </button>
        <button 
          onClick={() => setActiveTab("account")}
          className={`flex-1 py-4 font-black uppercase text-sm md:text-lg border-r-4 border-black transition-colors ${
            activeTab === "account" ? "bg-[var(--color-brutal-yellow)] text-black" : "bg-white text-gray-400 hover:bg-gray-100"
          }`}
        >
          Account
        </button>
        <button 
          onClick={() => setActiveTab("notifications")}
          className={`flex-1 py-4 font-black uppercase text-sm md:text-lg transition-colors ${
            activeTab === "notifications" ? "bg-[var(--color-brutal-yellow)] text-black" : "bg-white text-gray-400 hover:bg-gray-100"
          }`}
        >
          Alerts
        </button>
      </div>

      {activeTab === "profile" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Profile Picture Change Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="w-32 h-32 rounded-full border-4 border-black overflow-hidden bg-[var(--color-brutal-yellow)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {uploadingImage ? (
                  <div className="w-full h-full flex items-center justify-center bg-black/10">
                    <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <UserAvatar photoURL={photoURL} name={firstName || "User"} className="w-full h-full text-4xl text-black font-black" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-10 h-10 bg-[var(--color-brutal-pink)] border-4 border-black rounded-full flex justify-center items-center cursor-pointer hover:scale-110 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform">
                <Camera className="w-5 h-5 stroke-[3]" />
                <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              </label>
            </div>
            <p className="font-black uppercase text-sm text-gray-500">Tap icon to change</p>
          </div>

          <form onSubmit={handleSaveProfile}>
            <div className="bg-[var(--color-brutal-teal)] border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8">
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

            {isArtisan && (
              <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8">
                <h2 className="text-xl font-black uppercase text-black mb-4">Certificates</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {certificates.map((cert, idx) => (
                    <a key={idx} href={cert} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-gray-100 border-4 border-black hover:bg-[var(--color-brutal-yellow)] transition-colors">
                      <FileText className="w-6 h-6 stroke-[3]" />
                      <span className="font-bold text-sm truncate uppercase">Cert {idx + 1}</span>
                    </a>
                  ))}
                  {certificates.length === 0 && <p className="col-span-2 text-sm font-bold uppercase text-gray-500">No certificates uploaded.</p>}
                </div>
                <label className="w-full py-4 bg-[var(--color-brutal-blue)] border-4 border-black font-black uppercase text-white flex justify-center cursor-pointer hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
                  {uploadingCert ? "UPLOADING..." : "UPLOAD NEW CERTIFICATE"}
                  <input type="file" accept="application/pdf,image/*" onChange={handleCertUpload} className="hidden" disabled={uploadingCert} />
                </label>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-[var(--color-brutal-green)] border-4 border-black font-black uppercase text-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
            >
              {loading ? "SAVING..." : "SAVE PROFILE"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "account" && (
        <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-xl font-black uppercase text-black mb-4">Account Actions</h2>
          
          <button 
            type="button"
            className="w-full py-4 bg-[var(--color-brutal-yellow)] border-4 border-black font-black uppercase text-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
            onClick={() => showAlert("Password reset email sent (simulated).", "success")}
          >
            CHANGE PASSWORD
          </button>

          <SignOutButton className="w-full py-4 bg-gray-200 border-4 border-black font-black uppercase text-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
            SIGN OUT
          </SignOutButton>

          <button 
            type="button"
            onClick={handleDeleteAccount}
            disabled={loading}
            className={`w-full py-4 border-4 border-black font-black uppercase transition-all ${
              deleteConfirm 
                ? "bg-[var(--color-brutal-red)] text-white hover:bg-red-700 animate-pulse" 
                : "bg-white text-[var(--color-brutal-red)] hover:bg-[var(--color-brutal-red)] hover:text-white"
            } hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}
          >
            {deleteConfirm ? "CLICK AGAIN TO CONFIRM DELETE" : "DELETE ACCOUNT"}
          </button>
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

      {cropperSrc && (
        <ImageCropper
          imageSrc={cropperSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropperSrc(null)}
        />
      )}
    </div>
  );
}
