import { Metadata } from 'next';
import Link from 'next/link';
import { ArtisanProfile } from '@/types';
import { BadgeCheck, MapPin, Star, Zap, CheckCircle, XCircle } from 'lucide-react';
import BackButton from '@/components/BackButton';
import FavoriteButton from '@/components/FavoriteButton';

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
      title: 'Artisan Not Found',
    };
  }
  
  return {
    title: `${artisan.name || 'Technician'} | NEED Artisan`,
    description: artisan.bio || `Hire ${artisan.name || 'Technician'} on NEED.`,
  };
}

export default async function ArtisanProfilePage({ params }: { params: Promise<{ artisanId: string }> }) {
  const unwrappedParams = await params;
  const artisan = await getArtisan(unwrappedParams.artisanId);

  if (!artisan) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Technician Not Found</h2>
        <Link href="/" className="text-blue-600 hover:underline">Return to Search</Link>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[var(--color-brutal-bg)] pb-24 font-sans selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Header Bar */}
      <div className="px-6 pt-12 pb-6 flex items-center gap-4 bg-[var(--color-brutal-teal)] border-b-4 border-black brutal-shadow-sm sticky top-0 z-40">
        <BackButton className="bg-white text-black brutal-border brutal-shadow-sm hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-0 active:shadow-none transition-all w-10 h-10 flex items-center justify-center p-0 shrink-0" />
        <h1 className="text-2xl font-black text-black uppercase tracking-tighter leading-none truncate flex-1">
          {artisan.name || "Technician"}
        </h1>
        <FavoriteButton artisanId={artisan.artisanId} />
      </div>

      <div className="px-6 md:px-12 py-8 max-w-4xl mx-auto">
        <div className="bg-white brutal-card p-6 md:p-8 mb-8 relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--color-brutal-yellow)] rounded-full border-4 border-black z-0 opacity-50"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row gap-6 md:gap-10 items-start">
            <div className="w-24 h-24 md:w-32 md:h-32 bg-gray-200 border-4 border-black brutal-shadow-sm shrink-0 overflow-hidden">
              <img 
                src={artisan.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(artisan.name || 'Artisan')}&background=random&size=150`} 
                alt={artisan.name} 
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-xs font-black uppercase bg-[var(--color-brutal-blue)] px-2 py-1 border-2 border-black rotate-1">
                  {artisan.trade}
                </span>
                {artisan.verified && (
                  <span className="text-xs font-black uppercase bg-white px-2 py-1 border-2 border-black -rotate-1 flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3 stroke-[3]" /> Verified ID
                  </span>
                )}
                {artisan.isCertificateVerified && (
                  <span className="text-xs font-black uppercase bg-[var(--color-brutal-yellow)] px-2 py-1 border-2 border-black rotate-2 flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3 stroke-[3]" /> Certified Pro
                  </span>
                )}
              </div>
              
              <h2 className="text-4xl md:text-5xl font-black text-black uppercase tracking-tighter leading-none mb-4 break-words">
                {artisan.name}
              </h2>
              
              <div className="grid grid-cols-2 md:flex md:flex-row gap-3 mb-6">
                <div className="bg-[var(--color-brutal-bg)] p-2 brutal-border">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Location</p>
                  <p className="font-black text-sm uppercase truncate flex items-center gap-1"><MapPin className="w-4 h-4" /> {artisan.neighborhood}</p>
                </div>
                <div className="bg-[var(--color-brutal-bg)] p-2 brutal-border">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Rating</p>
                  <p className="font-black text-sm uppercase flex items-center gap-1"><Star className="w-4 h-4" /> {artisan.ratingAverage.toFixed(1)} <span className="text-xs text-gray-400">({artisan.ratingCount})</span></p>
                </div>
                <div className="bg-[var(--color-brutal-bg)] p-2 brutal-border col-span-2 md:col-span-1">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Responds In</p>
                  <p className="font-black text-sm uppercase text-black flex items-center gap-1"><Zap className="w-4 h-4" /> {artisan.typicalResponseTime || "1-3 hours"}</p>
                </div>
              </div>
              
              <div className="mb-6 border-l-4 border-black pl-4">
                <p className="text-black font-bold whitespace-pre-wrap">{artisan.bio}</p>
              </div>
            </div>
            
            <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-4">
              <Link 
                href={`/artisans/${artisan.artisanId}/request`}
                className="w-full text-center bg-black text-white font-black text-xl py-5 px-6 brutal-btn hover:-translate-y-1 hover:shadow-[4px_4px_0_0_rgba(106,13,173,1)] transition-all uppercase block"
              >
                BOOK NOW
              </Link>
              <div className={`p-3 text-center border-2 border-black font-black uppercase text-sm flex items-center justify-center gap-2 ${artisan.available ? 'bg-[#bbf7d0] text-black' : 'bg-[var(--color-brutal-red)] text-white'}`}>
                {artisan.available ? <><CheckCircle className="w-5 h-5" /> AVAILABLE</> : <><XCircle className="w-5 h-5" /> BUSY</>}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-black text-black uppercase tracking-tighter mb-6 border-b-4 border-black pb-2 inline-block">Portfolio</h2>
          {artisan.portfolioPhotoUrls && artisan.portfolioPhotoUrls.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {artisan.portfolioPhotoUrls.map((url, i) => (
                <div key={i} className="aspect-square bg-gray-200 brutal-border brutal-shadow-sm overflow-hidden hover:-translate-y-1 transition-transform">
                  <img src={url} alt={`Portfolio item ${i+1}`} className="w-full h-full object-cover transition-all duration-300" />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-8 brutal-border text-center">
              <p className="font-black text-gray-400 uppercase">NO PORTFOLIO PHOTOS YET</p>
            </div>
          )}
        </div>
        
        {/* Reviews Section Placeholder */}
        <div className="mb-12">
          <h2 className="text-2xl font-black text-black uppercase tracking-tighter mb-6 border-b-4 border-black pb-2 inline-block">Reviews</h2>
          <div className="bg-[var(--color-brutal-yellow)] p-8 brutal-border text-center">
            <p className="font-black text-black uppercase text-lg mb-2">No Reviews Yet</p>
            <p className="text-black font-bold text-sm">Be the first to hire and review {artisan.name || "this technician"}!</p>
          </div>
        </div>
      </div>
      
      {/* Sticky Bottom Action Bar for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-4 border-black p-4 z-50">
        <Link 
          href={`/artisans/${artisan.artisanId}/request`}
          className="w-full text-center bg-black text-white font-black text-lg py-4 px-6 brutal-btn block"
        >
          BOOK NOW
        </Link>
      </div>
    </div>
  );
}
