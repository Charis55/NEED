import { Transaction } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { Wallet, WalletTransaction, Kobo } from "@/types/platform";

/**
 * Posts a ledger entry to the wallet.
 * This MUST be called inside a Firestore Transaction.
 * It will throw if a transaction with the same reference already exists.
 */
export async function postLedgerEntry(
  tx: Transaction,
  entry: Omit<WalletTransaction, "txId" | "balanceAfter" | "createdAt">
): Promise<WalletTransaction> {
  // 1. Check idempotency: Ensure the reference doesn't already exist
  const txRefQuery = adminDb.collection("walletTransactions").where("reference", "==", entry.reference).limit(1);
  const existingTx = await tx.get(txRefQuery);
  if (!existingTx.empty) {
    throw new Error(`Duplicate transaction reference: ${entry.reference}`);
  }

  // 2. Load or initialize wallet
  const walletRef = adminDb.collection("wallets").doc(entry.userId);
  const walletSnap = await tx.get(walletRef);
  let balance = 0;
  if (walletSnap.exists) {
    balance = walletSnap.data()?.balance || 0;
  }

  // 3. Compute new balance
  const balanceAfter = balance + entry.amount;

  // 4. Update wallet
  if (walletSnap.exists) {
    tx.update(walletRef, {
      balance: balanceAfter,
      updatedAt: Date.now()
    });
  } else {
    // Note: The credit limit should be populated from config eventually if we create the wallet here.
    // For now, we'll initialize with basic defaults.
    const newWallet: Omit<Wallet, "creditLimit"> = {
      userId: entry.userId,
      balance: balanceAfter,
      pendingEarnings: 0,
      blockedReason: "none",
      updatedAt: Date.now()
    };
    tx.set(walletRef, newWallet, { merge: true });
  }

  // 5. Write the append-only transaction entry
  const newTxRef = adminDb.collection("walletTransactions").doc();
  const finalEntry: WalletTransaction = {
    ...entry,
    txId: newTxRef.id,
    balanceAfter,
    createdAt: Date.now()
  };
  
  tx.set(newTxRef, finalEntry);

  return finalEntry;
}
