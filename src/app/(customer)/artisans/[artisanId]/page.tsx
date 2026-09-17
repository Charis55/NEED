import { Metadata } from 'next';
import Link from 'next/link';
import { ArtisanProfile } from '@/types';
import { BadgeCheck } from 'lucide-react';
import BackButton from '@/components/BackButton';

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
    
    const extractArray = (arrField: any) => {
      if (!arrField?.arrayValue?.values) return [];
      return arrField.arrayValue.values.map((v: any) => v.stringValue);
    };

    return {
      artisanId: fields.artisanId.stringValue,
      userId: fields.userId.stringValue,
      trade: fields.trade.stringValue,
      bio: fields.bio.stringValue,
      neighborhood: fields.neighborhood.stringValue,
      geohash: fields.geohash.stringValue,
      lat: Number(fields.lat.doubleValue || fields.lat.integerValue),
      lng: Number(fields.lng.doubleValue || fields.lng.integerValue),
      portfolioPhotoUrls: extractArray(fields.portfolioPhotoUrls),
      isCertificateVerified: fields.isCertificateVerified?.booleanValue || false,
      verified: fields.verified.booleanValue,
      ratingAverage: Number(fields.ratingAverage.doubleValue || fields.ratingAverage.integerValue),
      ratingCount: Number(fields.ratingCount.integerValue),
      available: fields.available.booleanValue,
      createdAt: Number(fields.createdAt.integerValue),
    } as ArtisanProfile;
  } catch (err) {
    console.error("Error fetching artisan:", err);
    return null;
  }
}

export async function generateMetadata({ params }: { params: { artisanId: string } }): Promise<Metadata> {
  const artisan = await getArtisan(params.artisanId);
  if (!artisan) {
    return { title: 'Technician Not Found' };
  }
  
  return {
    title: `${artisan.trade} in ${artisan.neighborhood} | NEED`,
    description: artisan.bio.substring(0, 160),
    openGraph: {
      images: artisan.portfolioPhotoUrls.length > 0 ? [artisan.portfolioPhotoUrls[0]] : [],
    }
  };
}

export default async function ArtisanProfilePage({ params }: { params: { artisanId: string } }) {
  const artisan = await getArtisan(params.artisanId);

  if (!artisan) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Technician Not Found</h2>
        <Link href="/" className="text-blue-600 hover:underline">Return to Search</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-8">
      <div className="bg-white md:rounded-2xl shadow-sm border-b md:border border-gray-100 overflow-hidden mb-8">
        <div className="p-5 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="w-full">
              <div className="flex items-center gap-4 mb-4">
                <BackButton />
                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">{artisan.trade}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                {artisan.verified && (
                  <span className="bg-blue-50 text-blue-600 border border-blue-200 text-xs px-3 py-1 rounded-full font-bold whitespace-nowrap flex items-center gap-1 shadow-sm">
                    <BadgeCheck className="w-4 h-4" />
                    Verified ID
                  </span>
                )}
                {artisan.isCertificateVerified && (
                  <span className="bg-amber-50 text-amber-600 border border-amber-200 text-xs px-3 py-1 rounded-full font-bold whitespace-nowrap flex items-center gap-1 shadow-sm">
                    <BadgeCheck className="w-4 h-4" />
                    Certified Pro
                  </span>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-gray-600 mb-6 text-sm md:text-base">
                <span className="flex items-center gap-1">📍 {artisan.neighborhood}</span>
                <span className="flex items-center gap-1 text-amber-500 font-medium">
                  ★ {artisan.ratingAverage.toFixed(1)} <span className="text-gray-400">({artisan.ratingCount} reviews)</span>
                </span>
              </div>
              
              <div className="prose text-gray-700 max-w-none text-sm md:text-base">
                <h3 className="text-lg font-bold text-gray-900 mb-2">About</h3>
                <p className="whitespace-pre-wrap">{artisan.bio}</p>
              </div>
            </div>
            
            <div className="hidden md:block w-full md:w-64 flex-shrink-0">
              <Link 
                href={`/artisans/${artisan.artisanId}/request`}
                className="block w-full text-center bg-blue-600 text-white font-bold text-lg py-4 px-6 rounded-xl hover:bg-blue-700 transition shadow-md hover:shadow-lg"
              >
                Request This Technician
              </Link>
              <p className="text-center text-sm text-gray-500 mt-3">
                {artisan.available ? '🟢 Available for work' : '🔴 Currently busy'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-12 px-5 md:px-0">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Portfolio</h2>
        {artisan.portfolioPhotoUrls.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {artisan.portfolioPhotoUrls.map((url, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Portfolio item ${i+1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 italic text-sm md:text-base">No portfolio photos available.</p>
        )}
      </div>
      
      {/* Reviews Section Placeholder - Phase 8 */}
      <div className="px-5 md:px-0 mb-12 md:mb-0">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Reviews</h2>
        <div className="bg-gray-50 p-6 md:p-8 rounded-2xl text-center border border-dashed border-gray-300">
          <p className="text-gray-500 text-sm md:text-base">Reviews will appear here once jobs are completed.</p>
        </div>
      </div>

      {/* Sticky Bottom Action Bar for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
        <Link 
          href={`/artisans/${artisan.artisanId}/request`}
          className="block w-full text-center bg-blue-600 text-white font-bold text-lg py-4 px-6 rounded-xl hover:bg-blue-700 transition"
        >
          Request This Technician
        </Link>
      </div>
    </div>
  );
}
