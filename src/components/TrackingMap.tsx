"use client";

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Target } from 'lucide-react';
import { ArtisanProfile, JobRequest } from '@/types';

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

function RecenterButton({ center }: { center: [number, number] }) {
  const map = useMap();
  return (
    <div className="absolute top-4 right-4 z-[400]">
      <button
        className="w-12 h-12 bg-white brutal-border brutal-shadow-sm flex items-center justify-center hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all active:translate-x-0 active:translate-y-0 active:shadow-none"
        onClick={(e) => {
          e.preventDefault();
          map.setView(center, 14);
        }}
        title="Recenter Map"
      >
        <Target size={24} className="stroke-[3] text-black" />
      </button>
    </div>
  );
}

export default function TrackingMap({ 
  technician, 
  job 
}: { 
  technician: ArtisanProfile,
  job: JobRequest
}) {
  // We use the technician's live location from the job if available, else static
  const techLocation = job.technicianLocation
    ? { lat: job.technicianLocation.lat, lng: job.technicianLocation.lng }
    : { lat: technician.lat, lng: technician.lng };

  const createTechIcon = () => {
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

  const createDestIcon = () => {
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

  // Default to technician location
  const center: [number, number] = [techLocation.lat, techLocation.lng];

  return (
    <div className="w-full h-full relative z-0 border-4 border-black shadow-[8px_8px_0_0_#000]">
      <MapContainer
        center={center}
        zoom={14}
        zoomControl={false}
        scrollWheelZoom={true}
        style={{ height: '100%', minHeight: '500px', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Technician Marker */}
        <Marker
          position={[techLocation.lat, techLocation.lng]}
          icon={createTechIcon()}
        >
          <Popup className="custom-popup">
            <div className="p-2 bg-[var(--color-brutal-teal)] text-black border-4 border-black font-black uppercase text-center w-32">
              <p>Technician</p>
              <p className="text-xs">En Route</p>
            </div>
          </Popup>
        </Marker>

        {/* Destination Marker (Mocked offset from technician for demo purposes) */}
        <Marker
          position={[techLocation.lat + 0.01, techLocation.lng + 0.01]}
          icon={createDestIcon()}
        >
          <Popup className="custom-popup">
            <div className="p-2 bg-[var(--color-brutal-yellow)] text-black border-4 border-black font-black uppercase text-center w-32">
              <p>Your Location</p>
            </div>
          </Popup>
        </Marker>

        <ChangeView center={center} zoom={14} />
        <RecenterButton center={center} />
      </MapContainer>

      <style>{`
        .leaflet-popup-content-wrapper {
          border-radius: 0;
          box-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
          border: 4px solid #000;
          padding: 0;
          overflow: hidden;
          background: transparent;
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
