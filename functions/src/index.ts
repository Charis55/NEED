import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// Phase 6: Job Request Push Notification
export const onJobRequestCreated = functions.firestore
  .document("jobRequests/{requestId}")
  .onCreate(async (snap, context) => {
    const requestData = snap.data();
    const artisanId = requestData.artisanId;

    if (!artisanId) return null;

    try {
      const artisanDoc = await db.collection("artisans").doc(artisanId).get();
      if (!artisanDoc.exists) return null;

      const artisanData = artisanDoc.data();
      const fcmToken = artisanData?.fcmToken;

      // Only send if the artisan has registered an FCM token for push notifications
      if (fcmToken) {
        const payload = {
          notification: {
            title: "New Job Request!",
            body: `A customer requested you for a job in ${requestData.neighborhood}.`,
          },
          data: {
            requestId: context.params.requestId,
          },
        };

        await admin.messaging().send({
          token: fcmToken,
          ...payload,
        });
        console.log("Push notification sent to artisan:", artisanId);
      }
    } catch (error) {
      console.error("Error sending push notification:", error);
    }

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
