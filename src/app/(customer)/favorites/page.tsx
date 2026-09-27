"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, getDocs, doc, getDoc, deleteDoc, updateDoc, arrayRemove } from "firebase/firestore";
import Link from "next/link";
import GlobalSpinner from "@/components/GlobalSpinner";
import { ArtisanProfile } from "@/types";
import { Heart, Star, MapPin } from "lucide-react";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<ArtisanProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        let savedArtisans: string[] = [];
        if (userDoc.exists()) {
          const data = userDoc.data();
          savedArtisans = data.savedArtisans || [];
        }

        if (savedArtisans.length === 0) {
          setFavorites([]);
          return;
        }
        
        const artisanPromises = savedArtisans.map(async (artisanId) => {
          const artisanRef = doc(db, "artisans", artisanId);
          const artisanSnap = await getDoc(artisanRef);
          if (artisanSnap.exists()) {
            return artisanSnap.data() as ArtisanProfile;
          }
          return null;
        });

        const artisans = (await Promise.all(artisanPromises)).filter(Boolean) as ArtisanProfile[];
        setFavorites(artisans);
      } catch (error) {
        console.error("Error fetching favorites", error);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) fetchFavorites();
      else setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRemoveFavorite = async (artisanId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        savedArtisans: arrayRemove(artisanId)
      });
      setFavorites(prev => prev.filter(a => a.artisanId !== artisanId));
    } catch (error) {
      console.error("Error removing favorite", error);
    }
  };

  if (loading) return <GlobalSpinner text="LOADING FAVORITES..." />;

  return (
    <div className="w-full pt-16 px-6 md:px-12 pb-20 selection:bg-[var(--color-brutal-pink)] selection:text-black min-h-[80vh]">
      <h1 className="text-[3rem] font-black text-black tracking-tighter uppercase leading-none mb-8 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)] mt-4">
        SAVED ARTISANS
      </h1>

      {favorites.length === 0 ? (
        <div className="bg-white brutal-border p-12 text-center shadow-[8px_8px_0_0_#000]">
          <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">No saved artisans</h2>
          <p className="font-bold text-gray-500 mb-6 uppercase text-sm">Save your favorite technicians to book them again quickly.</p>
          <Link href="/explore" className="bg-[var(--color-brutal-teal)] text-black px-6 py-3 font-black uppercase brutal-border shadow-[4px_4px_0_0_#000] inline-block hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
            EXPLORE TECHNICIANS
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map(artisan => (
            <div key={artisan.artisanId} className="bg-white brutal-border overflow-hidden flex flex-col group shadow-[6px_6px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-1 hover:translate-y-1 transition-all">
              <div className="h-48 relative border-b-4 border-black bg-gray-200">
                <img 
                  src={artisan.portfolioPhotoUrls?.[0] || `https://i.pravatar.cc/150?u=${artisan.artisanId}`} 
                  alt={artisan.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <button 
                  onClick={() => handleRemoveFavorite(artisan.artisanId)}
                  className="absolute top-4 right-4 w-10 h-10 bg-white border-2 border-black flex items-center justify-center rounded-full hover:bg-[var(--color-brutal-pink)] transition-colors"
                >
                  <Heart className="w-5 h-5 fill-black stroke-black" />
                </button>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-black text-xl uppercase truncate pr-2">{artisan.name}</h3>
                  <div className="flex items-center gap-1 bg-[var(--color-brutal-yellow)] px-2 py-1 border-2 border-black font-black text-xs">
                    <Star className="w-3 h-3 fill-black" /> {artisan.ratingAverage.toFixed(1)}
                  </div>
                </div>
                <p className="font-bold text-gray-600 uppercase text-sm mb-4">{artisan.trade}</p>
                <div className="mt-auto">
                  <Link 
                    href={`/artisans/${artisan.artisanId}/request`}
                    className="w-full bg-[var(--color-brutal-teal)] py-3 border-2 border-black font-black uppercase block text-center hover:bg-black hover:text-white transition-colors"
                  >
                    BOOK TECHNICIAN
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
