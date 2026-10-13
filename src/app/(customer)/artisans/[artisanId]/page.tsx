import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArtisanProfile } from '@/types';
import { BadgeCheck, MapPin, Star, Zap, CheckCircle, XCircle } from 'lucide-react';
import BackButton from '@/components/BackButton';
import FavoriteButton from '@/components/FavoriteButton';
import PortfolioGallery from '@/components/PortfolioGallery';

// Fetch artisan data using Firestore REST API for Server-Side Rendering
async function getArtisan(artisanId: string): Promise<ArtisanProfile | null> {
  const projectId = 'momentum-b4215'; // from firebase config
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artisans/${artisanId}`;
  
  try {
    const res = await fetch(url, { next: { revalidate: 60 } }); // Cache for 60 seconds
    if (!res.ok) return null;
    
    const data = await res.json();
    
    // Firestore REST API returns data in a typed format, need to map it back
    // e.g., { fields: { trade: { stringValue: "Plumber" } } }
    const fields = data.fields;
    
    const extractArray = (arrField: { arrayValue?: { values?: { stringValue: string }[] } } | undefined) => {
      if (!arrField?.arrayValue?.values) return [];
      return arrField.arrayValue.values.map(v => v.stringValue);
    };

    return {
      artisanId: fields.artisanId?.stringValue,
      userId: fields.userId?.stringValue,
      name: fields.name?.stringValue || "Technician",
      trade: fields.trade?.stringValue,
      bio: fields.bio?.stringValue,
      neighborhood: fields.neighborhood?.stringValue,
      geohash: fields.geohash?.stringValue,
      lat: Number(fields.lat?.doubleValue || fields.lat?.integerValue || 0),
      lng: Number(fields.lng?.doubleValue || fields.lng?.integerValue || 0),
      profilePictureUrl: fields.profilePictureUrl?.stringValue || fields.photoURL?.stringValue || undefined,
      portfolioPhotoUrls: extractArray(fields.portfolioPhotoUrls),
      isCertificateVerified: fields.isCertificateVerified?.booleanValue || false,
      verified: fields.verified?.booleanValue || false,
      ratingAverage: Number(fields.ratingAverage?.doubleValue || fields.ratingAverage?.integerValue || 0),
      ratingCount: Number(fields.ratingCount?.integerValue || 0),
      available: fields.available?.booleanValue || false,
      createdAt: Number(fields.createdAt?.integerValue || 0),
    } as ArtisanProfile;
  } catch (err) {
    console.error("Error fetching artisan:", err);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ artisanId: string }> }): Promise<Metadata> {
  const unwrappedParams = await params;
  const artisan = await getArtisan(unwrappedParams.artisanId);
  
  if (!artisan) {
    return {
      title: 'Technician Not Found',
    };
  }
  
  return {
    title: `${artisan.name || 'Technician'} | NEED Technician`,
    description: artisan.bio || `Hire ${artisan.name || 'Technician'} on NEED.`,
  };
}

export default async function ArtisanProfilePage({ params }: { params: Promise<{ artisanId: string }> }) {
  const unwrappedParams = await params;
  redirect(`/artisan/${unwrappedParams.artisanId}`);
}
