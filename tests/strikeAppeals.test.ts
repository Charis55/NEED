import assert from "node:assert";
import test from "node:test";
import { Strike } from "../src/types/platform";

/**
 * Pure simulation of the strike review & account restoration invariant logic
 * implemented in src/lib/strikes.ts:reviewStrikeAppeal.
 */
function simulateAppealResolution(params: {
  strike: Strike;
  totalActiveStrikesForUser: number;
  decision: "approved" | "rejected";
  resolutionNote?: string;
  isArtisan: boolean;
  userState: {
    banned: boolean;
    deactivated?: boolean;
    suspended?: boolean;
    rankingMultiplier?: number;
    walletBlockedReason?: string;
    isNINBlacklisted?: boolean;
    isContactBlacklisted?: boolean;
  };
}) {
  const { strike, totalActiveStrikesForUser, decision, resolutionNote, isArtisan, userState } = params;
  const now = Date.now();

  if (decision === "rejected") {
    return {
      strike: {
        ...strike,
        appealStatus: "rejected" as const,
        resolvedAt: now,
        resolutionNote: resolutionNote || "Appeal reviewed and rejected by admin."
      },
      remainingCount: totalActiveStrikesForUser,
      userState: { ...userState }
    };
  }

  // Decision is APPROVED
  const remainingCount = Math.max(0, totalActiveStrikesForUser - 1);
  const updatedStrike: Strike = {
    ...strike,
    active: false,
    appealStatus: "approved" as const,
    resolvedAt: now,
    resolutionNote: resolutionNote || "Appeal approved by admin; strike removed."
  };

  const updatedUserState = { ...userState };

  if (isArtisan) {
    if (remainingCount < 3) {
      updatedUserState.banned = false;
      updatedUserState.deactivated = false;
      updatedUserState.suspended = false;
      updatedUserState.walletBlockedReason = "none";
      updatedUserState.isNINBlacklisted = false;
    }
    if (remainingCount < 2) {
      updatedUserState.rankingMultiplier = 1.0;
    }
  }

  // Customer restoration
  if (remainingCount < 3) {
    updatedUserState.banned = false;
    updatedUserState.isContactBlacklisted = false;
  }

  return {
    strike: updatedStrike,
    remainingCount,
    userState: updatedUserState
  };
}

test("strike appeal - rejection maintains active strike and penalty state", () => {
  const strike: Strike = {
    strikeId: "s-1",
    userId: "artisan-1",
    userType: "artisan",
    strikeNumber: 2,
    reason: "Attempted offline payment",
    evidenceSummary: "Phone number detected in chat",
    appealStatus: "pending",
    appealNote: "I did not mean to share my number",
    issuedAt: Date.now() - 10000,
    expiresAt: Date.now() + 86400000,
    active: true
  };

  const initialUserState = {
    banned: false,
    rankingMultiplier: 0.6
  };

  const res = simulateAppealResolution({
    strike,
    totalActiveStrikesForUser: 2,
    decision: "rejected",
    resolutionNote: "Evidence shows intentional offline redirection",
    isArtisan: true,
    userState: initialUserState
  });

  assert.strictEqual(res.strike.active, true, "Strike must remain active");
  assert.strictEqual(res.strike.appealStatus, "rejected");
  assert.strictEqual(res.remainingCount, 2);
  assert.strictEqual(res.userState.rankingMultiplier, 0.6, "Penalty should remain active");
});

test("strike appeal - approval drops 3rd strike and restores banned artisan & deletes blacklist", () => {
  const strike3: Strike = {
    strikeId: "s-3",
    userId: "artisan-banned",
    userType: "artisan",
    strikeNumber: 3,
    reason: "Circumvention repeated",
    evidenceSummary: "Offline proposal",
    appealStatus: "pending",
    appealNote: "Customer initiated false report; see attached screenshots",
    appealEvidencePhotos: ["https://r2.dev/proof.png"],
    issuedAt: Date.now() - 50000,
    expiresAt: Date.now() + 86400000,
    active: true
  };

  const bannedUserState = {
    banned: true,
    deactivated: true,
    suspended: true,
    walletBlockedReason: "suspended",
    isNINBlacklisted: true,
    rankingMultiplier: 0.6
  };

  const res = simulateAppealResolution({
    strike: strike3,
    totalActiveStrikesForUser: 3,
    decision: "approved",
    resolutionNote: "Verified proof from artisan; customer admitted misunderstanding",
    isArtisan: true,
    userState: bannedUserState
  });

  assert.strictEqual(res.strike.active, false, "Approved strike must be deactivated");
  assert.strictEqual(res.strike.appealStatus, "approved");
  assert.strictEqual(res.remainingCount, 2, "Active count must drop from 3 to 2");

  // Account Restoration Invariant
  assert.strictEqual(res.userState.banned, false, "Artisan must be unbanned");
  assert.strictEqual(res.userState.deactivated, false, "Artisan must be reactivated");
  assert.strictEqual(res.userState.suspended, false, "Suspension must be lifted");
  assert.strictEqual(res.userState.walletBlockedReason, "none", "Wallet blockedReason must be none");
  assert.strictEqual(res.userState.isNINBlacklisted, false, "NIN must be removed from blacklist");
});

test("strike appeal - approval drops 2nd strike and resets ranking multiplier", () => {
  const strike2: Strike = {
    strikeId: "s-2",
    userId: "artisan-penalty",
    userType: "artisan",
    strikeNumber: 2,
    reason: "Suspected off-platform negotiation",
    evidenceSummary: "Flagged phrase",
    appealStatus: "pending",
    appealNote: "Explaining quote adjustment on platform",
    issuedAt: Date.now() - 30000,
    expiresAt: Date.now() + 86400000,
    active: true
  };

  const penalizedUserState = {
    banned: false,
    rankingMultiplier: 0.6
  };

  const res = simulateAppealResolution({
    strike: strike2,
    totalActiveStrikesForUser: 2,
    decision: "approved",
    isArtisan: true,
    userState: penalizedUserState
  });

  assert.strictEqual(res.remainingCount, 1);
  assert.strictEqual(res.userState.rankingMultiplier, 1.0, "Ranking multiplier must be restored to 1.0");
});

test("strike appeal - customer appeal approval restores customer account and un-blacklists phone/email", () => {
  const customerStrike: Strike = {
    strikeId: "s-cust-3",
    userId: "cust-1",
    userType: "customer",
    strikeNumber: 3,
    reason: "Repeated off-platform solicitations",
    evidenceSummary: "High severity contact filter",
    appealStatus: "pending",
    appealNote: "Account was used by sibling; legitimate context provided",
    issuedAt: Date.now() - 20000,
    expiresAt: Date.now() + 86400000,
    active: true
  };

  const bannedCustomerState = {
    banned: true,
    isContactBlacklisted: true
  };

  const res = simulateAppealResolution({
    strike: customerStrike,
    totalActiveStrikesForUser: 3,
    decision: "approved",
    isArtisan: false,
    userState: bannedCustomerState
  });

  assert.strictEqual(res.remainingCount, 2);
  assert.strictEqual(res.userState.banned, false, "Customer must be unbanned");
  assert.strictEqual(res.userState.isContactBlacklisted, false, "Contact must be un-blacklisted");
});
