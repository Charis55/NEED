import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyAdminRequest } from "@/lib/adminAuthGuard";
import { RecurringService } from "@/types/platform";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    const isCronAuthorized = Boolean(secret && authHeader === `Bearer ${secret}`);

    if (!isCronAuthorized) {
      const adminCheck = await verifyAdminRequest(req);
      if (adminCheck.errorResponse) {
        return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
      }
    }

    const now = Date.now();
    const query = adminDb
      .collection("recurringServices")
      .where("optedIn", "==", true)
      .where("nextDueAt", "<=", now);

    const snapshot = await query.get();
    if (snapshot.empty) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    let processed = 0;

    for (const doc of snapshot.docs) {
      const service = doc.data() as RecurringService;
      
      // Send notification to customer
      fetch(`${baseUrl}/api/send-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: service.customerId,
          title: "Service Maintenance Reminder",
          body: `It's time for your periodic ${service.subcategory} maintenance! Rebook now to keep your loyalty commission discount.`,
          data: { type: "recurring_service_due", serviceId: service.id, artisanId: service.artisanId }
        })
      }).catch(console.error);

      // Advance schedule to next cycle
      const nextDueAt = now + service.intervalMonths * 30 * 24 * 60 * 60 * 1000;
      await doc.ref.update({
        lastNotifiedAt: now,
        nextDueAt
      });

      processed++;
    }

    return NextResponse.json({ success: true, processed });
  } catch (error: any) {
    console.error("Recurring services cron error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
