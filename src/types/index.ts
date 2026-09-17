export interface UserAccount {
  userId: string;
  phone: string;
  displayName: string;
  role: "customer" | "artisan";
  createdAt: number;
}

export interface ArtisanProfile {
  artisanId: string;
  userId: string;
  trade: string;
  bio: string;
  neighborhood: string;
  geohash: string;
  lat: number;
  lng: number;
  portfolioPhotoUrls: string[];
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
  description: string;
  neighborhood: string;
  preferredTime: string;
  status: "pending" | "accepted" | "declined" | "completed" | "cancelled";
  createdAt: number;
  completedAt: number | null;
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
