"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, SlidersHorizontal, MapPin, Star, BadgeCheck } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { ArtisanProfile } from "@/types";
import { useRouter } from "next/navigation";

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)}m away`;
  return `${(meters / 1000).toFixed(1)}km away`;
}

function SwipeCard({ 
  artisan, 
  removeCard, 
  onAccept,
  isFront 
}: { 
  artisan: ArtisanProfile & { distance?: number }, 
  removeCard: (id: string, swipe: "left" | "right") => void,
  onAccept: (id: string) => void,
  isFront: boolean 
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);

  const handleDragEnd = (event: any, info: any) => {
    const swipeThreshold = 100;
    if (info.offset.x > swipeThreshold) {
      removeCard(artisan.artisanId, "right");
      onAccept(artisan.artisanId);
    } else if (info.offset.x < -swipeThreshold) {
      removeCard(artisan.artisanId, "left");
    }
  };

  return (
    <motion.div
      className="absolute w-full h-[500px] bg-white brutal-border brutal-shadow flex flex-col overflow-hidden"
      style={{
        x: isFront ? x : 0,
        rotate: isFront ? rotate : 0,
        opacity: isFront ? opacity : 1,
        y: !isFront ? 20 : 0,
        scale: !isFront ? 0.95 : 1,
        zIndex: isFront ? 10 : 0
      }}
      drag={isFront ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={isFront ? { cursor: "grabbing" } : {}}
      animate={!isFront ? { y: 20, scale: 0.95 } : { y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-start gap-4 mb-6 border-b-4 border-black pb-4">
          <div className="w-20 h-20 bg-gray-100 flex-shrink-0 brutal-border brutal-shadow-sm">
            <img 
              src={artisan.portfolioPhotoUrls?.[0] || "https://i.pravatar.cc/150?u=" + artisan.artisanId} 
              alt={artisan.name} 
              className="w-full h-full object-cover grayscale contrast-125"
              draggable="false"
            />
          </div>
          <div>
            <h2 className="text-2xl font-black text-black uppercase tracking-tighter leading-tight mb-1">{artisan.name || "Pro Technician"}</h2>
            <p className="text-black font-bold text-sm mb-2 uppercase">{artisan.yearsOfExperience || "3-5 years"} exp</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 bg-[var(--color-brutal-yellow)] text-black border-2 border-black px-2 py-0.5 font-black text-xs shadow-[2px_2px_0_0_#000]">
                <Star className="w-3 h-3 fill-current" />
                <span>{artisan.ratingAverage > 0 ? artisan.ratingAverage.toFixed(1) : "NEW"}</span>
              </div>
              {artisan.isCertificateVerified && (
                <div className="inline-flex items-center gap-1 bg-[var(--color-brutal-teal)] text-black border-2 border-black px-2 py-0.5 font-black text-xs shadow-[2px_2px_0_0_#000]">
                  <BadgeCheck className="w-3 h-3 stroke-[3]" />
                  <span>CERTIFIED</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-black font-bold text-sm mb-4 bg-[var(--color-brutal-pink)] p-2 brutal-border -rotate-1">
          <MapPin className="w-4 h-4 stroke-[3]" />
          <span className="uppercase">{artisan.neighborhood} {artisan.distance !== undefined && `• ${formatDistance(artisan.distance)}`}</span>
        </div>

        <div className="bg-[var(--color-brutal-bg)] brutal-border p-4 mb-auto">
          <p className="text-black font-medium text-sm leading-snug">
            "{artisan.bio || "I am a dedicated professional providing high-quality services for my community."}"
          </p>
        </div>

        <div className="flex gap-4 mt-6 pt-4 border-t-4 border-black">
          <button 
            className="flex-1 bg-white brutal-btn text-lg py-3"
            onClick={() => removeCard(artisan.artisanId, "left")}
          >
            SKIP
          </button>
          <button 
            className="flex-[2] bg-[var(--color-brutal-teal)] brutal-btn text-lg py-3"
            onClick={() => {
              removeCard(artisan.artisanId, "right");
              onAccept(artisan.artisanId);
            }}
          >
            SELECT
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function SwipePage({ params }: { params: { categorySlug: string, subSlug: string } }) {
  const [artisans, setArtisans] = useState<ArtisanProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchArtisans = async () => {
      try {
        const q = query(collection(db, "artisans"), limit(20));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => doc.data() as ArtisanProfile);

        // Geolocation and Sorting
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              const mapped = data.map(a => ({
                ...a,
                distance: getDistance(latitude, longitude, a.lat || 0, a.lng || 0)
              }));
              mapped.sort((a, b) => a.distance - b.distance);
              setArtisans(mapped.slice(0, 10));
              setLoading(false);
            },
            (error) => {
              console.warn("Location declined or unavailable. Sorting by rating.", error);
              data.sort((a, b) => b.ratingAverage - a.ratingAverage);
              setArtisans(data.slice(0, 10) as any[]);
              setLoading(false);
            }
          );
        } else {
          data.sort((a, b) => b.ratingAverage - a.ratingAverage);
          setArtisans(data.slice(0, 10) as any[]);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch artisans", err);
        setLoading(false);
      }
    };
    fetchArtisans();
  }, []);

  const removeCard = (id: string, swipe: "left" | "right") => {
    setArtisans(prev => prev.filter(a => a.artisanId !== id));
  };

  const handleAccept = (artisanId: string) => {
    // Navigate to the Request Job page
    router.push(`/artisans/${artisanId}/request`);
  };

  const tags = ["#appliances", "#samsung", "#bosch", "#apple", "#vacuum", "#internet", "#TV", "#laptop"];

  return (
    <div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col font-sans overflow-hidden selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Top Header */}
      <div className="px-6 pt-12 pb-4">
        <div className="flex justify-between items-center mb-6">
          <Link href={`/services/${params.categorySlug}`} className="w-12 h-12 bg-white brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-x-0 active:translate-y-0 active:shadow-none">
            <ChevronLeft className="w-6 h-6 text-black stroke-[3]" />
          </Link>
          <button className="w-12 h-12 bg-[var(--color-brutal-yellow)] brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-x-0 active:translate-y-0 active:shadow-none">
            <SlidersHorizontal className="w-5 h-5 text-black stroke-[3]" />
          </button>
        </div>
        
        <h1 className="text-4xl font-black text-black mb-6 uppercase tracking-tighter leading-none max-w-[200px] border-l-8 border-black pl-4">
          CHOOSE A PRO
        </h1>
      </div>

      {/* Horizontal Scroll Tags */}
      <div className="px-6 mb-8 overflow-x-auto no-scrollbar whitespace-nowrap pb-4">
        <div className="flex gap-4">
          {tags.map((tag, i) => (
            <div 
              key={tag} 
              className={`px-4 py-2 brutal-border font-black uppercase text-sm brutal-shadow-sm ${
                i % 2 === 0 ? 'bg-[var(--color-brutal-pink)] text-black rotate-1' : 'bg-white text-black -rotate-1'
              }`}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>

      {/* Card Stack Area */}
      <div className="flex-1 relative px-6 max-w-md mx-auto w-full">
        <div className="relative w-full h-[500px]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white brutal-border brutal-shadow">
              <div className="animate-pulse flex flex-col items-center">
                <div className="text-4xl animate-bounce mb-4">🕵️</div>
                <p className="text-black font-black uppercase tracking-widest bg-[var(--color-brutal-yellow)] px-2 rotate-1 brutal-border">Searching...</p>
              </div>
            </div>
          ) : artisans.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white brutal-border brutal-shadow text-center p-8">
              <div>
                <p className="text-black font-black text-xl uppercase mb-6">No more pros found here.</p>
                <button 
                  onClick={() => router.back()}
                  className="bg-[var(--color-brutal-blue)] px-6 py-4 brutal-btn w-full"
                >
                  GO BACK
                </button>
              </div>
            </div>
          ) : (
            <AnimatePresence>
              {artisans.map((artisan, index) => {
                // Only render the top 2 cards for performance and visual stacking effect
                if (index > 1) return null;
                const isFront = index === 0;

                return (
                  <SwipeCard 
                    key={artisan.artisanId} 
                    artisan={artisan} 
                    removeCard={removeCard} 
                    onAccept={handleAccept}
                    isFront={isFront} 
                  />
                );
              }).reverse()}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
