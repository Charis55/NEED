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

        // 3. Blacklist Government Document / Passport
        const artisanData = artisanSnap.exists ? artisanSnap.data() : null;
        const privateData = userPrivateSnap.exists ? userPrivateSnap.data() : null;
        const docNumber = 
          artisanData?.identityDocumentNumber || 
          artisanData?.identityVerificationReference || 
          artisanData?.identityVerification?.referenceId || 
          privateData?.documentNumber || 
          privateData?.passportNumber ||
          privateData?.nin || 
          artisanData?.nin;

        if (docNumber) {
          const cleanDoc = String(docNumber).toUpperCase().replace(/\s/g, "");
          const docType = artisanData?.identityDocumentType || "passport_or_id";
          const blacklistRef = adminDb.collection("blacklistedDocuments").doc(cleanDoc);
          tx.set(blacklistRef, {
            documentNumber: cleanDoc,
            documentType: docType,
            userId,
            bannedAt: Date.now(),
            reason: `Banned after ${strikeNumber} circumvention strikes: ${reason}`,
            source: "strike_enforcement"
          });

          // Legacy backward compatibility
          const legacyRef = adminDb.collection("blacklistedNINs").doc(cleanDoc);
          tx.set(legacyRef, {
            nin: cleanDoc,
            documentNumber: cleanDoc,
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
 * Checks whether an identity (document/passport, NIN, phone, or email) is blacklisted.
 */
export async function isIdentityBlacklisted(params: {
  documentNumber?: string;
  nin?: string;
  phone?: string;
  email?: string;
}): Promise<{ blacklisted: boolean; reason?: string }> {
  const { documentNumber, nin, phone, email } = params;

  const targetDoc = documentNumber || nin;
  if (targetDoc) {
    const cleanDoc = String(targetDoc).toUpperCase().replace(/\s/g, "");
    const [docSnap, ninSnap] = await Promise.all([
      adminDb.collection("blacklistedDocuments").doc(cleanDoc).get(),
      adminDb.collection("blacklistedNINs").doc(cleanDoc).get()
    ]);
    if (docSnap.exists) {
      return {
        blacklisted: true,
        reason: docSnap.data()?.reason || "This identification document has been permanently blacklisted."
      };
    }
    if (ninSnap.exists) {
      return {
        blacklisted: true,
        reason: ninSnap.data()?.reason || "This identification document has been permanently blacklisted."
      };
    }
  }

  if (phone) {
    const cleanPhone = String(phone).replace(/\s/g, "");
    const doc = await adminDb.collection("blacklistedCustomers").doc(cleanPhone).get();
    if (doc.exists) {
      return {
        blacklisted: true,
        reason: doc.data()?.reason || "This phone number has been permanently blacklisted."
      };
    }
  }

  if (email) {
    const cleanEmail = String(email).toLowerCase().trim();
    const doc = await adminDb.collection("blacklistedCustomers").doc(cleanEmail).get();
    if (doc.exists) {
      return {
        blacklisted: true,
        reason: doc.data()?.reason || "This email address has been permanently blacklisted."
      };
    }
  }

  return { blacklisted: false };
}

export async function isDocumentBlacklisted(documentNumber: string): Promise<{ blacklisted: boolean; reason?: string }> {
  return isIdentityBlacklisted({ documentNumber });
}

export async function blacklistDocumentManually(params: {
  documentNumber: string;
  documentType?: string;
  userId?: string;
  reason: string;
  adminId: string;
}): Promise<void> {
  const { documentNumber, documentType = "passport_or_id", userId, reason, adminId } = params;
  const clean = String(documentNumber).toUpperCase().replace(/\s/g, "");

  await adminDb.collection("blacklistedDocuments").doc(clean).set({
    documentNumber: clean,
    documentType,
    userId: userId || null,
    bannedAt: Date.now(),
    bannedBy: adminId,
    reason,
    source: "manual_admin_blacklist"
  });

  if (userId) {
    await adminDb.collection("artisans").doc(userId).set({
      banned: true,
      deactivated: true,
      suspended: true,
      identityVerificationStatus: "blacklisted"
    }, { merge: true });

    await adminDb.collection("users").doc(userId).set({
      banned: true,
      active: false,
      bannedAt: Date.now(),
      banReason: `Manually blacklisted by admin: ${reason}`
    }, { merge: true });

    await adminDb.collection("wallets").doc(userId).set({
      blockedReason: "suspended"
    }, { merge: true });
  }

  await adminDb.collection("auditLog").add({
    type: "document_blacklisted",
    actorId: adminId,
    payload: { documentNumber: clean, documentType, userId, reason },
    at: Date.now()
  });
}

export async function removeDocumentFromBlacklist(documentNumber: string, adminId: string): Promise<void> {
  const clean = String(documentNumber).toUpperCase().replace(/\s/g, "");
  await Promise.all([
    adminDb.collection("blacklistedDocuments").doc(clean).delete(),
    adminDb.collection("blacklistedNINs").doc(clean).delete()
  ]);

  await adminDb.collection("auditLog").add({
    type: "document_unblacklisted",
    actorId: adminId,
    payload: { documentNumber: clean },
    at: Date.now()
  });
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

          // Un-blacklist Government Document / Passport if blacklisted
          const artisanData = artisanSnap.exists ? artisanSnap.data() : null;
          const privateData = userPrivateSnap.exists ? userPrivateSnap.data() : null;
          const docNumber = 
            artisanData?.identityDocumentNumber || 
            artisanData?.identityVerificationReference || 
            artisanData?.identityVerification?.referenceId || 
            privateData?.documentNumber || 
            privateData?.passportNumber ||
            privateData?.nin || 
            artisanData?.nin;

          if (docNumber) {
            const cleanDoc = String(docNumber).toUpperCase().replace(/\s/g, "");
            tx.delete(adminDb.collection("blacklistedDocuments").doc(cleanDoc));
            tx.delete(adminDb.collection("blacklistedNINs").doc(cleanDoc));
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
