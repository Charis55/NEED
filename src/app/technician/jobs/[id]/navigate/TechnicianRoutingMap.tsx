"use client";

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Navigation } from 'lucide-react';

function RoutingControl({ startCoords, destCoords }: { startCoords: {lat: number, lng: number}, destCoords: {lat: number, lng: number} }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Create a custom icon for the routing waypoints to be invisible or stylized
    const emptyIcon = L.divIcon({ className: 'hidden' });

    const routingControl = (L as any).Routing.control({
      waypoints: [
        L.latLng(startCoords.lat, startCoords.lng),
        L.latLng(destCoords.lat, destCoords.lng)
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false,
      lineOptions: {
        styles: [{ color: '#000000', opacity: 0.8, weight: 6 }]
      },
      createMarker: (i: number, wp: Record<string, unknown>, nWps: number) => {
        // We will render our own markers
        return null;
      },
      show: false // hide the default routing instructions panel
    }).addTo(map);

    return () => {
      map.removeControl(routingControl);
    };
  }, [map, startCoords, destCoords]);

  return null;
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
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    // Start watching position
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });

        // Update Firestore
        updateDoc(doc(db, "jobRequests", jobId), {
          technicianLocation: { lat: latitude, lng: longitude },
          lastLocationUpdate: Date.now()
        }).catch(err => console.error("Failed to sync location:", err));
      },
      (err) => {
        console.error(err);
        setError("Failed to get your location. Please enable GPS.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 5000
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [jobId]);

  const createTechIcon = () => {
    return L.divIcon({
      html: `
        <div class="relative w-12 h-12 flex items-center justify-center">
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

        {/* Routing Machine */}
        <RoutingControl startCoords={currentLocation} destCoords={destCoords} />

        {/* Technician Marker */}
        <Marker position={[currentLocation.lat, currentLocation.lng]} icon={createTechIcon()}>
          <Popup className="custom-popup">
            <div className="p-2 bg-[var(--color-brutal-teal)] text-black border-4 border-black font-black uppercase text-center w-24">
              <p>You</p>
            </div>
          </Popup>
        </Marker>

        {/* Destination Marker */}
        <Marker position={[destCoords.lat, destCoords.lng]} icon={createDestIcon()}>
          <Popup className="custom-popup">
            <div className="p-2 bg-[var(--color-brutal-yellow)] text-black border-4 border-black font-black uppercase text-center w-24">
              <p>Customer</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] pointer-events-none">
        <div className="bg-black text-white px-6 py-3 font-black uppercase tracking-widest text-sm flex items-center gap-2 brutal-shadow">
          <Navigation className="w-5 h-5 fill-white" /> Live Tracking Active
        </div>
      </div>
    </div>
  );
}
