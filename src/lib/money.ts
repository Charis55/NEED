import { Kobo } from "@/types/platform";

export class Money {
  /**
   * Formats a Kobo amount into a Naira string (e.g. ₦1,500)
   */
  static formatNaira(amountInKobo: Kobo): string {
    const naira = amountInKobo / 100;
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(naira);
  }

  /**
   * Rounds half up a numeric value to the nearest integer kobo
   */
  static round(amount: number): Kobo {
    return Math.round(amount);
  }
}
