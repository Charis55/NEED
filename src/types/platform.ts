export type Kobo = number;

export type JobState =
  | "requested"
  | "negotiating"
  | "awaiting_deposit"
  | "confirmed"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "awaiting_customer_confirmation"
  | "completed"
  | "cancelled"
  | "cancelled_after_arrival_review"
  | "disputed";

export type PaymentMode = "in_app_full" | "deposit_plus_cash" | "cash_only_wallet";

export interface JobRequestData {
  requestId: string;
  customerId: string;
  artisanId: string;
  trade: string;
  subcategory: string;
  description: string;
  neighborhood: string;
  approxLat: number;      
  approxLng: number;
  scheduledFor: number | null;
  state: JobState;
  stateUpdatedAt: number;

  agreedPrice: Kobo | null;
  finalPrice: Kobo | null;          
  paymentMode: PaymentMode | null;
  depositRequired: Kobo | null;
  depositPaid: Kobo;
  depositStatus: "none" | "pending" | "held" | "released" | "refunded" | "forfeited_partial" | "under_review";
  platformFee: Kobo | null;         
  feeConfigVersion: number;
  feeRatePercentApplied: number | null;
  pairJobNumber: number | null;     

  commissionSettled: boolean;       
  bookedViaPlatform: true;
  arrivedAt: number | null;
  arrivalSource: "geofence" | "manual" | null;
  locationUnavailable: boolean;
  completedAt: number | null;
  customerConfirmedAt: number | null;
  autoConfirmAt: number | null;     
  cancelledBy: "customer" | "artisan" | "system" | null;
  cancelReasonCode: string | null;
  createdAt: number;
}

export interface JobPrivateDetails {
  exactAddress: string;
  exactLat: number;
  exactLng: number;
  accessNotes: string | null;
}

export interface JobEvent {
  eventId: string;
  type:
    | "state_change" | "deposit_paid" | "arrived_geofence" | "arrived_manual"
    | "location_gap" | "quote_revision_requested" | "quote_revision_approved"
    | "cancel_requested" | "survey_sent" | "survey_answered" | "contact_blocked"
    | "payout_released" | "commission_charged" | "guarantee_claim_opened";
  actorId: string | "system";
  payload: Record<string, unknown>;
  at: number;
}

export interface Wallet {
  userId: string;
  balance: Kobo;               
  pendingEarnings: Kobo;       
  creditLimit: Kobo;           
  blockedReason: "none" | "negative_balance" | "overdue_commission" | "suspended";
  updatedAt: number;
}

export interface WalletTransaction {
  txId: string;
  userId: string;
  jobId: string | null;
  type:
    | "deposit_release_to_artisan" | "commission_charge" | "cash_commission_charge"
    | "topup" | "withdrawal" | "withdrawal_reversal" | "refund_debit"
    | "guarantee_clawback" | "adjustment_admin";
  amount: Kobo;                
  balanceAfter: Kobo;
  reference: string;           
  createdAt: number;
}

export interface PlatformConfig {
  version: number;
  feeTiers: { upToPairJobNumber: number; ratePercent: number }[]; 
  minimumFee: Kobo;                       
  depositPercent: number;                 
  depositMinimum: Kobo;                   
  depositWindowMinutes: number;           
  requireDeposit: boolean;                
  escrowEnabled: boolean;                 
  autoConfirmHours: number;               
  walletCreditLimit: Kobo;                
  overdueCommissionDays: number;          
  cancellation: {
    customerFreeBeforeEnRouteMinutes: number;
    customerFeeAfterEnRoute: Kobo;
    afterArrivalReviewHours: number;      
    callOutFee: Kobo;                     
  };
  guarantee: { windowDays: number; enabled: boolean }; 
  arrival: { radiusMeters: number; consecutivePings: number; pingSeconds: number };
  leakage: { watchScore: number; reviewScore: number; windowDays: number };
  rewards: { inAppPaymentCredit: Kobo; surveyCredit: Kobo };
  chat: { blockPhoneNumbers: boolean; blockHandles: boolean };
}
