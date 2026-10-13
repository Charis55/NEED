import { adminDb } from "./firebaseAdmin";
import { Strike, AuditLogEntry } from "@/types/platform";

/**
 * Applies a strike to an artisan or customer account following the strict 3-strikes rule.
 * At 3 strikes, the account is permanently banned and its identity (NIN / Phone / Email) is blacklisted.
 */
export async function applyStrike(params: {
  userId: string;
  reason: string;
  evidenceSummary: string;
  adminId: string;
  userType?: "artisan" | "customer";
}): Promise<{ strikeNumber: number; strikeId: string; actionTaken: string }> {
  const { userId, reason, evidenceSummary, adminId, userType } = params;

  return await adminDb.runTransaction(async (tx) => {
    // 1. Fetch active strikes count for user
    const existingStrikesSnap = await adminDb
      .collection("strikes")
      .where("userId", "==", userId)
      .where("active", "==", true)
      .get();

    const strikeNumber = existingStrikesSnap.size + 1;
    const strikeRef = adminDb.collection("strikes").doc();

    const artisanRef = adminDb.collection("artisans").doc(userId);
    const userRef = adminDb.collection("users").doc(userId);
    const walletRef = adminDb.collection("wallets").doc(userId);
    const userPrivateRef = adminDb.collection("userPrivate").doc(userId);

    // Perform ALL reads before ANY writes
    const [artisanSnap, userSnap, userPrivateSnap] = await Promise.all([
      tx.get(artisanRef),
      tx.get(userRef),
      tx.get(userPrivateRef)
    ]);

    const isArtisan = userType === "artisan" || artisanSnap.exists;

    const newStrike: Strike = {
      strikeId: strikeRef.id,
      userId,
      userType: isArtisan ? "artisan" : "customer",
      strikeNumber,
      reason,
      evidenceSummary,
      appealStatus: "none",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days expiration
      active: true
    };
    tx.set(strikeRef, newStrike);

    let actionTaken = "";

    if (strikeNumber === 1) {
      actionTaken = "warning_issued";
    } else if (strikeNumber === 2) {
      actionTaken = isArtisan ? "ranking_reduced_0.6" : "final_warning_issued";
      if (isArtisan) {
        tx.set(artisanRef, {
          rankingMultiplier: 0.6,
          rankingMultiplierExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
        }, { merge: true });
      }
    } else {
      // 3 or more strikes: PERMANENT BAN & BLACKLISTING
      actionTaken = "permanently_banned_and_blacklisted";

      if (isArtisan) {
        // 1. Deactivate & Ban Artisan
        tx.set(artisanRef, {
          deactivated: true,
          banned: true,
          verified: false,
          suspended: true
        }, { merge: true });

        // 2. Suspend wallet
        tx.set(walletRef, {
          blockedReason: "suspended"
        }, { merge: true });

        // 3. Blacklist NIN
        const artisanData = artisanSnap.exists ? artisanSnap.data() : null;
        const privateData = userPrivateSnap.exists ? userPrivateSnap.data() : null;
        const nin = privateData?.nin || artisanData?.nin || artisanData?.identityVerification?.referenceId;

        if (nin) {
          const cleanNin = String(nin).replace(/\s/g, "");
          const blacklistRef = adminDb.collection("blacklistedNINs").doc(cleanNin);
          tx.set(blacklistRef, {
            nin: cleanNin,
            userId,
            bannedAt: Date.now(),
            reason: `Banned after ${strikeNumber} circumvention strikes: ${reason}`,
            source: "strike_enforcement"
          });
        }
      }

      // Ban user account in users collection
      tx.set(userRef, {
        banned: true,
        active: false,
        bannedAt: Date.now(),
        banReason: `Permanently banned after ${strikeNumber} strikes: ${reason}`
      }, { merge: true });

      // Blacklist customer phone number and email
      const userData = userSnap.exists ? userSnap.data() : null;
      const phone = userData?.phone || userPrivateSnap.data()?.phone;
      const email = userData?.email;

      if (phone) {
        const cleanPhone = String(phone).replace(/\s/g, "");
        const blacklistedPhoneRef = adminDb.collection("blacklistedCustomers").doc(cleanPhone);
        tx.set(blacklistedPhoneRef, {
          identifier: cleanPhone,
          type: "phone",
          userId,
          bannedAt: Date.now(),
          reason: `Banned after ${strikeNumber} circumvention strikes`
        });
      }

      if (email) {
        const cleanEmail = String(email).toLowerCase().trim();
        const blacklistedEmailRef = adminDb.collection("blacklistedCustomers").doc(cleanEmail);
        tx.set(blacklistedEmailRef, {
          identifier: cleanEmail,
          type: "email",
          userId,
          bannedAt: Date.now(),
          reason: `Banned after ${strikeNumber} circumvention strikes`
        });
      }
    }

    // Write audit log
    const auditRef = adminDb.collection("auditLog").doc();
    const auditEntry: AuditLogEntry = {
      id: auditRef.id,
      type: "strike_applied",
      actorId: adminId,
      payload: {
        userId,
        strikeNumber,
        reason,
        evidenceSummary,
        actionTaken
      },
      at: Date.now()
    } as any;
    tx.set(auditRef, auditEntry);

    return { strikeNumber, strikeId: strikeRef.id, actionTaken };
  });
}

