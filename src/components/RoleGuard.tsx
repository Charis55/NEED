"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import GlobalSpinner from "@/components/GlobalSpinner";

const verifiedRolesCache = new Map<string, "artisan" | "customer">();

export default function RoleGuard({ children, requiredRole }: { children: React.ReactNode, requiredRole: "artisan" | "customer" }) {
  const router = useRouter();
  const pathname = usePathname();

  // Instant authorization if role is already verified in this session or cached locally
  const [authorized, setAuthorized] = useState(() => {
    if (typeof window === "undefined") return false;
    const currentUid = auth.currentUser?.uid;
    const cachedRole = 
      localStorage.getItem("need_user_role") || 
      (currentUid ? (verifiedRolesCache.get(currentUid) || localStorage.getItem("need_role_" + currentUid) || sessionStorage.getItem("need_role_" + currentUid)) : null);
    if (cachedRole === requiredRole) return true;

    // Allow guest browsing on non-protected customer pages immediately
    if (requiredRole === "customer" && !currentUid && !localStorage.getItem("need_current_user_id")) {
      const isProtected = pathname.startsWith("/chat") || pathname.startsWith("/services") || pathname.startsWith("/profile") || pathname.startsWith("/payment");
      if (!isProtected) return true;
    }
    return false;
  });

  useEffect(() => {
    // If already authorized and user hasn't changed, avoid redundant blocking
    const currentUid = auth.currentUser?.uid;
    const cachedRole = (currentUid && verifiedRolesCache.get(currentUid)) || localStorage.getItem("need_user_role");
    if (cachedRole === requiredRole && authorized) {
      return;
    }

    let isMounted = true;
    // 2.5s safeguard timeout: Never leave user stuck on "VERIFYING ACCESS"
    const timeoutTimer = setTimeout(() => {
      if (isMounted && !authorized) {
        if (auth.currentUser) {
          setAuthorized(true);
        }
      }
    }, 2500);

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!isMounted) return;

      if (!user) {
        clearTimeout(timeoutTimer);
        if (requiredRole === "artisan") {
          router.push("/login?role=artisan");
        } else {
          // If a customer tries to access protected routes, force them to login
          if (pathname.startsWith("/chat") || pathname.startsWith("/services") || pathname.startsWith("/profile") || pathname.startsWith("/payment")) {
            router.push(`/login?role=customer&returnUrl=${encodeURIComponent(pathname)}`);
          } else {
            setAuthorized(true);
          }
        }
        return;
      }

      // Check cache first
      const cachedRole = verifiedRolesCache.get(user.uid) || sessionStorage.getItem("need_role_" + user.uid);
      if (cachedRole === requiredRole) {
        clearTimeout(timeoutTimer);
        setAuthorized(true);
        return;
      }
      
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!isMounted) return;
        clearTimeout(timeoutTimer);

        if (userDoc.exists()) {
          const role = userDoc.data().role as "artisan" | "customer";
          if (role) {
            verifiedRolesCache.set(user.uid, role);
            sessionStorage.setItem("need_role_" + user.uid, role);
            localStorage.setItem("need_role_" + user.uid, role);
            localStorage.setItem("need_user_role", role);
          }
          
          if (requiredRole === "artisan") {
            if (role === "artisan") {
              const artisanDoc = await getDoc(doc(db, "artisans", user.uid));
              if (!isMounted) return;
              if (!artisanDoc.exists() || artisanDoc.data()?.onboardingStep !== 6) {
                router.push("/onboarding");
              } else {
                setAuthorized(true);
              }
            } else {
              router.push("/explore");
            }
          } else if (requiredRole === "customer") {
            if (role === "artisan" && pathname !== "/login" && !pathname.startsWith("/chat/")) {
              router.push("/technician/dashboard");
            } else {
              setAuthorized(true);
            }
          }
        } else {
          router.push(`/login?role=${requiredRole}`);
        }
      } catch (err) {
        console.error("RoleGuard error:", err);
        clearTimeout(timeoutTimer);
        if (isMounted) setAuthorized(true);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutTimer);
      unsubscribe();
    };
  }, [router, requiredRole, pathname, authorized]);

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center">
        <GlobalSpinner text="VERIFYING ACCESS" />
      </div>
    );
  }

  return <>{children}</>;
}
