import assert from "node:assert";
import test from "node:test";
import { analyzeMessage } from "../src/lib/contactFilter";

test("contactFilter - 65 fixtures test suite", () => {
  // ─── PART 1: Prices & Ordinary Messages (MUST PASS WITH ZERO FALSE POSITIVES) ───
  const safeMessages = [
    "15000",
    "15,000 naira",
    "₦15k",
    "₦15,000",
    "30k",
    "₦5,000",
    "My price is 20000",
    "It will cost 45000",
    "The replacement part is 12000 naira",
    "Can you do 8000?",
    "I will do it for 25000 naira only",
    "5000 naira for transport",
    "Total is 35,000 NGN",
    "I can come by 2pm today",
    "See you tomorrow around 10am",
    "I am on my way now",
    "I have arrived at your street",
    "Please send me the picture of the leaking pipe",
    "The generator is making a loud noise",
    "I will bring my toolbox",
    "Let me know when you are home",
    "The job is finished and ready for testing",
    "Good morning, are you available today?",
    "Yes I am available",
    "Where is the fuse box located?"
  ];

  for (const msg of safeMessages) {
    const res = analyzeMessage(msg);
    assert.strictEqual(
      res.blocked,
      false,
      `Expected safe message to NOT be blocked: "${msg}" (Reasons: ${res.reasons.join(", ")})`
    );
    assert.strictEqual(
      res.severity,
      "none",
      `Expected severity 'none' for safe message: "${msg}"`
    );
  }

  // ─── PART 2: High Severity Phone Numbers & Contact Sharing (MUST BE BLOCKED) ───
  const blockedPhoneMessages = [
    "Call me on 08012345678",
    "My number is +2348012345678",
    "09012345678",
    "07012345678",
    "Reach me at 08123456789",
    "0 8 0 1 2 3 4 5 6 7 8",
    "0 8 0 - 1 2 3 4 - 5 6 7 8",
    "080.1234.5678",
    "080/1234/5678",
    "(080) 1234 5678",
    "zero eight zero one two three four five six seven eight",
    "zero nine zero nine eight seven six five four three two",
    "0 8 0 o 1 2 3 4 5 6 7",
    "080 oh 12345678",
    "Send text to 08012345678 please",
    "07098765432 call my phone",
    "My phone is 2348012345678",
    "08187654321 quick",
    "09123456789 here is my line",
    "0 7 0 3 4 5 6 7 8 9 0"
  ];

  for (const msg of blockedPhoneMessages) {
    const res = analyzeMessage(msg);
    assert.strictEqual(
      res.blocked,
      true,
      `Expected phone message to be BLOCKED: "${msg}"`
    );
    assert.strictEqual(res.severity, "high");
  }

  // ─── PART 3: Emails, Handles, URLs (MUST BE BLOCKED) ───
  const blockedLinksAndHandles = [
    "Email me at artisan@gmail.com",
    "Send details to plumber@yahoo.com",
    "My email is info@contractor.ng",
    "Check my instagram @plumber_lagos",
    "Hit me on telegram @technician234",
    "Message me on wa.me/2348012345678",
    "Click here: https://mywebsite.com/contact",
    "Go to www.cheaprepair.com",
    "Reach out @artisan_pro",
    "Let's take it offline",
    "Call me on my line",
    "Send me airtime",
    "Check your whatsapp"
  ];

  for (const msg of blockedLinksAndHandles) {
    const res = analyzeMessage(msg);
    assert.strictEqual(
      res.blocked,
      true,
      `Expected link/handle to be BLOCKED: "${msg}"`
    );
    assert.strictEqual(res.severity, "high");
  }

  // ─── PART 4: Medium Severity Circumvention Keywords (DELIVERED BUT FLAGGED) ───
  const mediumFlaggedMessages = [
    "Let's chat on whatsapp instead",
    "Please pay cash when I reach",
    "Pay me cash directly",
    "Let us do this outside the app",
    "Can we handle this off the app?",
    "Without the app we save money",
    "No commission this way",
    "We can avoid commission",
    "Make we talk outside my brother",
    "No pay for app abeg",
    "Let us deal direct",
    "Call me when you are ready"
  ];

  for (const msg of mediumFlaggedMessages) {
    const res = analyzeMessage(msg);
    assert.strictEqual(
      res.blocked,
      false,
      `Expected medium keyword message to be delivered: "${msg}"`
    );
    assert.strictEqual(
      res.severity,
      "medium",
      `Expected medium severity for: "${msg}"`
    );
  }
});
