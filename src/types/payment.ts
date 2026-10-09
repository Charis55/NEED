import { Kobo } from "./platform";

export interface PaymentProvider {
  /**
   * Initializes a transaction to collect money.
   */
  initializeTransaction(params: {
    amount: Kobo;
    email: string;
    reference: string;
    metadata?: Record<string, any>;
  }): Promise<{ authorizationUrl: string; accessCode: string; reference: string }>;

  /**
   * Verifies a transaction using its reference.
   */
  verifyTransaction(reference: string): Promise<{
    status: "success" | "failed" | "abandoned" | "ongoing" | "pending";
    amount: Kobo;
    currency: string;
    providerRaw: any;
  }>;

  /**
   * Resolves a bank account (used to match names before withdrawals).
   */
  resolveAccount(accountNumber: string, bankCode: string): Promise<{
    accountName: string;
    accountNumber: string;
  }>;

  /**
   * Creates a transfer recipient for payouts.
   */
  createTransferRecipient(params: {
    name: string;
    accountNumber: string;
    bankCode: string;
  }): Promise<{ recipientCode: string }>;

  /**
   * Initiates a transfer (withdrawal) to a recipient.
   */
  initiateTransfer(params: {
    amount: Kobo;
    recipientCode: string;
    reference: string;
    reason: string;
  }): Promise<{ transferCode: string; status: string }>;
}
