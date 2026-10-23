import { adminDb } from "../src/lib/firebaseAdmin";
async function run() {
  const users = await adminDb.collection("users").get();
  console.log("Found", users.docs.length, "users.");
  users.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, "=>", data.displayName || data.firstName || data.email, "token:", data.fcmToken ? data.fcmToken.substring(0, 20) + "... (len: " + data.fcmToken.length + ")" : "NO_TOKEN");
  });
  const jobs = await adminDb.collection("jobRequests").orderBy("createdAt", "desc").limit(3).get();
  jobs.forEach(doc => {
    const d = doc.data();
    console.log("Job:", doc.id, "customer:", d.customerId, "artisan:", d.artisanId, "activeCall:", d.activeCall?.callId, "status:", d.activeCall?.status);
  });
}
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
