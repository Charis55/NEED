"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, SlidersHorizontal, MapPin, Star } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { ArtisanProfile } from "@/types";
import { useRouter } from "next/navigation";

function SwipeCard({ 
  artisan, 
  removeCard, 
  onAccept,
  isFront 
}: { 
  artisan: ArtisanProfile, 
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
      className="absolute w-full h-[500px] bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col overflow-hidden"
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
        <div className="flex items-start gap-4 mb-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
            <img 
              src={artisan.portfolioPhotoUrls?.[0] || "https://i.pravatar.cc/150?u=" + artisan.artisanId} 
              alt={artisan.name} 
              className="w-full h-full object-cover"
              draggable="false"
            />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight mb-1">{artisan.name}</h2>
            <p className="text-gray-500 text-sm mb-2">{Math.floor(Math.random() * 10) + 2} years of experience</p>
            <div className="inline-flex items-center gap-1 bg-emerald-400 text-gray-900 px-2 py-0.5 rounded-lg text-xs font-bold">
              <Star className="w-3 h-3 fill-current" />
              <span>{artisan.ratingAverage > 0 ? artisan.ratingAverage.toFixed(1) : "New"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
          <MapPin className="w-4 h-4" />
          <span>Works with clients in {artisan.neighborhood}</span>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 mb-auto">
          <p className="text-gray-600 text-sm italic">
            "{artisan.bio || "I am a dedicated professional providing high-quality services for my community."}"
          </p>
        </div>

        <div className="flex gap-3 mt-6 pt-4">
          <button 
            className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-900 text-gray-900 font-bold text-sm text-center transition active:bg-gray-100"
            onClick={() => removeCard(artisan.artisanId, "left")}
          >
            Skip
          </button>
          <button 
            className="flex-[2] py-3 px-4 rounded-xl bg-gray-900 text-white font-bold text-sm text-center transition active:bg-gray-800"
            onClick={() => {
              removeCard(artisan.artisanId, "right");
              onAccept(artisan.artisanId);
            }}
          >
            Make an offer
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
        const q = query(collection(db, "artisans"), limit(10));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => doc.data() as ArtisanProfile);
        setArtisans(data);
      } catch (err) {
        console.error("Failed to fetch artisans", err);
      } finally {
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
    <div className="bg-[#f7f8f9] min-h-screen flex flex-col font-sans overflow-hidden">
      {/* Top Header */}
      <div className="px-6 pt-12 pb-4">
        <div className="flex justify-between items-center mb-6">
          <Link href={`/services/${params.categorySlug}`} className="w-10 h-10 flex items-center text-gray-900">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-900">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
        
        <h1 className="text-4xl font-bold text-gray-900 mb-6 leading-tight max-w-[200px]">
          Choose an Artisan
        </h1>
      </div>

      {/* Horizontal Scroll Tags */}
      <div className="px-6 mb-8 overflow-x-auto no-scrollbar whitespace-nowrap pb-2">
        <div className="flex gap-2">
          {tags.map((tag, i) => (
            <div 
              key={tag} 
              className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm ${
                i % 4 === 1 ? 'bg-yellow-300 text-gray-900' : 'bg-gray-900 text-white'
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
            <div className="absolute inset-0 flex items-center justify-center bg-white rounded-3xl shadow-sm border border-gray-100">
              <div className="animate-pulse flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 font-medium">Finding artisans near you...</p>
              </div>
            </div>
          ) : artisans.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white rounded-3xl shadow-sm border border-gray-100 text-center p-8">
              <div>
                <p className="text-gray-500 font-medium mb-4">No more artisans in this category.</p>
                <button 
                  onClick={() => router.back()}
                  className="bg-gray-900 text-white font-bold py-3 px-6 rounded-xl"
                >
                  Go Back
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
