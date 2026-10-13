import { NextResponse } from "next/server";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string;

export async function GET() {
  try {
    const response = await fetch("https://api.paystack.co/bank?currency=NGN", {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
      next: { revalidate: 86400 } // Cache for 24 hours
    });

    const data = await response.json();
    
    if (!data.status) {
      throw new Error(data.message);
    }

    return NextResponse.json({ banks: data.data });
  } catch (error: any) {
    console.error("fetch banks error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
