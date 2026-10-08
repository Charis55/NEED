"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ChevronLeft, SlidersHorizontal, MapPin, Star, BadgeCheck, X, Check } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import GlobalSpinner from "@/components/GlobalSpinner";
import { db } from "@/lib/firebase";
import PublicProfileModal from "@/components/PublicProfileModal";
import { collection, getDocs, query, limit, where, doc, getDoc } from "firebase/firestore";
import { ArtisanProfile } from "@/types";
import { useRouter } from "next/navigation";
import { servicesData } from "@/data/services";
import FavoriteButton from "@/components/FavoriteButton";
import { triggerHaptic } from '@/utils/haptics';
import { ImpactStyle } from '@capacitor/haptics';

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
  if (meters < 1000) return `${Math.round(meters)} meters away`;
  return `${(meters / 1000).toFixed(1)} kilometers away`;
}

function SwipeCard({ 
  artisan, 
  removeCard, 
  onAccept,
  onImageClick,
  isFront 
}: { 
  artisan: ArtisanProfile & { distance?: number }, 
  removeCard: (id: string, swipe: "left" | "right") => void,
  onAccept: (id: string) => void,
  onImageClick: (url: string) => void,
  isFront: boolean 
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 100;
    if (info.offset.x > swipeThreshold) {
      triggerHaptic(ImpactStyle.Heavy);
      removeCard(artisan.artisanId, "right");
      onAccept(artisan.artisanId);
    } else if (info.offset.x < -swipeThreshold) {
      triggerHaptic(ImpactStyle.Light);
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
        <div 
          className="flex-1 flex flex-col cursor-pointer" 
          onClick={() => {
            // Prevent navigating if they are just interacting with the buttons
            const router = require('next/navigation').useRouter; // Hook cannot be called here, need to pass router or use window
            window.location.href = `/artisans/${artisan.artisanId}`;
          }}
        >
          <div className="flex items-start gap-4 mb-6 border-b-4 border-black pb-4">
            <div 
              className="w-20 h-20 bg-gray-100 flex-shrink-0 brutal-border brutal-shadow-sm hover:scale-105 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                onImageClick(artisan.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(artisan.name || 'Artisan')}&background=random&size=1024`);
              }}
            >
              <img 
                src={artisan.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(artisan.name || 'Artisan')}&background=random&size=150`} 
                alt={artisan.name} 
                className="w-full h-full object-cover"
                draggable="false"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black text-black uppercase tracking-tighter leading-tight mb-1">{(((artisan as ArtisanProfile & { firstName?: string, lastName?: string }).firstName && (artisan as ArtisanProfile & { firstName?: string, lastName?: string }).lastName) ? `${(artisan as ArtisanProfile & { firstName?: string, lastName?: string }).firstName} ${(artisan as ArtisanProfile & { firstName?: string, lastName?: string }).lastName}` : (artisan.name || "Technician"))}</h2>
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
            <div onClick={(e) => e.stopPropagation()}>
              <FavoriteButton artisanId={artisan.artisanId} />
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
        </div>

        <div className="flex gap-4 mt-6 pt-4 border-t-4 border-black">
          <button 
            className="flex-1 bg-white brutal-btn text-lg py-3"
            onClick={() => {
              triggerHaptic(ImpactStyle.Light);
              removeCard(artisan.artisanId, "right");
            }}
          >
            SKIP
          </button>
          <button 
            className="flex-[2] bg-[var(--color-brutal-teal)] brutal-btn text-lg py-3"
            onClick={() => {
              triggerHaptic(ImpactStyle.Heavy);
              removeCard(artisan.artisanId, "left");
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

import dynamic from "next/dynamic";

const TechnicianMap = dynamic(
  () => import("@/components/TechnicianMap"),
  { 
    ssr: false, 
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-brutal-bg)] border-4 border-black brutal-shadow">
        <GlobalSpinner text="LOADING MAP" />
      </div>
    ) 
  }
);

export default function MultiServiceSwipePage({ 
  params,
  searchParams
}: { 
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<{ services: string }>;
}) {
  const unwrappedParams = use(params);
  const unwrappedSearchParams = use(searchParams);
  const [artisans, setArtisans] = useState<(ArtisanProfile & { distance?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArtisan, setSelectedArtisan] = useState<ArtisanProfile | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchArtisans = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "artisans"),
          where("available", "==", true),
          where("verified", "==", true)
        );
        const snap = await getDocs(q);
        const allData = snap.docs.map(doc => doc.data() as ArtisanProfile);

        const decodedCategory = decodeURIComponent(unwrappedParams.categorySlug).replace(/-/g, ' ');
        const selectedServices = unwrappedSearchParams.services 
          ? unwrappedSearchParams.services.split(',').map(s => decodeURIComponent(s).replace(/-/g, ' ').toLowerCase())
          : [];

        const data = allData.filter(artisan => {
          // Do not show artisans who haven't completed setup
          if (artisan.onboardingStep !== undefined && artisan.onboardingStep < 6) return false;

          if (artisan.services && artisan.services.length > 0) {
            return artisan.services.some(svc => 
              svc.trade.toLowerCase() === decodedCategory.toLowerCase() && 
              (selectedServices.length === 0 || selectedServices.includes(svc.subcategory.toLowerCase()))
            );
          }
          return artisan.trade?.toLowerCase() === decodedCategory.toLowerCase() && 
                 artisan.subcategory && 
                 (selectedServices.length === 0 || selectedServices.includes(artisan.subcategory.toLowerCase()));
        });

        const populateNames = async (list: (ArtisanProfile & { distance?: number; firstName?: string; lastName?: string })[]) => {
          for (let i = 0; i < list.length; i++) {
            if (!list[i].name && !list[i].firstName) {
              try {
                const userDoc = await getDoc(doc(db, "users", list[i].artisanId || list[i].userId));
                if (userDoc.exists()) {
                  const ud = userDoc.data();
                  list[i].firstName = ud.firstName;
                  list[i].lastName = ud.lastName;
                  list[i].name = ud.firstName ? `${ud.firstName} ${ud.lastName}`.trim() : ud.displayName;
                }
              } catch (e) {}
            }
          }
          return list;
        };

        const result = await populateNames(data);
        setArtisans(result as any[]);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch artisans", err);
        setLoading(false);
      }
    };
    fetchArtisans();
  }, [unwrappedParams.categorySlug, unwrappedSearchParams.services]);

  const handleAccept = (artisanId: string) => {
    router.push(`/artisans/${artisanId}/request?trade=${unwrappedParams.categorySlug}&services=${unwrappedSearchParams.services}`);
  };

  return (
    <div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col font-sans overflow-hidden selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Top Header */}
      <div className="px-6 pt-12 pb-4 shrink-0 z-10 bg-[var(--color-brutal-bg)]">
        <div className="flex justify-between items-center mb-4">
          <Link href={`/services/${unwrappedParams.categorySlug}`} className="w-12 h-12 bg-white brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-x-0 active:translate-y-0 active:shadow-none">
            <ChevronLeft className="w-6 h-6 text-black stroke-[3]" />
          </Link>
        </div>
        
        <h1 className="text-3xl font-black text-black uppercase tracking-tighter leading-none max-w-sm border-l-8 border-black pl-4">
          FIND A TECHNICIAN
        </h1>
        <p className="font-bold text-sm bg-[var(--color-brutal-yellow)] px-2 py-1 brutal-border inline-block mt-3 -rotate-1">
          TAP MARKER TO SELECT TECHNICIAN
        </p>
      </div>

      {/* Map Area */}
      <div className="flex-1 flex flex-col relative w-full px-6 md:px-12 pb-6">
        <div className="relative w-full flex-1 min-h-[500px] border-4 border-black brutal-shadow overflow-hidden bg-white">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <GlobalSpinner text="LOADING MAP" />
            </div>
          ) : artisans.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10">
              <p className="text-black font-black text-xl uppercase mb-6">No technicians active in this area.</p>
              <button 
                onClick={() => router.push(`/services/${unwrappedParams.categorySlug}/broadcast-multi?services=${unwrappedSearchParams.services}`)}
                className="bg-[var(--color-brutal-pink)] px-4 py-4 brutal-btn w-full max-w-xs md:max-w-md text-xs md:text-sm font-black whitespace-normal break-words"
              >
                POST TO GLOBAL JOB BOARD
              </button>
            </div>
          ) : (
            <TechnicianMap 
              technicians={artisans} 
              onMarkerClick={(tech) => setSelectedArtisan(tech)}
            />
          )}

          {/* Overlay Card */}
          <PublicProfileModal 
            artisan={selectedArtisan}
            isOpen={!!selectedArtisan}
            onClose={() => setSelectedArtisan(null)}
            onSelect={(id) => handleAccept(id)}
            selectLabel="SELECT"
          />
        </div>
      </div>
    </div>
  );
}
