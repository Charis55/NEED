"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { Heart } from "lucide-react";
import { useOptionalAuth } from "@/hooks/useOptionalAuth";
import { useRouter } from "next/navigation";

export default function FavoriteButton({ artisanId }: { artisanId: string }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, isGuest } = useOptionalAuth();
  const router = useRouter();

  useEffect(() => {
    if (isGuest || !user) {
      setLoading(false);
      return;
    }

    const checkFavorite = async () => {
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.savedArtisans && data.savedArtisans.includes(artisanId)) {
            setIsFavorite(true);
          }
        }
      } catch (err) {
        console.error("Failed to fetch favorites", err);
      } finally {
        setLoading(false);
      }
    };
    
    checkFavorite();
  }, [user, isGuest, artisanId]);

  const toggleFavorite = async () => {
    if (isGuest || !user) {
      router.push("/login");
      return;
    }

    const previousState = isFavorite;
    setIsFavorite(!isFavorite); // Optimistic UI update

    try {
      const userDocRef = doc(db, "users", user.uid);
      if (previousState) {
        await updateDoc(userDocRef, {
          savedArtisans: arrayRemove(artisanId)
        });
      } else {
        await updateDoc(userDocRef, {
          savedArtisans: arrayUnion(artisanId)
        });
      }
    } catch (err) {
      console.error("Failed to update favorite", err);
      setIsFavorite(previousState); // Revert on failure
    }
  };

  if (loading) return (
    <div className="w-12 h-12 brutal-border bg-gray-200 flex items-center justify-center animate-pulse"></div>
  );

  return (
    <button 
      onClick={toggleFavorite}
      className={`w-12 h-12 flex items-center justify-center brutal-border transition-all active:translate-x-0 active:translate-y-0 active:shadow-none hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] ${isFavorite ? "bg-[var(--color-brutal-pink)] text-black" : "bg-white text-black"}`}
      aria-label="Save to favorites"
    >
      <Heart className={`w-6 h-6 stroke-[3] ${isFavorite ? "fill-black" : "fill-transparent"}`} />
    </button>
  );
}
