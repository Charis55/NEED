"use client";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/utils/platform";

export default function SignOutButton({ className, children = "Sign Out" }: { className?: string, children?: React.ReactNode }) {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("need_user_role");
        localStorage.removeItem("need_current_user_id");
      }
      await signOut(auth);
      if (isNativeApp()) {
        router.push("/login");
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <button onClick={handleSignOut} className={className}>
      {children}
    </button>
  );
}
