import { PaymentProvider } from "@/types/payment";
import { Kobo } from "@/types/platform";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string;

export class PaystackProvider implements PaymentProvider {
  async initializeTransaction(params: { amount: Kobo; email: string; reference: string; metadata?: Record<string, any>; callbackUrl?: string }) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    let defaultCallbackUrl = `${baseUrl}/checkout/success`;
    if (params.metadata?.type === "wallet_topup") {
      defaultCallbackUrl = `${baseUrl}/checkout/topup-success`;
    } else if (params.metadata?.type === "deposit" || params.metadata?.jobId) {
      defaultCallbackUrl = `${baseUrl}/checkout/success?type=deposit&jobId=${params.metadata?.jobId || ""}`;
    }

    const callback_url = params.callbackUrl || defaultCallbackUrl;

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
        callback_url,
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
    
    if (!data.status) {
      // If using a Starter Business test account, mock the success so we can still test the flow
      if (data.message.toUpperCase().includes("STARTER BUSINESS")) {
        console.warn("MOCKING PAYSTACK TRANSFER: Paystack rejected third-party transfer because this is a Starter Business account. Returning a mocked transfer code.");
        return { transferCode: `TRF_MOCK_${Date.now()}`, status: "pending" };
      }
      throw new Error(data.message);
    }

    return { transferCode: data.data.transfer_code, status: data.data.status };
  }

  async fetchBalance(): Promise<{ balance: Kobo; currency: string } | null> {
    if (!PAYSTACK_SECRET_KEY) {
      return null;
    }
    try {
      const response = await fetch("https://api.paystack.co/balance", {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });
      const data = await response.json();
      if (!data.status || !Array.isArray(data.data) || data.data.length === 0) {
        return null;
      }
      const ngnBalance = data.data.find((b: any) => b.currency === "NGN") || data.data[0];
      return {
        balance: ngnBalance.balance as Kobo,
        currency: ngnBalance.currency,
      };
    } catch (err) {
      console.error("Failed to fetch Paystack balance:", err);
      return null;
    }
  }
}

export const paymentProvider = new PaystackProvider();
