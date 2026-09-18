"use client";

import dynamic from 'next/dynamic';
import { ArtisanProfile } from '@/types';
import GlobalSpinner from '@/components/GlobalSpinner';

const MapView = dynamic(
  () => import('@/components/TechnicianMap'),
  { 
    ssr: false, 
    loading: () => (
      <div className="w-full h-full bg-white brutal-border brutal-shadow flex flex-col items-center justify-center">
        <GlobalSpinner text="LOADING MAP" />
      </div>
    ) 
  }
);

export default function MapWrapper({ technicians }: { technicians: ArtisanProfile[] }) {
  return <MapView technicians={technicians} />;
}
