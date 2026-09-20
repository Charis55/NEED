"use client";

import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { User } from "firebase/auth";
import { collection, getDocs, query } from "firebase/firestore";
import UserAvatar from "@/components/UserAvatar";
import GlobalSearch from "@/components/GlobalSearch";
import { servicesData } from "@/data/services";

const BRUTAL_CARD_STYLES = [
  { bg: "bg-[var(--color-brutal-blue)]", text: "text-black", border: "border-black" },
  { bg: "bg-white", text: "text-black", border: "border-black" },
  { bg: "bg-black", text: "text-white", border: "border-white" },
  { bg: "bg-[var(--color-brutal-yellow)]", text: "text-black", border: "border-black" },
  { bg: "bg-[var(--color-brutal-pink)]", text: "text-black", border: "border-black" },
  { bg: "bg-[var(--color-brutal-teal)]", text: "text-black", border: "border-black" },
];

const GENERATED_IMAGE_IDS = [
  "plumbing", "electrical-repairs-and-installation", "air-conditioning-and-refrigeration",
  "generator-repair-and-maintenance", "carpentry-and-woodwork", "masonry-tiling-and-building-finishing",
  "painting-and-decoration", "welding-and-metal-fabrication", "roofing",
  "glazing-and-window-or-door-fitting", "locksmith-services", "gas-technician-services",
  "home-appliance-repair", "security-and-smart-home-installation", 
  "cleaning-fumigation-and-pest-control", "gardening-and-landscaping"
];

type SortType = "A-Z" | "Z-A" | "Most Available" | "Most Specific Services";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [sortBy, setSortBy] = useState<SortType>("Most Available");

  useEffect(() => {
    const saved = localStorage.getItem("exploreSortBy");
    if (saved === "A-Z" || saved === "Z-A" || saved === "Most Available" || saved === "Most Specific Services") {
      setSortBy(saved as SortType);
    }
  }, []);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [artisanCounts, setArtisanCounts] = useState<Record<string, number>>({});

  const handleSortChange = (type: SortType) => {
    setSortBy(type);
    setIsSortOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("exploreSortBy", type);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const snapshot = await getDocs(collection(db, "artisans"));
        const counts: Record<string, number> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.services && Array.isArray(data.services)) {
            data.services.forEach((svc: any) => {
              if (svc.trade) {
                counts[svc.trade] = (counts[svc.trade] || 0) + 1;
              }
            });
          } else if (data.trade) {
            // Fallback for older profiles
            counts[data.trade] = (counts[data.trade] || 0) + 1;
          }
        });
        setArtisanCounts(counts);
      } catch (err) {
        console.error("Failed to fetch artisan counts:", err);
      }
    }
    fetchCounts();
  }, []);

  const formattedDate = user?.metadata?.creationTime 
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.') 
    : '09.11.2022';

  const sortedCategories = useMemo(() => {
    const categories = Object.values(servicesData);
    return categories.sort((a, b) => {
      if (sortBy === "A-Z") return a.title.localeCompare(b.title);
      if (sortBy === "Z-A") return b.title.localeCompare(a.title);
      if (sortBy === "Most Available") {
        const countA = artisanCounts[a.title] || 0;
        const countB = artisanCounts[b.title] || 0;
        return countB - countA;
      }
      if (sortBy === "Most Specific Services") {
        return b.subServices.length - a.subServices.length;
      }
      return 0;
    });
  }, [sortBy, artisanCounts]);

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pb-20 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Top Section */}
      <div className="bg-[var(--color-brutal-green)] border-b-8 border-black px-6 pt-12 pb-10 mb-8">
        <div className="flex justify-between items-center mb-8 relative z-[60]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-[var(--color-brutal-yellow)] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <UserAvatar photoURL={user?.photoURL} name={user?.displayName} className="w-full h-full text-2xl text-black font-black" />
            </div>
            <div>
              <h2 className="text-black font-black text-2xl tracking-tighter uppercase leading-none mb-1">{user?.displayName || "New User"}</h2>
              <p className="text-black font-black text-xs mt-0.5 border-black border-2 bg-white px-2 py-0.5 inline-block -rotate-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">{formattedDate}</p>
            </div>
          </div>
          
          <button 
            onClick={() => setIsSortOpen(!isSortOpen)}
            className="flex items-center justify-center w-12 h-12 border-4 border-black bg-[var(--color-brutal-pink)] p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-6 h-6 stroke-[3]" />
          </button>

          {isSortOpen && (
            <div className="absolute top-16 right-0 z-50 bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] w-48 flex flex-col p-2 animate-in fade-in slide-in-from-top-2">
              <p className="text-xs font-black uppercase text-gray-500 mb-2 px-2 border-b-2 border-gray-200 pb-1">Sort By</p>
              {(["A-Z", "Z-A", "Most Available", "Most Specific Services"] as SortType[]).map(type => (
                <button
                  key={type}
                  onClick={() => handleSortChange(type)}
                  className={`text-left px-2 py-2 font-black uppercase text-xs sm:text-sm border-2 transition-all ${sortBy === type ? "bg-[var(--color-brutal-yellow)] border-black" : "border-transparent hover:border-black hover:bg-gray-100"} break-words`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>

        <h1 className="text-[4rem] font-black text-black mb-10 tracking-tighter leading-[0.85] uppercase" style={{ textShadow: "4px 4px 0px #fff" }}>
          How can we<br />help you?
        </h1>

        <div className="relative mt-2">
          <GlobalSearch variant="brutalist" />
        </div>
      </div>

      {/* Categories Section */}
      <div className="px-6 mt-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-black uppercase">Services</h2>
          <span className="text-xs font-bold uppercase bg-[var(--color-brutal-pink)] px-2 py-1 border-2 border-black rotate-1">
            {sortBy === "Most Available" ? "By Availability" : sortBy === "Most Specific Services" ? "By Specificity" : sortBy}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 md:gap-6">
          {sortedCategories.map((category, index) => {
            const style = BRUTAL_CARD_STYLES[index % BRUTAL_CARD_STYLES.length];
            const hasImage = GENERATED_IMAGE_IDS.includes(category.id);
            
            return (
              <Link key={category.id} href={`/services/${category.id}`} className="block" prefetch={false}>
                <div 
                  className={`${hasImage ? 'text-white' : style.bg + ' ' + style.text} relative p-3 md:p-4 border-4 ${hasImage ? 'border-black' : style.border} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] min-h-[140px] md:h-40 flex flex-col justify-end hover:-translate-y-1 transition-transform overflow-hidden`}
                  style={hasImage ? { backgroundImage: `url(/categories/${category.id}.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                >
                  {hasImage && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 z-0"></div>
                  )}
                  <div className="relative z-10">
                    <h3 className={`text-[15px] md:text-lg leading-tight font-black mb-1.5 uppercase tracking-tighter ${hasImage ? 'text-white' : style.text} break-words`}>
                      {category.title}
                    </h3>
                    <p className={`${hasImage ? 'text-gray-300' : (style.text === 'text-white' ? 'text-gray-300' : 'text-black')} font-bold text-[10px] md:text-xs leading-tight border-t-2 ${hasImage ? 'border-white' : style.border} pt-1`}>
                      {category.subServices.length} specific services
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
