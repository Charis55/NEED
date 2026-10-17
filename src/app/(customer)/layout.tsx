import { ReactNode } from "react";
import Link from "next/link";
import CustomerDock from "@/components/CustomerDock";
import RoleGuard from "@/components/RoleGuard";
import FloatingBrandingLogo from "@/components/FloatingBrandingLogo";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard requiredRole="customer">
      <div className="min-h-screen bg-[var(--color-brutal-bg)] pb-24 relative">
      {/* Branding Logo (Floating, hidden on subpages) */}
      <FloatingBrandingLogo href="/explore" />
      <main className="w-full pb-8">
        {children}
      </main>
      <CustomerDock />
    </div>
    </RoleGuard>
  );
}
