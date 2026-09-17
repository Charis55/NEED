import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ArtisanProfile } from '@/types';
import MapWrapper from './MapWrapper';

async function getTechnicians(): Promise<ArtisanProfile[]> {
  const projectId = 'momentum-b4215'; // Replace if using env vars
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artisans`;
  
  try {
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    
    const data = await res.json();
    if (!data.documents) return [];

    return data.documents.map((doc: any) => {
      const fields = doc.fields;
      return {
        artisanId: fields.artisanId?.stringValue,
        trade: fields.trade?.stringValue || 'Technician',
        neighborhood: fields.neighborhood?.stringValue || 'Unknown Location',
        lat: Number(fields.lat?.doubleValue || fields.lat?.integerValue || 6.5244),
        lng: Number(fields.lng?.doubleValue || fields.lng?.integerValue || 3.3792),
        ratingAverage: Number(fields.ratingAverage?.doubleValue || fields.ratingAverage?.integerValue || 0),
        ratingCount: Number(fields.ratingCount?.integerValue || 0),
        verified: fields.verified?.booleanValue || false,
      } as ArtisanProfile;
    });
  } catch (err) {
    console.error("Error fetching technicians for map:", err);
    return [];
  }
}

export const metadata: Metadata = {
  title: 'Technician Map | NEED',
};

export default async function MapPage() {
  const technicians = await getTechnicians();

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-140px)] min-h-[600px] flex flex-col px-6 bg-[var(--color-brutal-bg)] selection:bg-[var(--color-brutal-pink)] selection:text-black pt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-6">
          <Link 
            href="/explore" 
            className="w-14 h-14 bg-white brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition active:translate-x-0 active:translate-y-0 active:shadow-none"
          >
            <ArrowLeft className="w-6 h-6 text-black stroke-[3]" />
          </Link>
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-black leading-none uppercase tracking-tighter">RADAR</h1>
            <p className="text-black font-bold text-sm uppercase tracking-widest bg-[var(--color-brutal-yellow)] px-2 inline-block brutal-border mt-1 rotate-1">Find Pros Active Near You</p>
          </div>
        </div>
        
        <div className="bg-[var(--color-brutal-teal)] text-black px-6 py-3 font-black text-sm brutal-border brutal-shadow-sm uppercase tracking-widest -rotate-2">
          {technicians.length} AVAILABLE
        </div>
      </div>

      <div className="flex-1 bg-white brutal-border brutal-shadow p-2 overflow-hidden relative mb-6">
        <MapWrapper technicians={technicians} />
      </div>
    </div>
  );
}
