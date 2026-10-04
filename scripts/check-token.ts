import { adminDb } from "../src/lib/firebaseAdmin";
async function run() {
  const users = await adminDb.collection("users").get();
  console.log("Found", users.docs.length, "users.");
  users.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, "=>", data.fcmToken ? "HAS_TOKEN: " + data.fcmToken.substring(0, 10) + "..." : "NO_TOKEN");
  });
}
run().catch(console.error);
