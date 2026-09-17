"use client";

import dynamic from 'next/dynamic';
import { ArtisanProfile } from '@/types';

const MapView = dynamic(
  () => import('@/components/TechnicianMap'),
  { 
    ssr: false, 
    loading: () => (
      <div className="w-full h-full bg-white brutal-border brutal-shadow flex flex-col items-center justify-center">
        <div className="text-4xl animate-bounce mb-4">🗺️</div>
        <p className="text-black font-black uppercase tracking-widest bg-[var(--color-brutal-yellow)] px-2 rotate-1 brutal-border">Loading Map...</p>
      </div>
    ) 
  }
);

export default function MapWrapper({ technicians }: { technicians: ArtisanProfile[] }) {
  return <MapView technicians={technicians} />;
}
