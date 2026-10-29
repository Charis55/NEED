import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { paymentProvider } from "@/lib/paystack";
import { BankAccount } from "@/types/platform";
import { verifyUserRequest } from "@/lib/userAuthGuard";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifyUserRequest(req);
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const { userId: bodyUserId, accountNumber, bankCode, bankName } = await req.json();

    // Enforce that caller can only modify their own bank account (prevent IDOR)
    const authenticatedUid = authCheck.user.uid;
    if (bodyUserId && bodyUserId !== authenticatedUid) {
      return NextResponse.json(
        { error: "Forbidden: Cannot register bank account for another user" },
        { status: 403, headers: corsHeaders }
      );
    }

    const userId = authenticatedUid;

    if (!accountNumber || !bankCode || !bankName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    // Call Paystack to resolve the account
    const resolvedAccount = await paymentProvider.resolveAccount(accountNumber, bankCode);

    // Create a Paystack transfer recipient
    const recipientData = await paymentProvider.createTransferRecipient({
      name: resolvedAccount.accountName,
      accountNumber: resolvedAccount.accountNumber,
      bankCode: bankCode,
    });

    const bankAccount: BankAccount = {
      accountName: resolvedAccount.accountName,
      accountNumber: resolvedAccount.accountNumber,
      bankCode,
      bankName,
      recipientCode: recipientData.recipientCode,
    };

    // Store the bank details in userPrivate
    await adminDb.collection("userPrivate").doc(userId).set({
      bankAccount
    }, { merge: true });

    return NextResponse.json({ success: true, bankAccount }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("add-bank error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
