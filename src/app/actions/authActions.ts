"use server";

import { adminDb } from "@/lib/firebaseAdmin";

export async function sendCustomOtp(phoneNumber: string) {
  try {
    if (!phoneNumber || !phoneNumber.startsWith("+")) {
      return { success: false, error: "Invalid phone number format" };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    console.log(`\n\n=== OTP for ${phoneNumber} is: ${otp} ===\n\n`);

    await adminDb.collection("otps").doc(phoneNumber).set({
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("Error sending OTP:", error);
    return { success: false, error: (error as Error).message || "Failed to send OTP" };
  }
}

export async function verifyCustomOtp(phoneNumber: string, otp: string) {
  try {
    const docRef = adminDb.collection("otps").doc(phoneNumber);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { success: false, error: "OTP not found or expired" };
    }

    const data = docSnap.data() as { otp: string; expiresAt: number };

    if (Date.now() > data.expiresAt) {
      return { success: false, error: "OTP expired" };
    }

    if (data.otp !== otp) {
      return { success: false, error: "Invalid OTP" };
    }

    await docRef.delete();

    const email = `${phoneNumber.replace("+", "")}@need.app`;
    const password = `NeedOTP-${phoneNumber}-Secure`;

    return { 
      success: true, 
      credentials: { email, password } 
    };
  } catch (error: unknown) {
    console.error("Error verifying OTP:", error);
    return { success: false, error: (error as Error).message || "Failed to verify OTP" };
  }
}