/**
 * Checks whether an identity (NIN, phone, or email) is blacklisted.
 */
export async function isIdentityBlacklisted(params: {
  nin?: string;
  phone?: string;
  email?: string;
}): Promise<{ blacklisted: boolean; reason?: string }> {
  const { nin, phone, email } = params;

  if (nin) {
    const cleanNin = String(nin).replace(/\s/g, "");
    const doc = await adminDb.collection("blacklistedNINs").doc(cleanNin).get();
    if (doc.exists) {
      return {
        blacklisted: true,
        reason: doc.data()?.reason || "This National Identification Number has been permanently blacklisted."
      };
    }
  }

  if (phone) {
    const cleanPhone = String(phone).replace(/\s/g, "");
    const doc = await adminDb.collection("blacklistedCustomers").doc(cleanPhone).get();
    if (doc.exists) {
      return {
        blacklisted: true,
        reason: doc.data()?.reason || "This phone number has been blacklisted."
      };
    }
  }

  if (email) {
    const cleanEmail = String(email).toLowerCase().trim();
    const doc = await adminDb.collection("blacklistedCustomers").doc(cleanEmail).get();
    if (doc.exists) {
      return {
        blacklisted: true,
        reason: doc.data()?.reason || "This account has been blacklisted."
      };
    }
  }

  return { blacklisted: false };
}

/**
 * Submits an appeal against a strike with reasoning and evidence photos.
 */
export async function submitStrikeAppeal(params: {
  strikeId: string;
  userId: string;
  appealNote: string;
  appealEvidencePhotos?: string[];
}): Promise<boolean> {
  const { strikeId, userId, appealNote, appealEvidencePhotos = [] } = params;
  const strikeRef = adminDb.collection("strikes").doc(strikeId);
  const strikeSnap = await strikeRef.get();

  if (!strikeSnap.exists) {
    throw new Error("Strike not found");
  }

  const strike = strikeSnap.data() as Strike;
  if (strike.userId !== userId) {
    throw new Error("Unauthorized: You can only appeal your own strikes");
  }

  if (strike.appealStatus === "pending") {
    throw new Error("An appeal is already pending review for this strike.");
  }

  await strikeRef.update({
    appealStatus: "pending",
    appealNote,
    appealEvidencePhotos,
    appealedAt: Date.now()
  });

  return true;
}

/**
 * Admin reviews a strike appeal, either approving and restoring the account, or rejecting the appeal.
 */
