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

export default function SubcategoryPage({ params }: { params: Promise<{ categorySlug: string }> }) {
  const unwrappedParams = use(params);
  const category = servicesData[unwrappedParams.categorySlug];
  const [artisanCounts, setArtisanCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  
  // Search and Sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"A-Z" | "Z-A" | "Availability">("A-Z");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
    
    if (sortBy === "Availability") {
      // Sort by count descending, then alphabetically if tied
      if (countB !== countA) return countB - countA;
      return a.title.localeCompare(b.title);
    } else if (sortBy === "A-Z") {
      return a.title.localeCompare(b.title);
    } else if (sortBy === "Z-A") {
      return b.title.localeCompare(a.title);
    }
    return 0;
  });

  return (
    <div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Top Header */}
      <div className="px-6 pt-12 pb-6 flex-shrink-0 bg-[var(--color-brutal-blue)] border-b-4 border-black brutal-shadow-sm transition-all">
        <div className="flex justify-between items-center mb-6">
          <BackButton href="/explore" className="bg-white text-black brutal-border brutal-shadow-sm hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-0 active:shadow-none transition-all w-10 h-10 flex items-center justify-center p-0" />
          <button 
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`w-12 h-12 brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-x-0 active:translate-y-0 active:shadow-none ${isSearchOpen ? 'bg-[var(--color-brutal-pink)]' : 'bg-white'}`}
          >
            <Search className="w-6 h-6 text-black stroke-[3]" />
          </button>
        </div>
        
        <h1 className="text-5xl font-black text-black mb-6 uppercase tracking-tighter">
          {title}
        </h1>
        
        {/* Search and Filter Controls */}
        <div className={`overflow-hidden transition-all duration-300 ${isSearchOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="flex flex-col gap-4 pb-4">
            <input 
              type="text" 
              placeholder="Search services..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-black font-bold p-4 brutal-border placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[var(--color-brutal-yellow)]"
            />
            <div className="flex items-center gap-4">
              <SlidersHorizontal className="w-6 h-6 text-black stroke-[3] shrink-0" />
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="flex-1 bg-white text-black font-bold p-4 brutal-border appearance-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-[var(--color-brutal-yellow)]"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}
              >
                <option value="A-Z">A-Z (Alphabetical)</option>
                <option value="Z-A">Z-A (Reverse)</option>
                <option value="Availability">Most Available First</option>
              </select>
            </div>
          </div>
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
