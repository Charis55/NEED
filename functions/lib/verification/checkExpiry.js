"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPoliceClearanceExpiry = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
/**
 * Scheduled Cloud Function: Runs daily to check for expired police clearances.
 *
 * When a police clearance expires:
 *  - Sets policeClearanceStatus to "expired"
 *  - Sets available to false (cannot accept new jobs)
 *  - Sends a push notification telling the artisan to re-upload
 */
const db = admin.firestore();
exports.checkPoliceClearanceExpiry = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async (context) => {
    var _a, _b, _c;
    const now = Date.now();
    try {
        const snapshot = await db
            .collection("artisans")
            .where("policeClearanceExpiryDate", "<=", now)
            .where("policeClearanceStatus", "!=", "expired")
            .get();
        if (snapshot.empty) {
            console.log("No expired police clearances found.");
            return null;
        }
        const batch = db.batch();
        const expiredArtisanIds = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            // Only process if not already expired
            if (data.policeClearanceStatus !== "expired") {
                batch.update(doc.ref, {
                    policeClearanceStatus: "expired",
                    available: false,
                    manualReviewRequired: true,
                    manualReviewReasons: admin.firestore.FieldValue.arrayUnion("police_clearance_expired"),
                });
                expiredArtisanIds.push(doc.id);
            }
        });
        await batch.commit();
        console.log(`Marked ${expiredArtisanIds.length} artisan(s) with expired police clearance:`, expiredArtisanIds);
        // Send push notifications to affected artisans
        for (const artisanId of expiredArtisanIds) {
            try {
                const artisanDoc = await db.collection("artisans").doc(artisanId).get();
                const artisanData = artisanDoc.data();
                const fcmToken = artisanData === null || artisanData === void 0 ? void 0 : artisanData.fcmToken;
                if (fcmToken) {
                    // Check push preferences
                    const userDoc = await db.collection("users").doc(artisanId).get();
                    const pushEnabled = userDoc.exists ? ((_c = (_b = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.preferences) === null || _b === void 0 ? void 0 : _b.pushNotifications) !== null && _c !== void 0 ? _c : true) : true;
                    if (pushEnabled) {
                        await admin.messaging().send({
                            token: fcmToken,
                            notification: {
                                title: "Police Clearance Expired",
                                body: "Your Police Clearance Certificate has expired. Please re-upload a current clearance to continue accepting job requests.",
                            },
                            data: {
                                type: "police_clearance_expired",
                            },
                        });
                        console.log(`Expiry notification sent to artisan ${artisanId}`);
                    }
                    else {
                        console.log(`Expiry notification skipped for ${artisanId} due to preferences`);
                    }
                }
            }
            catch (notifError) {
                console.error(`Failed to send expiry notification to ${artisanId}:`, notifError);
            }
        }
        return null;
    }
    catch (error) {
        console.error("Error checking police clearance expiry:", error);
        return null;
    }
});
//# sourceMappingURL=checkExpiry.js.map