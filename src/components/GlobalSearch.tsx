"use client";

import { useState, useEffect, useRef } from "react";
import { Search, ArrowRight } from "lucide-react";
import Link from "next/link";
import { servicesData, SubService } from "@/data/services";

interface SearchResult extends SubService {
  categoryId: string;
  categoryTitle: string;
}

export default function GlobalSearch({ variant = "brutalist" }: { variant?: "brutalist" | "clean" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length > 1) {
      const q = query.toLowerCase();
      const matched: SearchResult[] = [];

      Object.values(servicesData).forEach(category => {
        category.subServices.forEach(sub => {
          if (sub.title.toLowerCase().includes(q) || sub.description.toLowerCase().includes(q)) {
            matched.push({
              ...sub,
              categoryId: category.id,
              categoryTitle: category.title
            });
          }
        });
      });

      setResults(matched);
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query]);

  return (
    <div ref={wrapperRef} className="relative z-50">
      <div className="relative">
        {variant === "brutalist" ? (
          <>
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SEARCH FOR A JOB (E.G. WASHING MACHINE)"
              className="w-full bg-white border-4 border-black px-6 py-4 pr-16 text-xl font-black uppercase text-black placeholder:text-gray-400 focus:outline-none focus:bg-[var(--color-brutal-bg)] transition-colors brutal-shadow-sm"
            />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-[var(--color-brutal-yellow)] border-l-4 border-black flex items-center justify-center pointer-events-none">
              <Search className="w-8 h-8 text-black stroke-[3]" />
            </div>
          </>
        ) : (
          <>
            <div className="absolute left-4 top-0 bottom-0 flex items-center justify-center pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Start search"
              className="w-full bg-white rounded-full px-12 py-3.5 text-lg font-medium text-black placeholder:text-gray-400 focus:outline-none shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-shadow focus:shadow-[0_4px_16px_rgba(0,0,0,0.1)]"
            />
          </>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className={`absolute top-full left-0 right-0 mt-2 bg-white overflow-y-auto z-50 ${variant === 'brutalist' ? 'border-4 border-black brutal-shadow-md max-h-80' : 'rounded-2xl shadow-xl max-h-80'}`}>
          {results.map((result, idx) => (
            <Link 
              key={`${result.categoryId}-${result.id}`}
              href={`/services/${result.categoryId}/${result.id}/swipe`}
              onClick={() => setIsOpen(false)}
              className={`block p-4 transition-colors ${variant === 'brutalist' ? `hover:bg-[var(--color-brutal-bg)] ${idx !== results.length - 1 ? 'border-b-2 border-black' : ''}` : `hover:bg-gray-50 ${idx !== results.length - 1 ? 'border-b border-gray-100' : ''}`}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className={`${variant === 'brutalist' ? 'text-xl font-black uppercase tracking-tighter' : 'text-lg font-semibold'} text-black`}>{result.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {variant === 'brutalist' ? (
                      <span className="text-xs font-black uppercase bg-[var(--color-brutal-teal)] px-2 border-2 border-black">
                        {result.categoryTitle}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-gray-500">
                        {result.categoryTitle}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className={`w-5 h-5 ${variant === 'brutalist' ? 'text-black' : 'text-gray-400'}`} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {isOpen && query.trim().length > 1 && results.length === 0 && (
        <div className={`absolute top-full left-0 right-0 mt-2 bg-white p-6 z-50 ${variant === 'brutalist' ? 'border-4 border-black brutal-shadow-md' : 'rounded-2xl shadow-xl'}`}>
          <p className={`${variant === 'brutalist' ? 'font-black uppercase text-lg' : 'font-medium'} text-black text-center`}>No jobs found for "{query}"</p>
        </div>
      )}
    </div>
  );
}
