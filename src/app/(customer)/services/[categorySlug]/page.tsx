"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, ArrowRight, Clock } from "lucide-react";
import BackButton from "@/components/BackButton";
import { servicesData } from "@/data/services";
import { notFound } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function SubcategoryPage({ params }: { params: { categorySlug: string } }) {
  const category = servicesData[params.categorySlug];
  const [availableSubcategories, setAvailableSubcategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  if (!category) {
    notFound();
  }

  useEffect(() => {
    async function fetchAvailableSubcategories() {
      try {
        const q = query(
          collection(db, "artisans"),
          where("trade", "==", category.title)
        );
        const snapshot = await getDocs(q);
        const subcategories = new Set<string>();
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.subcategory) {
            subcategories.add(data.subcategory);
          }
        });
        
        setAvailableSubcategories(subcategories);
      } catch (error) {
        console.error("Error fetching available subcategories:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAvailableSubcategories();
  }, [category.title]);

  const title = category.title;
  const subServices = category.subServices;

  return (
    <div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Top Header */}
      <div className="px-6 pt-12 pb-8 flex-shrink-0 bg-[var(--color-brutal-blue)] border-b-4 border-black brutal-shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <BackButton className="bg-white text-black brutal-border brutal-shadow-sm hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-0 active:shadow-none transition-all w-10 h-10 flex items-center justify-center p-0" />
          <button className="w-12 h-12 bg-white brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-x-0 active:translate-y-0 active:shadow-none">
            <Search className="w-6 h-6 text-black stroke-[3]" />
          </button>
        </div>
        
        <h1 className="text-5xl font-black text-black mb-4 uppercase tracking-tighter">
          {title}
        </h1>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-[var(--color-brutal-bg)] px-6 pt-10 pb-20 overflow-y-auto">
        <div className="flex flex-col gap-6">
          {subServices.map((service) => {
            const isAvailable = availableSubcategories.has(service.title);
            
            return (
              <div 
                key={service.id} 
                className={`p-6 brutal-card flex flex-col relative transition-transform ${isAvailable ? 'bg-white hover:-translate-y-1' : 'bg-gray-200 opacity-80'}`}
              >
                <h2 className="text-3xl font-black text-black mb-2 uppercase tracking-tighter">{service.title}</h2>
                <p className="text-black font-bold text-sm leading-relaxed mb-8 border-l-4 border-black pl-3">
                  {service.description}
                </p>
                
                <div className="flex justify-end mt-auto">
                  {loading ? (
                    <div className="flex items-center gap-3 bg-gray-300 px-4 py-3 brutal-border border-black animate-pulse">
                      <span className="text-sm font-black text-black">CHECKING...</span>
                    </div>
                  ) : isAvailable ? (
                    <Link 
                      href={`/services/${params.categorySlug}/${service.id}/swipe`}
                      className="flex items-center gap-3 bg-[var(--color-brutal-yellow)] px-4 py-3 brutal-btn"
                    >
                      <span className="text-sm font-black text-black">FIND A TECHNICIAN</span>
                      <ArrowRight className="w-5 h-5 stroke-[3] text-black" />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 bg-gray-400 px-4 py-3 brutal-border border-black">
                      <span className="text-sm font-black text-black">COMING SOON</span>
                      <Clock className="w-5 h-5 stroke-[3] text-black" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
