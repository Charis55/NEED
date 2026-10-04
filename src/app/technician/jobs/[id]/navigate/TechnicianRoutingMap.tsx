"use client";

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Navigation } from 'lucide-react';
import { enableKeepAwake, disableKeepAwake } from '@/utils/keepAwake';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

// Helper function to calculate distance between two coordinates in meters
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function TechnicianRoutingMap({ 
  jobId, 
  destCoords 
}: { 
  jobId: string;
  destCoords: {lat: number, lng: number};
}) {
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    enableKeepAwake();

    let watchId: string | null = null;
    let isMounted = true;
    
    // State to throttle updates
    let lastUpdate = 0;
    let lastLat = 0;
    let lastLng = 0;
    let isSyncing = false;

    const startWatching = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const permStatus = await Geolocation.checkPermissions();
          if (permStatus.location !== 'granted') {
            const reqStatus = await Geolocation.requestPermissions();
            if (reqStatus.location !== 'granted') {
              setError("Location permission denied.");
              return;
            }
          }
        }

        if (!isMounted) return;

        watchId = await Geolocation.watchPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        }, (position, err) => {
          if (!isMounted) return;
          if (err) {
            console.error("WatchPosition error:", err);
            return;
          }
          if (!position) return;

          const now = Date.now();
          const { latitude, longitude } = position.coords;
          
          const dist = getDistanceInMeters(lastLat, lastLng, latitude, longitude);
          
          // Throttle state updates and Firestore writes to every 10 seconds OR > 15 meters moved
          // Also wait for previous sync to finish to prevent request queue buildup
          if ((now - lastUpdate > 10000 || dist > 15) && !isSyncing) {
            lastUpdate = now;
            lastLat = latitude;
            lastLng = longitude;
            
            setCurrentLocation({ lat: latitude, lng: longitude });

            isSyncing = true;
            updateDoc(doc(db, "jobRequests", jobId), {
              technicianLocation: { lat: latitude, lng: longitude },
              lastLocationUpdate: now
            }).catch(err => {
              console.error("Failed to sync location:", err);
            }).finally(() => {
              isSyncing = false;
            });
          }
        });
      } catch (err) {
        console.error("Start watching error:", err);
        if (isMounted) setError("Failed to start location tracking.");
      }
    };

    startWatching();

    return () => {
      isMounted = false;
      if (watchId !== null) {
        Geolocation.clearWatch({ id: watchId }).catch(console.error);
      }
      disableKeepAwake();
    };
  }, [jobId]);

  const createTechIcon = () => {
    return L.divIcon({
      html: `
        <div class="relative w-12 h-12 flex items-center justify-center">
          <div class="absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 z-20">
            <div class="relative bg-[var(--color-brutal-teal)] text-black font-black uppercase text-sm border-4 border-black px-3 py-1 shadow-[4px_4px_0_0_rgba(0,0,0,1)] whitespace-nowrap">
              YOU
              <div class="absolute w-3 h-3 bg-[var(--color-brutal-teal)] border-b-4 border-r-4 border-black transform rotate-45 -bottom-[7px] left-1/2 -translate-x-1/2"></div>
            </div>
          </div>
          <div class="absolute inset-2 bg-[var(--color-brutal-teal)] rounded-full animate-ping opacity-60"></div>
          <div class="relative w-8 h-8 bg-[var(--color-brutal-teal)] border-4 border-black rounded-full shadow-[2px_2px_0_rgba(0,0,0,1)] z-10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          </div>
        </div>
      `,
      className: 'bg-transparent border-none bg-none outline-none',
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });
  };

  const createDestIcon = () => {
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center w-12 h-12">
          <div class="absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 z-20">
            <div class="relative bg-[var(--color-brutal-yellow)] text-black font-black uppercase text-sm border-4 border-black px-3 py-1 shadow-[4px_4px_0_0_rgba(0,0,0,1)] whitespace-nowrap">
              CUSTOMER
              <div class="absolute w-3 h-3 bg-[var(--color-brutal-yellow)] border-b-4 border-r-4 border-black transform rotate-45 -bottom-[7px] left-1/2 -translate-x-1/2"></div>
            </div>
          </div>
          <div class="absolute inset-2 bg-[var(--color-brutal-yellow)] rounded-full animate-ping opacity-60"></div>
          <div class="relative w-6 h-6 bg-[var(--color-brutal-yellow)] border-4 border-black rounded-full shadow-[2px_2px_0_rgba(0,0,0,1)] z-10"></div>
        </div>
      `,
      className: 'bg-transparent border-none bg-none outline-none',
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });
  };

  if (error) {
    return <div className="p-4 text-center font-black uppercase text-[var(--color-brutal-red)]">{error}</div>;
  }

  if (!currentLocation) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-black border-t-[var(--color-brutal-teal)] rounded-full animate-spin"></div>
        <p className="mt-4 font-black uppercase text-xl text-black">Acquiring GPS Signal...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={[currentLocation.lat, currentLocation.lng]}
        zoom={15}
        zoomControl={false}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Direct path Polyline instead of heavy routing-machine */}
        <Polyline 
          positions={[
            [currentLocation.lat, currentLocation.lng], 
            [destCoords.lat, destCoords.lng]
          ]} 
          pathOptions={{ color: '#000000', weight: 6, opacity: 0.8, dashArray: '10, 10' }} 
        />

        {/* Technician Marker */}
        <Marker position={[currentLocation.lat, currentLocation.lng]} icon={createTechIcon()} />

        {/* Destination Marker */}
        <Marker position={[destCoords.lat, destCoords.lng]} icon={createDestIcon()} />
      </MapContainer>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] pointer-events-none">
        <div className="bg-black text-white px-6 py-3 font-black uppercase tracking-widest text-sm flex items-center gap-2 brutal-shadow">
          <Navigation className="w-5 h-5 fill-white" /> Live Tracking Active
        </div>
      </div>
    </div>
  );
}
