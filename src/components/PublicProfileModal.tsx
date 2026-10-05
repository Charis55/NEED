"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import { ArtisanProfile } from "@/types";

interface PublicProfileModalProps {
  artisan: ArtisanProfile | any; // To allow extended fields like firstName
  onClose: () => void;
  onSelect?: (artisanId: string) => void;
  selectLabel?: string;
  isOpen: boolean;
}

export default function PublicProfileModal({ artisan, onClose, onSelect, selectLabel = "SELECT", isOpen }: PublicProfileModalProps) {
  return (
    <AnimatePresence>
      {isOpen && artisan && (
        <>
          {/* Backdrop for mobile */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[999] md:hidden"
            onClick={onClose}
          />
          
          <motion.div 
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            className="fixed md:absolute bottom-0 md:bottom-4 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[400px] bg-white border-t-4 md:border-4 border-black shadow-[0_-8px_0_0_rgba(0,0,0,1)] md:shadow-[8px_8px_0_0_rgba(0,0,0,1)] z-[1000] flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b-4 border-black flex gap-4 bg-[var(--color-brutal-teal)]">
              <div className="w-16 h-16 bg-white border-2 border-black flex-shrink-0">
                <img 
                  src={artisan.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(artisan.name || 'Artisan')}&background=random&size=150`} 
                  alt={artisan.name} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h2 className="text-xl font-black text-black uppercase tracking-tighter truncate leading-tight">
                  {(artisan.firstName && artisan.lastName) ? `${artisan.firstName} ${artisan.lastName}` : (artisan.name || "Technician")}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="inline-flex items-center gap-1 bg-white text-black border-2 border-black px-1.5 py-0.5 font-black text-[10px]">
                    <Star className="w-3 h-3 fill-[var(--color-brutal-yellow)]" />
                    <span>{artisan.ratingAverage > 0 ? artisan.ratingAverage.toFixed(1) : "NEW"}</span>
                  </div>
                  <span className="text-xs font-bold uppercase truncate">{artisan.neighborhood}</span>
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center justify-center">
                <FavoriteButton artisanId={artisan.artisanId} />
              </div>
            </div>
            
            <div className="flex bg-white">
              <button 
                className="flex-1 py-4 text-center font-black text-black uppercase border-r-4 border-black hover:bg-[var(--color-brutal-red)] hover:text-white transition-colors"
                onClick={onClose}
              >
                BACK
              </button>
              {onSelect && (
                <button 
                  className="flex-[2] py-4 text-center font-black text-black uppercase bg-[var(--color-brutal-yellow)] hover:bg-black hover:text-white transition-colors"
                  onClick={() => onSelect(artisan.artisanId)}
                >
                  {selectLabel}
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
