export interface UserAccount {
  userId: string;
  phone: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  displayName: string;
  role: "customer" | "artisan";
  isAdmin?: boolean;
  createdAt: number;
  preferences?: {
    pushNotifications: boolean;
    inAppNotifications?: boolean;
    messagingNotifications: boolean;
    locationEnabled: boolean;
  };
  accountStatus?: "active" | "suspended" | "banned";
}

export interface ArtisanService {
  trade: string;
  subcategory: string;
  hasCertification: boolean;
  certificateUrl?: string | null;
  isCertificateVerified?: boolean;
}

// --- Verification Pipeline Types ---

export interface CertificateExtraction {
  applicantNameOnDocument: string;
  certificateNumber: string;
  issuingBody: string;
  issueDate: string | null;
  documentHash: string;
  tamperScore: number;
}

export interface PoliceClearanceExtraction {
  applicantNameOnDocument: string;
  identificationNumberOnDocument: string;
  possapReferenceNumber: string | null;
  issueDate: string | null;
  documentHash: string;
  tamperScore: number;
}

export interface VerificationDecisionLogEntry {
  action: "approved" | "rejected" | "flagged" | "expired" | "re_verified";
  adminId: string;
  adminEmail: string;
  timestamp: number;
  reason?: string;
}

export interface VerificationReviewItem {
  artisanId: string;
  artisanName: string;
  flaggedChecks: string[];
  extractedData: {
    certificate?: CertificateExtraction | null;
    policeClearance?: PoliceClearanceExtraction | null;
    identityVerifiedName?: string | null;
  };
  certificateUrl: string | null;
  policeClearanceUrl: string | null;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  reviewedAt: number | null;
  createdAt: number;
}

// --- End Verification Pipeline Types ---

export interface ArtisanProfile {
  artisanId: string;
  userId: string;
  name?: string;
  phone?: string;
  
  // deprecated single-service fields (kept for backward compatibility)
  trade: string;
  subcategory: string;
  
  services?: ArtisanService[];
  serviceKeys?: string[];
  
  bio: string;
  neighborhood: string;
  geohash: string;
  lat: number;
  lng: number;
  profilePictureUrl?: string;
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
  typicalResponseTime?: "Under 1 hour" | "1-3 hours" | "Same day" | "Next day";
  createdAt: number;

  // --- Verification Pipeline Fields ---
  identityVerificationStatus?: "not_started" | "pending" | "in_progress" | "pending_review" | "verified" | "failed" | "abandoned" | "expired" | "kyc_expired" | "resubmitted";
  identityVerificationProvider?: string | null;
  identityVerificationReference?: string | null;
  identityVerifiedName?: string | null;
  identityVerifiedDOB?: string | null;
  kycSessionId?: string | null;

  certificateVerificationStatus?: "pending" | "auto_verified" | "flagged" | "manually_verified" | "rejected";
  certificateExtractedData?: CertificateExtraction | null;

  policeClearanceStatus?: "pending" | "flagged" | "manually_verified" | "rejected" | "expired";
  policeClearanceExtractedData?: PoliceClearanceExtraction | null;
  policeClearanceExpiryDate?: number | null;

  manualReviewRequired?: boolean;
  manualReviewReasons?: string[];
  verificationDecisionLog?: VerificationDecisionLogEntry[];

  // Onboarding progress tracking (1–6, set after final submit)
  onboardingStep?: number;
}

export interface JobRequest {
  requestId: string;
  customerId: string;
  artisanId: string | null;
  isBroadcast?: boolean;
  trade: string;
  subcategory: string;
  services?: { trade: string; subcategory: string }[];
  description: string;
  neighborhood: string;
  unreadCount?: Record<string, number>;
  locationCoords?: {
    lat: number;
    lng: number;
  };
  preferredTime: string;
  offerAmount: number;
  counterOfferAmount: number | null;
  lastCounterBy?: "customer" | "artisan";
  declinedBy?: "customer" | "artisan";
  lastMessageText?: string;
  platformFee: number | null;
  cancellationFee?: number;
  cancelledBy?: "customer" | "artisan";
  cancelledReason?: string;
  cancelledAt?: string | number;
  rescheduledAt?: number;
  newPreferredTime?: string;
  rescheduleRequestedBy?: "customer" | "artisan";
  rescheduleStatus?: "pending" | "accepted" | "declined";
  status: "pending" | "accepted" | "declined" | "completed" | "cancelled" | "countered" | "payment_pending" | "en_route" | "in_progress";
  technicianLocation?: {
    lat: number;
    lng: number;
    updatedAt: number;
  };
  paymentMethod?: "cash" | "transfer";
  proofOfPaymentUrl?: string;
  proofOfPaymentAt?: number;
  paidToPlatform?: boolean;
  createdAt: number;
  completedAt: number | null;
  reviewed?: boolean;
  activeCall?: {
    channelName: string;
    callerId: string;
    type: "audio" | "video";
    status: "ringing" | "ongoing" | "ended";
    timestamp: number;
    connectedAt?: number;
  };
}

export interface Review {
  reviewId: string;
  requestId: string;
  artisanId: string;
  customerId: string;
  jobTitle: string;
  rating: number;
  comment: string;
  photos: string[];
  createdAt: number;
  artisanResponse?: string;
  respondedAt?: number;
}