export async function reviewStrikeAppeal(params: {
  strikeId: string;
  adminId: string;
  decision: "approved" | "rejected";
  resolutionNote?: string;
}): Promise<{ success: boolean; decision: string; activeStrikesRemaining: number }> {
  const { strikeId, adminId, decision, resolutionNote } = params;

  return await adminDb.runTransaction(async (tx) => {
    const strikeRef = adminDb.collection("strikes").doc(strikeId);
    const strikeSnap = await tx.get(strikeRef);

    if (!strikeSnap.exists) {
      throw new Error("Strike not found");
    }

    const strike = strikeSnap.data() as Strike;
    const userId = strike.userId;
    const now = Date.now();

    if (decision === "approved") {
      const artisanRef = adminDb.collection("artisans").doc(userId);
      const userRef = adminDb.collection("users").doc(userId);
      const walletRef = adminDb.collection("wallets").doc(userId);
      const userPrivateRef = adminDb.collection("userPrivate").doc(userId);

      // Perform all reads first
      const [artisanSnap, userSnap, userPrivateSnap, otherStrikesSnap] = await Promise.all([
        tx.get(artisanRef),
        tx.get(userRef),
        tx.get(userPrivateRef),
        adminDb.collection("strikes").where("userId", "==", userId).where("active", "==", true).get()
      ]);

      const isArtisan = strike.userType === "artisan" || artisanSnap.exists;
      // Decrement since this one was deactivated
      const remainingCount = Math.max(0, otherStrikesSnap.docs.filter(d => d.id !== strikeId).length);

      // 1. Deactivate strike and mark approved
      tx.update(strikeRef, {
        active: false,
        appealStatus: "approved",
        resolvedAt: now,
        resolvedBy: adminId,
        resolutionNote: resolutionNote || "Appeal approved by admin; strike removed."
      });

      // Account Restoration if strikes dropped below 3
      if (isArtisan) {
        if (remainingCount < 3) {
          tx.set(artisanRef, {
            banned: false,
            deactivated: false,
            suspended: false
          }, { merge: true });

          tx.set(walletRef, {
            blockedReason: "none"
          }, { merge: true });

          // Un-blacklist NIN if blacklisted
          const artisanData = artisanSnap.exists ? artisanSnap.data() : null;
          const privateData = userPrivateSnap.exists ? userPrivateSnap.data() : null;
          const nin = privateData?.nin || artisanData?.nin || artisanData?.identityVerification?.referenceId;
          if (nin) {
            const cleanNin = String(nin).replace(/\s/g, "");
            tx.delete(adminDb.collection("blacklistedNINs").doc(cleanNin));
          }
        }

        if (remainingCount < 2) {
          tx.set(artisanRef, {
            rankingMultiplier: 1.0
          }, { merge: true });
        }
      }

      // Customer restoration
      if (remainingCount < 3) {
        tx.set(userRef, {
          banned: false,
          active: true
        }, { merge: true });

        const userData = userSnap.exists ? userSnap.data() : null;
        const phone = userData?.phone || userPrivateSnap.data()?.phone;
        const email = userData?.email;

        if (phone) {
          const cleanPhone = String(phone).replace(/\s/g, "");
          tx.delete(adminDb.collection("blacklistedCustomers").doc(cleanPhone));
        }
        if (email) {
          const cleanEmail = String(email).toLowerCase().trim();
          tx.delete(adminDb.collection("blacklistedCustomers").doc(cleanEmail));
        }
      }

      // Write audit log
      const auditRef = adminDb.collection("auditLog").doc();
      tx.set(auditRef, {
        id: auditRef.id,
        type: "appeal_approved",
        actorId: adminId,
        payload: {
          strikeId,
          userId,
          remainingActiveStrikes: remainingCount,
          resolutionNote
        },
        at: now
      });

      return { success: true, decision: "approved", activeStrikesRemaining: remainingCount };
    } else {
      // Decision is rejected
      tx.update(strikeRef, {
        appealStatus: "rejected",
        resolvedAt: now,
        resolvedBy: adminId,
        resolutionNote: resolutionNote || "Appeal reviewed and rejected by admin."
      });

      const auditRef = adminDb.collection("auditLog").doc();
      tx.set(auditRef, {
        id: auditRef.id,
        type: "appeal_rejected",
        actorId: adminId,
        payload: {
          strikeId,
          userId,
          resolutionNote
        },
        at: now
      });

      return { success: true, decision: "rejected", activeStrikesRemaining: strike.strikeNumber };
    }
  });
}
