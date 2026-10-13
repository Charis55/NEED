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
  creditDiscountApplied?: Kobo;
  creditsUsed?: string[];
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
  guaranteeClaimId?: string;
  guaranteeResolution?: "redo_arranged" | "refunded_clawback" | "rejected" | null;
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
    | "payout_released" | "commission_charged" | "guarantee_claim_opened"
    | "guarantee_claim_resolved"
    | "call_started" | "call_initiated" | "call_ended";
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
  channel?: string;
  createdAt: number;
}

export interface LedgerDiscrepancy {
  discrepancyId: string;
  type: "wallet_sum_mismatch" | "escrow_reserve_mismatch" | "untracked_transaction";
  userId?: string;
  expectedBalance?: Kobo;
  actualBalance?: Kobo;
  difference?: Kobo;
  totalHeldEscrow?: Kobo;
  paystackBalance?: Kobo;
  details: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "investigating" | "resolved" | "dismissed";
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface ReconciliationReport {
  reportId: string;
  timestamp: number;
  walletsChecked: number;
  walletsMismatched: number;
  totalHeldEscrowKobo: Kobo;
  paystackBalanceKobo: Kobo | null;
  escrowShortfallKobo: Kobo;
  discrepanciesCount: number;
  discrepancyIds: string[];
  status: "clean" | "discrepancies_detected";
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

export interface BankAccount {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  recipientCode: string;
}

export interface UserPrivate {
  userId: string;
  phone?: string;
  bankAccount?: BankAccount;
}

export interface Payout {
  payoutId: string;
  userId: string;
  amount: Kobo;
  reference: string;
  transferCode?: string;
  status: "pending" | "success" | "failed" | "reversed";
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  createdAt: number;
}

export interface QuoteRevision {
  revisionId: string;
  jobId: string;
  artisanId: string;
  additionalAmount: Kobo;
  reason: string;
  photos: string[];
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  resolvedAt?: number;
}

export interface LeakageSurvey {
  surveyId: string;
  jobId: string;
  customerId: string;
  artisanId: string;
  arrived: boolean;
  fixed: "yes" | "no" | "not_attempted";
  offlineSuggested: "technician_asked" | "customer_asked" | "no";
  comment?: string;
  createdAt: number;
  resolved: boolean;
  resolvedAt?: number;
  outcome?: string;
}

export interface LeakageCase {
  caseId: string;
  artisanId: string;
  customerId?: string;
  score: number;
  reasons: string[];
  status: "open" | "under_review" | "resolved_warning" | "resolved_strike" | "resolved_suspended" | "dismissed";
  evidence: {
    stats?: any;
    jobTimelines?: any[];
    locationTrails?: any[];
    blockedMessages?: any[];
    surveyAnswers?: any[];
    priorStrikes?: any[];
    notes?: string;
  };
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface Strike {
  strikeId: string;
  userId: string;
  userType?: "artisan" | "customer";
  strikeNumber: number; // 1, 2, 3
  reason: string;
  evidenceSummary: string;
  appealStatus?: "none" | "pending" | "approved" | "rejected";
  appealNote?: string;
  appealEvidencePhotos?: string[];
  appealedAt?: number;
  resolvedAt?: number;
  resolvedBy?: string;
  resolutionNote?: string;
  issuedAt: number;
  expiresAt: number;
  active: boolean;
}

export interface GuaranteeClaim {
  claimId: string;
  jobId: string;
  customerId: string;
  artisanId: string;
  description: string;
  photos: string[];
  status: "submitted" | "under_review" | "redo_arranged" | "refunded_clawback" | "rejected";
  resolutionNotes?: string;
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
  refundAmount?: Kobo;
}

export interface CustomerCredit {
  creditId: string;
  customerId: string;
  amount: Kobo;
  reason: "in_app_payment_bonus" | "survey_completion" | "goodwill" | "guarantee_refund";
  jobId?: string;
  surveyId?: string;
  used: boolean;
  usedJobId?: string;
  usedAt?: number;
  createdAt: number;
}

export interface Pair {
  pairId: string; // `${customerId}_${artisanId}`
  customerId: string;
  artisanId: string;
  completedCount: number;
  lastCompletedAt: number;
  totalValue: Kobo;
}

export interface RecurringService {
  id: string;
  customerId: string;
  artisanId: string;
  trade: string;
  subcategory: string;
  intervalMonths: number;
  nextDueAt: number;
  lastNotifiedAt?: number;
  optedIn: boolean;
}

export interface ContactAttempt {
  attemptId: string;
  chatId: string;
  senderId: string;
  text: string;
  reasons: string[];
  severity: "medium" | "high";
  at: number;
}

export interface AuditLogEntry {
  id: string;
  type: string;
  actorId: string;
  before?: any;
  after?: any;
  note?: string;
  at: number;
}
