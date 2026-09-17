"use client";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function SignOutButton({ className, children = "Sign Out" }: { className?: string, children?: React.ReactNode }) {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/");
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
