"use client";

import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { auth } from "@/lib/firebase";
import { ShieldCheck, MapPin, Camera as CameraIcon, Bell, Mic, AlertTriangle } from "lucide-react";
import { useAlert } from "./AlertProvider";

export default function PermissionsManager() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlert();

  useEffect(() => {
    // We wait for auth state to ensure we only bother logged in users
    const unsub = auth.onAuthStateChanged((user) => {
      if (user && !localStorage.getItem("need_permissions_handled")) {
        // Adding a slight delay so it doesn't flash immediately over login transition
        setTimeout(() => setShow(true), 1500);
      } else {
        setShow(false);
      }
    });
    
    return () => unsub();
  }, []);

  const handleGrantAll = async () => {
    setLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        try { await Camera.requestPermissions(); } catch(e) {}
        try { await Geolocation.requestPermissions(); } catch(e) {}
      }
      
      // Request WebRTC Mic/Camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn("Media devices permission issue:", e);
      }
      
      // Request Notifications
      try {
        await Notification.requestPermission();
      } catch (e) {}

      localStorage.setItem("need_permissions_handled", "true");
      setShow(false);
      showAlert("Permissions granted! You're good to go.", "success");
      
      // Reload to ensure FCM and other services initialize with the new permissions
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err) {
      console.error(err);
      localStorage.setItem("need_permissions_handled", "true");
      setShow(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("need_permissions_handled", "true");
    setShow(false);
    showAlert("You can enable permissions later in your device settings.", "info");
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[var(--color-brutal-bg)] flex flex-col font-sans selection:bg-[var(--color-brutal-pink)] selection:text-black overflow-y-auto">
      <div className="flex-1 max-w-2xl mx-auto w-full p-6 md:p-12 flex flex-col justify-center min-h-screen">
        
        <div className="bg-white border-8 border-black p-8 brutal-shadow relative">
          
          <div className="absolute -top-10 -right-4 md:-right-8 bg-[var(--color-brutal-pink)] border-4 border-black p-4 brutal-shadow rotate-12">
            <ShieldCheck className="w-12 h-12 stroke-[3]" />
          </div>

          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-4 leading-none">
            WE NEED SOME PERMISSIONS
          </h1>
          
          <div className="h-2 w-full bg-black mb-8"></div>

          <p className="text-xl font-bold mb-8">
            To give you the true native experience on NEED, we require access to your device's hardware. We will only ask you this <span className="bg-[var(--color-brutal-yellow)] px-2">ONCE</span>.
          </p>

          <div className="space-y-4 mb-10">
            {/* Location */}
            <div className="flex items-start gap-4 border-4 border-black p-4 bg-[var(--color-brutal-green)]">
              <MapPin className="w-8 h-8 shrink-0 mt-1 stroke-[3]" />
              <div>
                <h3 className="font-black uppercase text-xl">Location</h3>
                <p className="font-bold text-sm">To find technicians or customers near you instantly.</p>
              </div>
            </div>

            {/* Camera */}
            <div className="flex items-start gap-4 border-4 border-black p-4 bg-[var(--color-brutal-blue)] text-white">
              <CameraIcon className="w-8 h-8 shrink-0 mt-1 stroke-[3]" />
              <div>
                <h3 className="font-black uppercase text-xl">Camera & Photos</h3>
                <p className="font-bold text-sm text-gray-100">To upload profile pictures, job photos, and receipts.</p>
              </div>
            </div>

            {/* Mic */}
            <div className="flex items-start gap-4 border-4 border-black p-4 bg-white">
              <Mic className="w-8 h-8 shrink-0 mt-1 stroke-[3]" />
              <div>
                <h3 className="font-black uppercase text-xl">Microphone</h3>
                <p className="font-bold text-sm">To send voice notes and conduct in-app live calls.</p>
              </div>
            </div>

            {/* Notifications */}
            <div className="flex items-start gap-4 border-4 border-black p-4 bg-[var(--color-brutal-yellow)]">
              <Bell className="w-8 h-8 shrink-0 mt-1 stroke-[3]" />
              <div>
                <h3 className="font-black uppercase text-xl">Notifications</h3>
                <p className="font-bold text-sm">To receive live updates about your jobs and messages.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={handleGrantAll}
              disabled={loading}
              className="flex-1 py-4 text-center bg-black border-4 border-black text-white font-black uppercase text-2xl hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#FF3366] transition-all disabled:opacity-50"
            >
              {loading ? "REQUESTING..." : "GRANT ALL"}
            </button>
            <button 
              onClick={handleSkip}
              className="px-6 py-4 text-center bg-white border-4 border-black font-black uppercase text-xl hover:bg-gray-200 transition-colors"
            >
              SKIP
            </button>
          </div>
          
          <div className="mt-6 flex items-center gap-2 justify-center text-sm font-bold opacity-70">
            <AlertTriangle className="w-4 h-4" />
            <p>You can always change these later in settings.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
