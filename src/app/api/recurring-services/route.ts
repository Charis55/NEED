import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { RecurringService } from "@/types/platform";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");
    const artisanId = searchParams.get("artisanId");

    let query: FirebaseFirestore.Query = adminDb.collection("recurringServices");

    if (customerId) {
      query = query.where("customerId", "==", customerId);
    } else if (artisanId) {
      query = query.where("artisanId", "==", artisanId);
    } else {
      return NextResponse.json({ error: "Missing customerId or artisanId query parameter" }, { status: 400 });
    }

    const snap = await query.get();
    const services: RecurringService[] = [];
    snap.forEach((doc) => {
      services.push(doc.data() as RecurringService);
    });

    services.sort((a, b) => a.nextDueAt - b.nextDueAt);

    return NextResponse.json({
      success: true,
      services
    });
  } catch (error: any) {
    console.error("Failed to fetch recurring services:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch recurring services" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, artisanId, trade, subcategory, intervalMonths = 3 } = body;

    if (!customerId || !artisanId || !trade || !subcategory) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const interval = Number(intervalMonths) || 3;
    const nextDueAt = Date.now() + interval * 30 * 24 * 60 * 60 * 1000;

    // Use deterministic ID per customer-artisan-subcategory pair
    const sanitizedSub = subcategory.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const serviceId = `rec_${customerId}_${artisanId}_${sanitizedSub}`;
    const docRef = adminDb.collection("recurringServices").doc(serviceId);

    const data: RecurringService = {
      id: serviceId,
      customerId,
      artisanId,
      trade,
      subcategory,
      intervalMonths: interval,
      nextDueAt,
      optedIn: true
    };

    await docRef.set(data, { merge: true });

    return NextResponse.json({
      success: true,
      service: data
    });
  } catch (error: any) {
    console.error("Failed to setup recurring service:", error);
    return NextResponse.json({ error: error.message || "Failed to setup recurring service" }, { status: 500 });
  }
}
