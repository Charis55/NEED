"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import GlobalSpinner from "@/components/GlobalSpinner";

export default function RoleGuard({ children, requiredRole }: { children: React.ReactNode, requiredRole: "artisan" | "customer" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        if (requiredRole === "artisan") {
          router.push("/auth/login?role=artisan");
        } else {
          setAuthorized(true);
        }
        return;
      }
      
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const role = userDoc.data().role;
          
          if (requiredRole === "artisan") {
            if (role === "artisan") {
              const artisanDoc = await getDoc(doc(db, "artisans", user.uid));
              if (!artisanDoc.exists() || artisanDoc.data()?.onboardingStep !== 6) {
                router.push("/onboarding");
              } else {
                setAuthorized(true);
              }
            } else {
              router.push("/explore");
            }
          } else if (requiredRole === "customer") {
            if (role === "artisan" && pathname !== "/auth/login" && !pathname.startsWith("/chat/")) {
              // If an artisan tries to access customer routes (except shared chat), redirect them
              router.push("/technician/dashboard");
            } else {
              setAuthorized(true);
            }
          }
        } else {
          // If a Firebase user exists but NO userDoc exists,
          // they haven't completed the signup flow (missing name, phone, etc).
          // Force them back to the auth page to finish it.
          router.push(`/auth/login?role=${requiredRole}`);
        }
      } catch (err) {
        console.error("RoleGuard error:", err);
        setAuthorized(true);
      }
    });

    return () => unsubscribe();
  }, [router, requiredRole, pathname]);

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center">
        <GlobalSpinner text="VERIFYING ACCESS" />
      </div>
    );
  }

  return <>{children}</>;
}
