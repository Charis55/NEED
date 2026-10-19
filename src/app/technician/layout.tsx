import { ReactNode } from "react";
import Link from "next/link";
import ArtisanDock from "@/components/ArtisanDock";
import RoleGuard from "@/components/RoleGuard";
import FloatingBrandingLogo from "@/components/FloatingBrandingLogo";
import DockSwipeNavigator from "@/components/DockSwipeNavigator";

const ARTISAN_DOCK_ROUTES = [
  "/technician/dashboard",
  "/technician/jobs",
  "/technician/inbox",
  "/technician/settings",
];

export default function ArtisanLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard requiredRole="artisan">
      <div className="min-h-screen bg-[var(--color-brutal-bg)] pb-24 relative overflow-x-hidden">
        {/* Branding Logo (Floating, hidden on subpages) */}
        <FloatingBrandingLogo href="/technician/dashboard" />

        <DockSwipeNavigator routes={ARTISAN_DOCK_ROUTES}>
          <main className="w-full">
            {children}
          </main>
        </DockSwipeNavigator>
        
        <ArtisanDock />
      </div>
    </RoleGuard>
  );
}
