import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Scheduled Cloud Function: Runs weekly to clean up documents
 * from rejected applicants past the retention period.
 *
 * Retention period: 90 days after rejection.
 *
 * This ensures compliance with Nigeria's data protection framework
 * by not retaining sensitive personal documents indefinitely.
 */

const db = admin.firestore();
const RETENTION_PERIOD_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export const retentionCleanup = functions.pubsub
  .schedule("every 168 hours") // Weekly
  .onRun(async (context) => {
    const cutoffDate = Date.now() - RETENTION_PERIOD_MS;

    try {
      // Find rejected artisans past the retention period
      const snapshot = await db
        .collection("verificationReviewQueue")
        .where("status", "==", "rejected")
        .where("reviewedAt", "<=", cutoffDate)
        .get();

      if (snapshot.empty) {
        console.log("No rejected applicants past retention period.");
        return null;
      }

      let cleanedCount = 0;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const artisanId = data.artisanId;

        try {
          // Clear document URLs and extracted data from the artisan profile
          const artisanRef = db.collection("artisans").doc(artisanId);
          const artisanDoc = await artisanRef.get();

          if (artisanDoc.exists) {
            await artisanRef.update({
              certificateUrl: admin.firestore.FieldValue.delete(),
              policeClearanceUrl: admin.firestore.FieldValue.delete(),
              certificateExtractedData: admin.firestore.FieldValue.delete(),
              policeClearanceExtractedData: admin.firestore.FieldValue.delete(),
              // Keep the profile record itself for audit, but remove sensitive docs
            });

            // Log the cleanup action
            await artisanRef.update({
              verificationDecisionLog: admin.firestore.FieldValue.arrayUnion({
                action: "documents_deleted_retention_policy",
                adminId: "system",
                adminEmail: "retention-cleanup@system",
                timestamp: Date.now(),
                reason: `Documents deleted after ${RETENTION_PERIOD_MS / (24 * 60 * 60 * 1000)} day retention period following rejection.`,
              }),
            });
          }

          // Note: Actual file deletion from R2/Storage would require
          // calling the delete-file API endpoint with the file keys.
          // This function clears the references; a separate process
          // would handle the actual blob deletion.

          cleanedCount++;
        } catch (err) {
          console.error(
            `Failed to clean up documents for artisan ${artisanId}:`,
            err
          );
        }
      }

      console.log(
        `Retention cleanup: cleared documents for ${cleanedCount} rejected applicant(s).`
      );
      return null;
    } catch (error) {
      console.error("Retention cleanup error:", error);
      return null;
    }
  });
