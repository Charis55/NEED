"use client";

import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Target, Star } from 'lucide-react';
import Link from 'next/link';
import { ArtisanProfile } from '@/types';

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function TechnicianMap({ 
  technicians, 
  onMarkerClick 
}: { 
  technicians: ArtisanProfile[],
  onMarkerClick?: (tech: ArtisanProfile) => void
}) {
  const [selectedPlace, setSelectedPlace] = useState<{lat: number, lng: number} | null>(null);

  const createCustomIcon = (trade: string) => {
    return L.divIcon({
      html: `
        <div class="relative w-12 h-16 group cursor-pointer hover:-translate-y-2 transition-transform drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
          <div class="absolute inset-x-0 top-0 h-12 bg-[var(--color-brutal-yellow)] border-4 border-black flex items-center justify-center z-20 overflow-hidden">
            <img src="/LOGO.png" alt="Need" class="w-full h-full object-contain scale-[1.5]" />
          </div>
          <!-- pin triangle base -->
          <div class="absolute top-[44px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[16px] border-l-transparent border-r-transparent border-t-black z-10"></div>
          <!-- pin triangle fill -->
          <div class="absolute top-[44px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-[var(--color-brutal-yellow)] z-20"></div>
        </div>
      `,
      className: 'bg-transparent border-none bg-none outline-none',
      iconSize: [48, 64],
      iconAnchor: [24, 60],
      popupAnchor: [0, -60]
    });
  };

  const defaultCenter: [number, number] = technicians.length > 0 
    ? [technicians[0].lat, technicians[0].lng] 
    : [6.5244, 3.3792]; // Default to Lagos

  return (
    <div className="absolute inset-0 z-0">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={true}
        style={{ height: '100%', minHeight: '500px', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {technicians.map(tech => (
          <Marker
            key={tech.artisanId}
            position={[tech.lat, tech.lng]}
            icon={createCustomIcon(tech.trade)}
            eventHandlers={{ click: () => {
              setSelectedPlace({ lat: tech.lat, lng: tech.lng });
              if (onMarkerClick) {
                onMarkerClick(tech);
              }
            } }}
          >
            {!onMarkerClick && (
              <Popup className="custom-popup">
                <div className="p-0 min-w-[200px] font-sans">
                  <div className="bg-[var(--color-brutal-teal)] p-2 border-b-4 border-black">
                    <h3 className="font-black text-black text-lg uppercase leading-tight">{tech.name || tech.trade}</h3>
                    <p className="font-bold text-xs uppercase">{tech.trade}</p>
                  </div>
                  <div className="p-3 bg-white">
                    <p className="text-black font-bold text-sm mb-2 uppercase">📍 {tech.neighborhood}</p>
                    <div className="flex items-center gap-1 text-black mb-4 text-sm font-black uppercase">
                      <Star className="w-4 h-4 fill-[var(--color-brutal-yellow)] stroke-black stroke-[2]" />
                      <span>{tech.ratingAverage.toFixed(1)} ({tech.ratingCount} reviews)</span>
                    </div>
                    
                    <Link 
                      href={`/artisans/${tech.artisanId}`}
                      className="block w-full text-center bg-black text-white font-black text-sm py-2 px-4 brutal-btn hover:-translate-y-1 transition-transform uppercase"
                    >
                      VIEW PROFILE
                    </Link>
                  </div>
                </div>
              </Popup>
            )}
          </Marker>
        ))}

        {selectedPlace && <ChangeView center={[selectedPlace.lat, selectedPlace.lng]} zoom={15} />}
      </MapContainer>

      <div className="absolute top-4 right-4 z-[400]">
        <button
          className="w-12 h-12 bg-white brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all active:translate-x-0 active:translate-y-0 active:shadow-none"
          onClick={() => setSelectedPlace(defaultCenter[0] ? { lat: defaultCenter[0], lng: defaultCenter[1] } : null)}
          title="Recenter Map"
        >
          <Target size={24} className="stroke-[3] text-black" />
        </button>
      </div>
      
      <style>{`
        .leaflet-popup-content-wrapper {
          border-radius: 0;
          box-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
          border: 4px solid #000;
          padding: 0;
          overflow: hidden;
        }
        .leaflet-popup-content {
          margin: 0;
        }
        .leaflet-popup-tip-container {
          display: none; /* Hide the default tip arrow */
        }
      `}</style>
    </div>
  );
}
