import { ReactNode } from "react";
import Link from "next/link";
import CustomerDock from "@/components/CustomerDock";
import RoleGuard from "@/components/RoleGuard";
import DockSwipeNavigator from "@/components/DockSwipeNavigator";

const CUSTOMER_DOCK_ROUTES = ["/explore", "/jobs", "/favorites", "/inbox", "/settings"];

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard requiredRole="customer">
      <div className="min-h-screen bg-[var(--color-brutal-bg)] pb-24 relative overflow-x-hidden">
        <DockSwipeNavigator routes={CUSTOMER_DOCK_ROUTES}>
          <main className="w-full pb-8">
            {children}
          </main>
        </DockSwipeNavigator>
        <CustomerDock />
      </div>
    </RoleGuard>
  );
}
