import { Kobo, PlatformConfig } from "@/types/platform";
import { Money } from "./money";

export function computeFee(finalPrice: Kobo, pairJobNumber: number, config: PlatformConfig): { fee: Kobo; ratePercent: number } {
  // Find the correct fee tier. The tiers are sorted implicitly by upToPairJobNumber in config
  const tier = config.feeTiers.find(t => pairJobNumber <= t.upToPairJobNumber);
  
  if (!tier) {
    throw new Error("No fee tier found for pairJobNumber: " + pairJobNumber);
  }

  // Calculate percentage-based fee, round half up
  const raw = Money.round((finalPrice * tier.ratePercent) / 100);
  
  // Apply minimum fee
  const rawFeeWithMin = Math.max(raw, config.minimumFee);
  
  // Never charge a fee larger than the job price itself
  const fee = Math.min(rawFeeWithMin, finalPrice);

  return { fee, ratePercent: tier.ratePercent };
}

export function computeRequiredDeposit(agreedPrice: Kobo, feePreview: Kobo, config: PlatformConfig): Kobo {
  // If requireDeposit is turned off (e.g. pilot mode), return 0
  if (!config.requireDeposit) {
    return 0;
  }

  // 1. Calculate percentage-based deposit
  const percentDeposit = Money.round((agreedPrice * config.depositPercent) / 100);

  // 2. Deposit must be at least the config minimum
  // 3. Deposit must ALWAYS cover the platform fee preview
  const required = Math.max(percentDeposit, config.depositMinimum, feePreview);

  // 4. Deposit cannot exceed the agreed price
  return Math.min(required, agreedPrice);
}
