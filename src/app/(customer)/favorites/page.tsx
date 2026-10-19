"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayRemove } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import GlobalSpinner from "@/components/GlobalSpinner";
import { ArtisanProfile } from "@/types";
import { Heart, Star, X, Eye } from "lucide-react";

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<ArtisanProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    let isCancelled = false;

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
          if (!isCancelled) {
            setFavorites([]);
            setLoading(false);
          }
          return;
        }
        
        const fetchSingleArtisan = async (artisanId: string): Promise<ArtisanProfile | null> => {
          try {
            // Fast direct doc lookup with 2.5s timeout
            const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
            
            const fetchPromise = (async () => {
              const artisanRef = doc(db, "artisans", artisanId);
              const artisanSnap = await getDoc(artisanRef);
              if (artisanSnap.exists()) {
                const data = artisanSnap.data();
                return { ...data, artisanId: data.artisanId || artisanSnap.id } as ArtisanProfile;
              }

              // Fallback query by field
              const { query, collection, where, limit, getDocs } = await import("firebase/firestore");
              const q = query(collection(db, "artisans"), where("artisanId", "==", artisanId), limit(1));
              const qSnap = await getDocs(q);
              if (!qSnap.empty) {
                const d = qSnap.docs[0];
                return { ...d.data(), artisanId: d.data().artisanId || d.id } as ArtisanProfile;
              }
              return null;
            })();

            return await Promise.race([fetchPromise, timeoutPromise]);
          } catch (e) {
            console.warn(`Failed to fetch favorite artisan ${artisanId}:`, e);
            return null;
          }
        };

        const artisanPromises = savedArtisans.map(artisanId => fetchSingleArtisan(artisanId));
        const results = await Promise.all(artisanPromises);
        const artisans = results.filter(Boolean) as ArtisanProfile[];
        
        if (!isCancelled) {
          setFavorites(artisans);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching favorites", error);
        if (!isCancelled) setLoading(false);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      if (currentUser) {
        fetchFavorites();
      } else {
        setLoading(false);
      }
    });

    // Safety timeout: never let favorites screen hang longer than 4 seconds
    const safetyTimer = setTimeout(() => {
      if (!isCancelled) setLoading(false);
    }, 4000);

    return () => {
      isCancelled = true;
      clearTimeout(safetyTimer);
      unsubscribe();
    };
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
    <AuthGate 
      title="Sign in to view favorites" 
      description="Create a free account to save and view favorite technicians."
    >
      <div className="w-full pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] px-6 md:px-12 pb-20 selection:bg-[var(--color-brutal-pink)] selection:text-black min-h-[80vh]">
        <h1 className="text-[3rem] font-black text-black tracking-tighter uppercase leading-none mb-8 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)] mt-4">
          SAVED TECHNICIANS
        </h1>

        {favorites.length === 0 ? (
          <div className="bg-white brutal-border p-12 text-center shadow-[8px_8px_0_0_#000]">
            <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">No saved technicians</h2>
            <p className="font-bold text-gray-500 mb-6 uppercase text-sm">Save your favorite technicians to book them again quickly.</p>
            <Link href="/explore" className="bg-[var(--color-brutal-teal)] text-black px-6 py-3 font-black uppercase brutal-border shadow-[4px_4px_0_0_#000] inline-block hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
              EXPLORE TECHNICIANS
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map(artisan => {
              const profileImg = artisan.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(artisan.name || 'Technician')}&background=random&size=400`;

              return (
                <div 
                  key={artisan.artisanId} 
                  className="bg-white brutal-border overflow-hidden flex flex-col group shadow-[6px_6px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-1 hover:translate-y-1 transition-all"
                >
                  {/* Photo area with click-to-preview full image */}
                  <div 
                    onClick={() => setPreviewImage({ url: profileImg, name: artisan.name || "Technician" })}
                    className="h-48 relative border-b-4 border-black bg-gray-200 cursor-pointer overflow-hidden group/img"
                    title="Click to preview full photo"
                  >
                    <img 
                      src={profileImg} 
                      alt={artisan.name}
                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
                    />
                    
                    {/* Hover preview indicator */}
                    <div className="absolute bottom-2 left-2 bg-black/85 text-white text-[10px] font-black uppercase px-2 py-1 border border-white opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-1 pointer-events-none">
                      <Eye className="w-3.5 h-3.5" /> Preview Photo
                    </div>

                    {/* Favorite heart button */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFavorite(artisan.artisanId);
                      }}
                      className="absolute top-4 right-4 w-10 h-10 bg-white border-2 border-black flex items-center justify-center rounded-full hover:bg-[var(--color-brutal-pink)] transition-colors z-10 shadow-[2px_2px_0_0_#000]"
                      title="Remove from favorites"
                    >
                      <Heart className="w-5 h-5 fill-black stroke-black" />
                    </button>
                  </div>

                  {/* White area & name: clicks through to technician's public profile */}
                  <div 
                    onClick={() => router.push(`/artisan/${artisan.artisanId}`)}
                    className="p-5 flex-1 flex flex-col cursor-pointer hover:bg-yellow-50/60 transition-colors"
                    title="Click to view technician's public profile"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-black text-xl uppercase truncate pr-2 hover:underline">
                        {artisan.name}
                      </h3>
                      <div className="flex items-center gap-1 bg-[var(--color-brutal-yellow)] px-2 py-1 border-2 border-black font-black text-xs shrink-0 shadow-[1px_1px_0_0_#000]">
                        <Star className="w-3 h-3 fill-black" /> {artisan.ratingAverage ? artisan.ratingAverage.toFixed(1) : "5.0"}
                      </div>
                    </div>
                    
                    <p className="font-bold text-gray-600 uppercase text-sm mb-4">
                      {artisan.trade}
                    </p>

                    {/* Book Technician Button */}
                    <div className="mt-auto" onClick={(e) => e.stopPropagation()}>
                      <Link 
                        href={`/artisans/${artisan.artisanId}/request`}
                        className="w-full bg-[var(--color-brutal-teal)] py-3 border-2 border-black font-black uppercase block text-center hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0_0_#000] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
                      >
                        BOOK TECHNICIAN
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FULL PROFILE PICTURE PREVIEW MODAL */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-2xl w-full bg-white border-4 border-black shadow-[12px_12px_0_0_#000] p-4 flex flex-col items-center animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Name and Close button */}
            <div className="w-full flex justify-between items-center pb-3 mb-3 border-b-4 border-black">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Profile Photo Preview
                </span>
                <h3 className="font-black text-xl uppercase tracking-tight text-black truncate max-w-[240px] sm:max-w-md">
                  {previewImage.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="w-10 h-10 bg-[var(--color-brutal-red)] text-white border-3 border-black flex items-center justify-center font-black hover:bg-black transition-colors shadow-[2px_2px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5"
                aria-label="Close preview"
              >
                <X className="w-6 h-6 stroke-[3]" />
              </button>
            </div>

            {/* Photo preview container */}
            <div className="w-full max-h-[70vh] border-4 border-black bg-black flex items-center justify-center overflow-hidden">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            </div>

            {/* Footer */}
            <div className="w-full pt-3 mt-3 border-t-2 border-black flex justify-between items-center text-xs font-bold text-gray-600">
              <span>Click outside to close</span>
              <button
                onClick={() => setPreviewImage(null)}
                className="bg-black text-white px-4 py-1.5 font-black uppercase text-xs border border-black hover:bg-white hover:text-black transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthGate>
  );
}
