import { PaymentProvider } from "@/types/payment";
import { Kobo } from "@/types/platform";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string;

export class PaystackProvider implements PaymentProvider {
  async initializeTransaction(params: { amount: Kobo; email: string; reference: string; metadata?: Record<string, any> }) {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: params.email,
        amount: params.amount, // Paystack expects lowest denomination, which is kobo
        reference: params.reference,
        metadata: params.metadata,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/jobs/${params.metadata?.jobId || "callback"}`,
      }),
    });

    const data = await response.json();
    if (!data.status) {
      throw new Error("Paystack initialize failed: " + data.message);
    }
    
    return {
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    };
  }

  async verifyTransaction(reference: string) {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const data = await response.json();
    if (!data.status) throw new Error("Paystack verify failed: " + data.message);

    let mappedStatus: "success" | "failed" | "abandoned" | "ongoing" | "pending";
    if (data.data.status === "success") mappedStatus = "success";
    else if (data.data.status === "failed") mappedStatus = "failed";
    else if (data.data.status === "abandoned") mappedStatus = "abandoned";
    else mappedStatus = "pending";

    return {
      status: mappedStatus,
      amount: data.data.amount as number,
      currency: data.data.currency,
      providerRaw: data.data,
    };
  }

  async resolveAccount(accountNumber: string, bankCode: string) {
    const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const data = await response.json();
    if (!data.status) throw new Error(data.message);
    
    return {
      accountName: data.data.account_name,
      accountNumber: data.data.account_number,
    };
  }

  async createTransferRecipient(params: { name: string; accountNumber: string; bankCode: string }) {
    const response = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: params.name,
        account_number: params.accountNumber,
        bank_code: params.bankCode,
        currency: "NGN",
      }),
    });
    const data = await response.json();
    if (!data.status) throw new Error(data.message);

    return { recipientCode: data.data.recipient_code };
  }

  async initiateTransfer(params: { amount: Kobo; recipientCode: string; reference: string; reason: string }) {
    const response = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: params.amount,
        recipient: params.recipientCode,
        reason: params.reason,
        reference: params.reference,
      }),
    });
    const data = await response.json();
    if (!data.status) throw new Error(data.message);

    return { transferCode: data.data.transfer_code, status: data.data.status };
  }
}

export const paymentProvider = new PaystackProvider();
