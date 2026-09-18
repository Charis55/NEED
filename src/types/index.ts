export interface UserAccount {
  userId: string;
  phone: string;
  displayName: string;
  role: "customer" | "artisan";
  isAdmin?: boolean;
  createdAt: number;
}

export interface ArtisanProfile {
  artisanId: string;
  userId: string;
  name?: string;
  trade: string;
  subcategory: string;
  bio: string;
  neighborhood: string;
  geohash: string;
  lat: number;
  lng: number;
  portfolioPhotoUrls: string[];
  yearsOfExperience: string;
  skillLevel: string;
  hasCertification: boolean;
  certificateUrl?: string | null;
  isCertificateVerified?: boolean;
  hasPoliceClearance: boolean;
  policeClearanceUrl?: string | null;
  verified: boolean;
  ratingAverage: number;
  ratingCount: number;
  available: boolean;
  createdAt: number;
}

export interface JobRequest {
  requestId: string;
  customerId: string;
  artisanId: string | null;
  trade: string;
  subcategory: string;
  description: string;
  neighborhood: string;
  preferredTime: string;
  offerAmount: number;
  counterOfferAmount: number | null;
  platformFee: number | null;
  status: "pending" | "accepted" | "declined" | "completed" | "cancelled" | "countered";
  createdAt: number;
  completedAt: number | null;
  reviewed?: boolean;
}

export interface Review {
  reviewId: string;
  requestId: string;
  artisanId: string;
  customerId: string;
  rating: number;
  comment: string;
  createdAt: number;
}
