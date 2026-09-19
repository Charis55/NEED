"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, ArrowRight, Clock, SlidersHorizontal, Users } from "lucide-react";
import BackButton from "@/components/BackButton";
import { servicesData } from "@/data/services";
import { notFound } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { use } from "react";

type SortType = "A-Z" | "Z-A" | "Most Available" | "Most Specific Services";

export default function SubcategoryPage({ params }: { params: Promise<{ categorySlug: string }> }) {
  const unwrappedParams = use(params);
  const category = servicesData[unwrappedParams.categorySlug];
  const [artisanCounts, setArtisanCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  
  // Search and Sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortType>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("subCategorySortBy");
      if (saved === "A-Z" || saved === "Z-A" || saved === "Most Available") {
        return saved as SortType;
      }
    }
    return "A-Z";
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);

  if (!category) {
    notFound();
  }

  useEffect(() => {
    async function fetchAvailableSubcategories() {
      try {
        const q = query(
          collection(db, "artisans"),
          where("available", "==", true)
        );
        const snapshot = await getDocs(q);
        const counts: Record<string, number> = {};
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.services && Array.isArray(data.services)) {
            data.services.forEach((svc: any) => {
              if (svc.trade === category.title && svc.subcategory) {
                counts[svc.subcategory] = (counts[svc.subcategory] || 0) + 1;
              }
            });
          } else if (data.trade === category.title && data.subcategory) {
            counts[data.subcategory] = (counts[data.subcategory] || 0) + 1;
          }
        });
        
        setArtisanCounts(counts);
      } catch (error) {
        console.error("Error fetching available subcategories:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAvailableSubcategories();
  }, [category.title]);

  const title = category.title;
  let subServices = [...category.subServices];

  // Apply Search
  if (searchQuery.trim()) {
    subServices = subServices.filter(s => 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Apply Sort
  subServices.sort((a, b) => {
    const countA = artisanCounts[a.title] || 0;
    const countB = artisanCounts[b.title] || 0;
    
    if (sortBy === "Most Available") {
      if (countB !== countA) return countB - countA;
      return a.title.localeCompare(b.title);
    } else if (sortBy === "A-Z") {
      return a.title.localeCompare(b.title);
    } else if (sortBy === "Z-A") {
      return b.title.localeCompare(a.title);
    }
    return 0;
  });

  const handleSortChange = (type: SortType) => {
    setSortBy(type);
    setIsSortOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("subCategorySortBy", type);
    }
  };

  return (
    <div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Top Header */}
      <div className="px-6 pt-12 pb-6 flex-shrink-0 bg-[var(--color-brutal-blue)] border-b-4 border-black brutal-shadow-sm transition-all">
        <div className="flex justify-between items-center mb-6 relative">
          <BackButton href="/explore" className="bg-white text-black brutal-border brutal-shadow-sm hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-0 active:shadow-none transition-all w-10 h-10 flex items-center justify-center p-0" />
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { setIsSearchOpen(!isSearchOpen); setIsSortOpen(false); }}
              className={`w-12 h-12 brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-x-0 active:translate-y-0 active:shadow-none ${isSearchOpen ? 'bg-[var(--color-brutal-pink)]' : 'bg-white'}`}
            >
              <Search className="w-6 h-6 text-black stroke-[3]" />
            </button>
            
            <button 
              onClick={() => { setIsSortOpen(!isSortOpen); setIsSearchOpen(false); }}
              className="flex items-center justify-center w-12 h-12 border-4 border-black bg-[var(--color-brutal-pink)] p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-6 h-6 stroke-[3]" />
            </button>
          </div>

          {/* Sort Popup - Same style as Dashboard */}
          {isSortOpen && (
            <div className="absolute top-16 right-0 z-50 bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] w-48 flex flex-col p-2 animate-in fade-in slide-in-from-top-2">
              <p className="text-xs font-black uppercase text-gray-500 mb-2 px-2 border-b-2 border-gray-200 pb-1">Sort By</p>
              {(["A-Z", "Z-A", "Most Available"] as SortType[]).map(type => (
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
        
        <div className="flex justify-between items-start gap-4">
          <h1 className="text-5xl font-black text-black uppercase tracking-tighter break-words min-w-0 flex-1">
            {title}
          </h1>
          <span className="text-[10px] font-bold uppercase bg-[var(--color-brutal-pink)] px-2 py-1 border-2 border-black rotate-1 shrink-0 mt-2">
            {sortBy === "Most Available" ? "By Availability" : sortBy === "Most Specific Services" ? "By Specificity" : sortBy}
          </span>
        </div>
        
        {/* Search Controls */}
        <div className={`overflow-hidden transition-all duration-300 ${isSearchOpen ? 'max-h-24 opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
          <input 
            type="text" 
            placeholder="Search services..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white text-black font-bold p-4 brutal-border placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[var(--color-brutal-yellow)]"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-[var(--color-brutal-bg)] px-6 pt-10 pb-20 overflow-y-auto">
        <div className="flex flex-col gap-6">
          {subServices.length === 0 ? (
            <div className="text-center p-8 bg-white brutal-border brutal-shadow">
              <p className="font-black text-xl text-black">NO RESULTS FOUND</p>
              <p className="font-bold text-gray-500 mt-2">Try adjusting your search</p>
            </div>
          ) : (
            subServices.map((service) => {
              const count = artisanCounts[service.title] || 0;
              const isAvailable = count > 0;
              
              return (
                <div 
                  key={service.id} 
                  className={`p-6 brutal-card flex flex-col relative transition-transform ${isAvailable ? 'bg-white hover:-translate-y-1' : 'bg-gray-200 opacity-80'}`}
                >
                  <h2 className="text-3xl font-black text-black mb-2 uppercase tracking-tighter">{service.title}</h2>
                  <p className="text-black font-bold text-sm leading-relaxed mb-6 border-l-4 border-black pl-3">
                    {service.description}
                  </p>
                  
                  <div className="flex flex-col gap-4 mt-auto">
                    {/* Technician Count Pill */}
                    <div className="flex items-center gap-2">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 brutal-border border-black font-black text-xs uppercase shadow-[2px_2px_0_0_#000] ${isAvailable ? 'bg-[var(--color-brutal-teal)] text-black' : 'bg-gray-300 text-gray-700'}`}>
                        <Users className="w-4 h-4 stroke-[3]" />
                        <span>{loading ? "..." : count} PRO{count !== 1 ? 'S' : ''} READY</span>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      {loading ? (
                        <div className="flex items-center gap-3 bg-gray-300 px-4 py-3 brutal-border border-black animate-pulse">
                          <span className="text-sm font-black text-black">CHECKING...</span>
                        </div>
                      ) : isAvailable ? (
                        <Link 
                          href={`/services/${unwrappedParams.categorySlug}/${service.id}/swipe`}
                          className="flex items-center gap-3 bg-[var(--color-brutal-yellow)] px-4 py-3 brutal-btn w-full justify-center"
                        >
                          <span className="text-sm font-black text-black">FIND A PRO</span>
                          <ArrowRight className="w-5 h-5 stroke-[3] text-black" />
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 bg-gray-400 px-4 py-3 brutal-border border-black w-full justify-center">
                          <span className="text-sm font-black text-black">COMING SOON</span>
                          <Clock className="w-5 h-5 stroke-[3] text-black" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
