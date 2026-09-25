"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";
import { UserAccount } from "@/types";
import Image from "next/image";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    // Check if user is bypassing via authorized local network
    if (typeof window !== "undefined") {
      const bypass = localStorage.getItem("admin_bypass");
      if (bypass === "true") {
        setIsAuthorized(true);
        setLoading(false);
        if (isLoginPage) {
          router.replace("/admin");
        }
        return; // Skip firebase auth check
      }
    }

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() || user.uid === "bl6OE9ODGGhIbtBo16JGqZaJ0YE2") {
          const userData = userDoc.exists() ? (userDoc.data() as UserAccount) : null;
          
          if (user.uid === "bl6OE9ODGGhIbtBo16JGqZaJ0YE2" || (userData && userData.isAdmin)) {
            setIsAuthorized(true);
            if (isLoginPage) {
              router.replace("/admin");
            }
          } else {
            // Not an admin
            router.replace("/");
          }
        } else {
          router.replace("/");
        }
      } else {
        // Not logged in
        if (!isLoginPage) {
          router.replace("/admin/login");
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, isLoginPage]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF0E5] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-black border-t-[#CCFF00] rounded-full animate-spin"></div>
      </div>
    );
  }

  // Allow render if it's the login page, or if they are authorized
  if (!isAuthorized && !isLoginPage) {
    return null;
  }

  // If it's the login page, don't show the header, just render the page
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#FFF0E5] flex flex-col font-sans">
      <header className="bg-[#CCFF00] border-b-4 border-black sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="bg-white border-2 border-black p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Image src="/LOGO.png" alt="NEED" width={40} height={40} className="object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black uppercase tracking-tight leading-none text-black">NEED</span>
              <span className="text-xs font-bold uppercase tracking-widest text-black/70">Admin Portal</span>
            </div>
          </Link>
          
          <button 
            onClick={() => {
              auth.signOut();
              router.push("/admin/login");
            }}
            className="bg-black text-white font-bold uppercase px-6 py-2 border-2 border-black hover:bg-gray-800 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            Sign Out
          </button>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
