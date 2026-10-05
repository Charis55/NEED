"use client";

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Target, Star, Navigation, MapPin } from 'lucide-react';
import Link from 'next/link';
import { ArtisanProfile } from '@/types';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

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
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchLocation = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000
          });
          if (isMounted && pos?.coords) {
            setUserLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            });
          }
        } else if (typeof window !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (isMounted) {
                setUserLocation({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude
                });
              }
            },
            (err) => {
              console.warn("Could not retrieve user location for map:", err.message);
            },
            { enableHighAccuracy: true, timeout: 10000 }
          );
        }
      } catch (err: any) {
        console.warn("Location fetch error for map:", err?.message || err);
      }
    };

    fetchLocation();
    return () => { isMounted = false; };
  }, []);

  const createCustomIcon = (trade: string) => {
    return L.divIcon({
      html: `
        <div class="relative w-12 h-12 group cursor-pointer hover:-translate-y-1 transition-transform">
          <div class="w-12 h-12 bg-white border-4 border-black flex items-center justify-center z-20 overflow-hidden relative shadow-[4px_4px_0_0_#000]">
            <img src="/LOGO.png" alt="Need" class="w-8 h-8 object-contain" />
          </div>
        </div>
      `,
      className: 'bg-transparent border-none bg-none outline-none',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      popupAnchor: [0, -28]
    });
  };

  const createUserIcon = () => {
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center w-12 h-12">
          <!-- Pulsing background -->
          <div class="absolute inset-2 bg-[var(--color-brutal-blue)] rounded-full animate-ping opacity-60"></div>
          <!-- Core dot -->
          <div class="relative w-6 h-6 bg-[var(--color-brutal-blue)] border-4 border-black rounded-full shadow-[2px_2px_0_rgba(0,0,0,1)] z-10"></div>
        </div>
      `,
      className: 'bg-transparent border-none bg-none outline-none',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      popupAnchor: [0, -12]
    });
  };

  const defaultCenter: [number, number] = userLocation 
    ? [userLocation.lat, userLocation.lng]
    : technicians.length > 0 
    ? [technicians[0].lat, technicians[0].lng] 
    : [6.5244, 3.3792]; // Default to Lagos

  return (
    <div className="absolute inset-0 z-0">
      <MapContainer
        center={defaultCenter}
        zoom={30}
        zoomControl={false}
        scrollWheelZoom={true}
        style={{ height: '100%', minHeight: '500px', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Customer Location Marker */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={createUserIcon()}
          >
            <Popup className="custom-popup">
              <div className="p-3 bg-[var(--color-brutal-blue)] text-white border-4 border-black font-black uppercase text-center min-w-[150px]">
                <p className="text-sm flex items-center justify-center gap-1"><MapPin className="w-3 h-3" /> YOU ARE HERE</p>
                <p className="text-[10px] text-white/80 font-bold mt-1">Your current location</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Technician Markers */}
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
                <div className="p-0 min-w-[220px] font-sans">
                  <div className="bg-[var(--color-brutal-teal)] p-3 border-b-4 border-black flex items-center gap-3">
                    <img 
                      src={tech.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(tech.name || 'Tech')}&background=random&size=150`} 
                      alt={tech.name || tech.trade} 
                      className="w-12 h-12 object-cover border-2 border-black shrink-0 shadow-[2px_2px_0_0_#000]" 
                    />
                    <div>
                      <h3 className="font-black text-black text-base uppercase leading-tight">{tech.name || tech.trade}</h3>
                      <p className="font-bold text-xs uppercase">{tech.trade}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-white">
                    <p className="text-black font-bold text-sm mb-2 uppercase flex items-center gap-1"><MapPin className="w-4 h-4" /> {tech.neighborhood}</p>
                    <div className="flex items-center gap-1 text-black mb-4 text-sm font-black uppercase">
                      <Star className="w-4 h-4 fill-[var(--color-brutal-yellow)] stroke-black stroke-[2]" />
                      <span>{tech.ratingAverage.toFixed(1)} ({tech.ratingCount} reviews)</span>
                    </div>
                    
                    <Link 
                      href={`/artisan/${tech.artisanId}`}
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

      <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
        {userLocation && (
          <button
            className="w-12 h-12 bg-[var(--color-brutal-blue)] text-white brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all active:translate-x-0 active:translate-y-0 active:shadow-none"
            onClick={() => setSelectedPlace({ lat: userLocation.lat, lng: userLocation.lng })}
            title="My Location"
          >
            <Navigation size={24} className="stroke-[3] text-white" />
          </button>
        )}
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

