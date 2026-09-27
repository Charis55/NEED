import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// Helper function to send push notification respecting user preferences
async function sendPush(userId: string, title: string, body: string, data: any = {}) {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return;
    
    const userData = userDoc.data();
    const fcmToken = userData?.fcmToken;
    const pushEnabled = userData?.preferences?.pushNotifications ?? true;
    
    if (fcmToken && pushEnabled) {
      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data
      });
      console.log(`Push notification sent to ${userId}`);
    }
  } catch (err) {
    console.error(`Failed to send push to ${userId}:`, err);
  }
}

// Phase 6: Job Request Push Notification
export const onJobRequestCreated = functions.firestore
  .document("jobRequests/{requestId}")
  .onCreate(async (snap, context) => {
    const requestData = snap.data();
    if (!requestData.artisanId) return null;
    await sendPush(
      requestData.artisanId, 
      "New Job Request!", 
      `A customer requested you for a job in ${requestData.neighborhood}.`,
      { requestId: context.params.requestId }
    );
    return null;
  });

export const onJobRequestUpdated = functions.firestore
  .document("jobRequests/{requestId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    if (before.status !== after.status) {
      if (after.status === "accepted") {
        await sendPush(after.customerId, "Job Accepted!", "Your technician has accepted the job request.", { requestId: context.params.requestId });
      } else if (after.status === "en_route") {
        await sendPush(after.customerId, "Technician En Route!", "Your technician is on their way.", { requestId: context.params.requestId });
      } else if (after.status === "in_progress") {
        await sendPush(after.customerId, "Technician Arrived!", "Your technician has arrived and started the job.", { requestId: context.params.requestId });
      } else if (after.status === "completed") {
        await sendPush(after.customerId, "Job Completed!", "The job has been marked as completed.", { requestId: context.params.requestId });
      }
    }
    return null;
  });

export const onChatMessageCreated = functions.firestore
  .document("jobRequests/{requestId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const msg = snap.data();
    const requestId = context.params.requestId;
    
    // Get the job request to find out who is customer and who is artisan
    const jobDoc = await db.collection("jobRequests").doc(requestId).get();
    if (!jobDoc.exists) return null;
    
    const jobData = jobDoc.data()!;
    const isSenderCustomer = msg.senderId === jobData.customerId;
    const recipientId = isSenderCustomer ? jobData.artisanId : jobData.customerId;
    
    await sendPush(
      recipientId, 
      "New Message", 
      msg.text || "Sent an image", 
      { requestId, type: "chat" }
    );
    return null;
  });

// Phase 7: Rating Aggregation on New Review
export const onReviewCreated = functions.firestore
  .document("reviews/{reviewId}")
  .onCreate(async (snap, context) => {
    const reviewData = snap.data();
    const artisanId = reviewData.artisanId;
    const newRating = reviewData.rating;

    if (!artisanId || typeof newRating !== "number") return null;

    const artisanRef = db.collection("artisans").doc(artisanId);

    try {
      await db.runTransaction(async (transaction) => {
        const artisanDoc = await transaction.get(artisanRef);
        if (!artisanDoc.exists) {
          throw new Error("Artisan does not exist!");
        }

        const data = artisanDoc.data() || {};
        const currentCount = data.ratingCount || 0;
        const currentAverage = data.ratingAverage || 0;

        const newCount = currentCount + 1;
        const newAverage = ((currentAverage * currentCount) + newRating) / newCount;

        transaction.update(artisanRef, {
          ratingCount: newCount,
          ratingAverage: newAverage,
        });
      });
      console.log(`Successfully updated rating for artisan ${artisanId}`);
    } catch (error) {
      console.error("Transaction failed: ", error);
    }
    
    return null;
  });

// --- Verification Pipeline Functions ---
export { onArtisanProfileCreated } from "./verification/onDocumentUploaded";
export { checkPoliceClearanceExpiry } from "./verification/checkExpiry";
export { retentionCleanup } from "./verification/retentionCleanup";

// Temporary function to grant admin access to the owner
export const grantAdmin = functions.https.onRequest(async (req, res) => {
  try {
    const emailToElevate = "obunezicharis@gmail.com";
    const userRecord = await admin.auth().getUserByEmail(emailToElevate);
    
    if (userRecord) {
      await db.collection("users").doc(userRecord.uid).update({
        isAdmin: true
      });
      res.status(200).send(`Successfully granted admin access to ${emailToElevate}`);
    } else {
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error granting admin access.");
  }
});

