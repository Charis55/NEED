import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { analyzeMessage } from "@/lib/contactFilter";
import { writeJobEvent } from "@/lib/jobEvents";
import { applyStrike } from "@/lib/strikes";
import { ContactAttempt, LeakageCase } from "@/types/platform";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chatId, jobId, senderId, text, attachments = [] } = body;

    if (!senderId || (!text && attachments.length === 0)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if sender is banned
    const userDoc = await adminDb.collection("users").doc(senderId).get();
    if (userDoc.exists && (userDoc.data()?.banned || userDoc.data()?.active === false)) {
      return NextResponse.json({ error: "Your account has been permanently suspended due to policy violations." }, { status: 403 });
    }

    const artisanDoc = await adminDb.collection("artisans").doc(senderId).get();
    if (artisanDoc.exists && (artisanDoc.data()?.banned || artisanDoc.data()?.deactivated)) {
      return NextResponse.json({ error: "Your artisan account has been permanently deactivated due to policy violations." }, { status: 403 });
    }

    // 1. Analyze message for contact leakage
    const filter = analyzeMessage(text || "");

    const targetJobId = jobId || chatId;

    // 2. High severity: BLOCK message and ISSUE A STRIKE IMMEDIATELY
    if (filter.blocked && filter.severity === "high") {
      const attemptRef = adminDb.collection("contactAttempts").doc();
      const attempt: ContactAttempt = {
        attemptId: attemptRef.id,
        chatId: chatId || targetJobId,
        senderId,
        text,
        reasons: filter.reasons,
        severity: "high",
        at: Date.now()
      };
      await attemptRef.set(attempt);

      if (targetJobId) {
        await writeJobEvent(
          targetJobId,
          "contact_blocked",
          senderId,
          { text, reasons: filter.reasons, severity: "high" }
        );
      }

      // Automatically apply a strike to the offending user (artisan or customer)
      const strikeRes = await applyStrike({
        userId: senderId,
        reason: `Circumvention attempt in chat: ${filter.reasons.join(", ")}`,
        evidenceSummary: `Blocked text: "${text}"`,
        adminId: "automated_chat_filter"
      });

      let warningMessage = "";
      if (strikeRes.strikeNumber >= 3) {
        warningMessage = "You have accumulated 3 strikes. Your account has been permanently banned and your details blacklisted.";
      } else {
        warningMessage = `Circumvention and contact sharing are strictly prohibited. You have received Strike ${strikeRes.strikeNumber} of 3. At 3 strikes, your account will be permanently banned and blacklisted.`;
      }

      return NextResponse.json({
        blocked: true,
        strikeNumber: strikeRes.strikeNumber,
        warning: warningMessage
      }, { status: 400 });
    }

    // 3. Medium severity: Deliver but log
    if (filter.severity === "medium") {
      const attemptRef = adminDb.collection("contactAttempts").doc();
      await attemptRef.set({
        attemptId: attemptRef.id,
        chatId: chatId || targetJobId,
        senderId,
        text,
        reasons: filter.reasons,
        severity: "medium",
        at: Date.now()
      });
    }

    // 4. Save message to Firestore
    const messageData = {
      senderId,
      text: text || "",
      attachments,
      createdAt: Date.now(),
      severity: filter.severity
    };

    let savedMessageRef;
    if (jobId) {
      savedMessageRef = await adminDb.collection("jobRequests").doc(jobId).collection("messages").add(messageData);
    } else if (chatId) {
      savedMessageRef = await adminDb.collection("chats").doc(chatId).collection("messages").add(messageData);
    }

    return NextResponse.json({
      success: true,
      messageId: savedMessageRef?.id,
      message: messageData
    });

  } catch (error: any) {
    console.error("Chat send error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
