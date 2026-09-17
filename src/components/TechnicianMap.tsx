"use client";

import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Target, Star } from 'lucide-react';
import Link from 'next/link';
import { ArtisanProfile } from '@/types';

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function TechnicianMap({ technicians }: { technicians: ArtisanProfile[] }) {
  const [selectedPlace, setSelectedPlace] = useState<{lat: number, lng: number} | null>(null);

  const createCustomIcon = (trade: string) => {
    let iconStr = '👨‍🔧';
    if (trade.toLowerCase().includes('plumb')) iconStr = '🪠';
    if (trade.toLowerCase().includes('electric')) iconStr = '⚡';
    if (trade.toLowerCase().includes('tailor')) iconStr = '✂️';
    if (trade.toLowerCase().includes('clean')) iconStr = '🧹';

    return L.divIcon({
      html: `<div class="flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-md border-2 border-emerald-400 text-xl">${iconStr}</div>`,
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  const defaultCenter: [number, number] = technicians.length > 0 
    ? [technicians[0].lat, technicians[0].lng] 
    : [6.5244, 3.3792]; // Default to Lagos

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {technicians.map(tech => (
          <Marker
            key={tech.artisanId}
            position={[tech.lat, tech.lng]}
            icon={createCustomIcon(tech.trade)}
            eventHandlers={{ click: () => setSelectedPlace({ lat: tech.lat, lng: tech.lng }) }}
          >
            <Popup className="custom-popup rounded-2xl">
              <div className="p-1 min-w-[200px]">
                <h3 className="font-bold text-gray-900 mb-1">{tech.trade}</h3>
                <p className="text-gray-500 text-xs mb-2">📍 {tech.neighborhood}</p>
                <div className="flex items-center gap-1 text-amber-500 mb-4 text-sm font-medium">
                  <Star className="w-4 h-4 fill-current" />
                  <span>{tech.ratingAverage.toFixed(1)} ({tech.ratingCount} reviews)</span>
                </div>
                
                <Link 
                  href={`/artisans/${tech.artisanId}`}
                  className="block w-full text-center bg-blue-600 text-white font-bold text-sm py-2.5 px-4 rounded-xl hover:bg-blue-700 transition"
                >
                  View Profile
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}

        {selectedPlace && <ChangeView center={[selectedPlace.lat, selectedPlace.lng]} zoom={15} />}
      </MapContainer>

      <div className="absolute top-4 right-4 z-[400]">
        <button
          className="p-3 bg-white rounded-full text-gray-700 hover:text-emerald-500 transition-colors shadow-lg border border-gray-100"
          onClick={() => setSelectedPlace(defaultCenter[0] ? { lat: defaultCenter[0], lng: defaultCenter[1] } : null)}
          title="Recenter Map"
        >
          <Target size={20} />
        </button>
      </div>
      
      <style>{`
        .leaflet-popup-content-wrapper {
          border-radius: 1rem;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        }
        .leaflet-popup-content {
          margin: 12px;
        }
      `}</style>
    </div>
  );
}
