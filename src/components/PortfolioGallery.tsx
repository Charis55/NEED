"use client";

import React, { useState, useRef } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function PortfolioGallery({ photos }: { photos: string[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const openGallery = (index: number) => setSelectedIndex(index);
  const closeGallery = () => setSelectedIndex(null);

  const goToNext = () => {
    if (selectedIndex !== null && selectedIndex < photos.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const goToPrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };



  if (!photos || photos.length === 0) {
    return (
      <div className="bg-white p-8 brutal-border text-center">
        <p className="font-black text-gray-400 uppercase">NO PORTFOLIO PHOTOS YET</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {photos.map((url, i) => (
          <div 
            key={i} 
            className="aspect-square bg-gray-200 brutal-border brutal-shadow-sm overflow-hidden hover:-translate-y-1 transition-transform cursor-pointer"
            onClick={() => openGallery(i)}
          >
            <img src={url} alt={`Portfolio item ${i+1}`} className="w-full h-full object-cover transition-all duration-300" />
          </div>
        ))}
      </div>

      {selectedIndex !== null && (
        <div 
          className="fixed inset-0 z-[200] bg-[rgba(0,0,0,0.9)] flex items-center justify-center p-4 selection:bg-[var(--color-brutal-pink)] selection:text-black"
          onClick={closeGallery}
        >
          <button 
            onClick={(e) => { e.stopPropagation(); goToPrev(); }}
            disabled={selectedIndex === 0 || photos.length <= 1}
            className={`absolute left-4 md:left-8 top-1/2 -translate-y-1/2 border-4 border-black p-2 md:p-4 transition-transform z-20 ${(selectedIndex === 0 || photos.length <= 1) ? 'bg-gray-400 opacity-50 cursor-not-allowed' : 'bg-[var(--color-brutal-yellow)] hover:scale-110 shadow-[4px_4px_0_0_#000]'}`}
          >
            <ChevronLeft className="w-6 h-6 md:w-10 md:h-10 stroke-[4] text-black" />
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            disabled={selectedIndex === photos.length - 1 || photos.length <= 1}
            className={`absolute right-4 md:right-8 top-1/2 -translate-y-1/2 border-4 border-black p-2 md:p-4 transition-transform z-20 ${(selectedIndex === photos.length - 1 || photos.length <= 1) ? 'bg-gray-400 opacity-50 cursor-not-allowed' : 'bg-[var(--color-brutal-yellow)] hover:scale-110 shadow-[4px_4px_0_0_#000]'}`}
          >
            <ChevronRight className="w-6 h-6 md:w-10 md:h-10 stroke-[4] text-black" />
          </button>

          <div 
            className="relative max-w-[75vw] max-h-[80vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={closeGallery}
              className="absolute -top-14 right-0 md:-right-10 bg-white border-4 border-black p-2 hover:scale-110 transition-transform shadow-[4px_4px_0_0_#000] z-30"
            >
              <X className="w-6 h-6 md:w-8 md:h-8 stroke-[4] text-black" />
            </button>

            <img 
              src={photos[selectedIndex]} 
              alt="Portfolio full view" 
              className="max-w-full max-h-[80vh] object-contain border-4 border-black shadow-[8px_8px_0_0_#000] bg-[var(--color-brutal-bg)] select-none pointer-events-none"
              draggable={false}
            />

            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 bg-white border-4 border-black px-6 py-2 font-black text-xl shadow-[4px_4px_0_0_#000]">
              {selectedIndex + 1} / {photos.length}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
