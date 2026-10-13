import assert from "node:assert";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Firestore Security Rules - Structural & Invariant Verification", () => {
  const rulesPath = path.resolve(__dirname, "../firestore.rules");
  assert.ok(fs.existsSync(rulesPath), "firestore.rules file must exist");

  const rulesContent = fs.readFileSync(rulesPath, "utf-8");

  // 1. Version and Service Declaration
  assert.match(rulesContent, /rules_version\s*=\s*'2';/, "Rules version must be 2");
  assert.match(rulesContent, /service\s+cloud\.firestore\s*\{/, "Must declare cloud.firestore service");

  // 2. Default Catch-All Deny
  assert.ok(
    rulesContent.includes("match /{document=**}") &&
    rulesContent.includes("allow read, write: if false;"),
    "Must enforce a default deny catch-all for unmatched paths"
  );

  // 3. Admin Definition with Verified Email
  assert.match(
    rulesContent,
    /request\.auth\.token\.email_verified\s*==\s*true/,
    "Admin check must require verified email"
  );
  assert.match(
    rulesContent,
    /obunezicharis@gmail\.com/,
    "Admin check must specify authorized email"
  );

  // 4. Financial Ledger Write Denial (wallets, transactions, payments, payouts)
  const financialCollections = ["wallets", "walletTransactions", "payments", "payouts", "paystackEvents"];
  for (const col of financialCollections) {
    const colRegex = new RegExp(`match\\s+/${col}/\\{[^}]+\\}\\s*\\{[\\s\\S]*?allow write:\\s*if false;`, "m");
    assert.match(rulesContent, colRegex, `Collection /${col} must deny client writes (allow write: if false)`);
  }

  // 5. Job Escrow & Financial Tampering Blacklist
  const requiredFinancialBlacklist = [
    "depositPaid",
    "depositRequired",
    "depositStatus",
    "platformFee",
    "feeRatePercentApplied",
    "feeConfigVersion",
    "commissionSettled",
    "completedAt",
    "commissionPaid",
  ];
  for (const field of requiredFinancialBlacklist) {
    assert.ok(
      rulesContent.includes(`'${field}'`),
      `Job updates must blacklist modification of financial field '${field}'`
    );
  }

  // 6. Artisan Self-Verification & Ranking Blacklist
  const artisanTamperBlacklist = [
    "verified",
    "rating",
    "reviewCount",
    "strikeCount",
    "leakageScore",
    "penaltyMultiplier",
    "suspended",
  ];
  for (const field of artisanTamperBlacklist) {
    assert.ok(
      rulesContent.includes(`'${field}'`),
      `Artisan updates must blacklist modification of privileged field '${field}'`
    );
  }

  // 7. Sensitive KYC Isolation (userPrivate)
  assert.match(
    rulesContent,
    /match\s+\/userPrivate\/\{userId\}\s*\{[\s\S]*?allow write:\s*if false;/,
    "Collection /userPrivate must be strictly client write-denied"
  );

  // 8. Financial Reconciliation & Audits (adminDiscrepancies & reconciliationReports)
  assert.match(
    rulesContent,
    /match\s+\/reconciliationReports\/\{reportId\}\s*\{[\s\S]*?allow read, write:\s*if isAdmin\(\);/,
    "reconciliationReports must be strictly admin only"
  );
  assert.match(
    rulesContent,
    /match\s+\/adminDiscrepancies\/\{discrepancyId\}\s*\{[\s\S]*?allow read, write:\s*if isAdmin\(\);/,
    "adminDiscrepancies must be strictly admin only"
  );

  // 9. Guarantee Claims & Customer Credits
  assert.match(
    rulesContent,
    /match\s+\/guaranteeClaims\/\{claimId\}\s*\{[\s\S]*?allow write:\s*if false;/,
    "guaranteeClaims writes must be client-denied"
  );
  assert.match(
    rulesContent,
    /match\s+\/customerCredits\/\{creditId\}\s*\{[\s\S]*?allow write:\s*if false;/,
    "customerCredits writes must be client-denied"
  );

  // 10. In-Job Chat Messages Subcollection
  assert.match(
    rulesContent,
    /match\s+\/messages\/\{messageId\}\s*\{[\s\S]*?request\.resource\.data\.senderId\s*==\s*request\.auth\.uid/,
    "Chat message creation must verify that senderId matches request.auth.uid"
  );
  assert.match(
    rulesContent,
    /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\['read',\s*'reactions'\]\)/,
    "Chat message updates must only allow updating 'read' and 'reactions'"
  );
});

test("Firestore Security Rules - Query Compatibility Verification", () => {
  const rulesPath = path.resolve(__dirname, "../firestore.rules");
  const rulesContent = fs.readFileSync(rulesPath, "utf-8");

  // Verify that jobRequests read rules support customerId, artisanId, and broadcast queries directly
  assert.ok(
    rulesContent.includes("resource.data.customerId == request.auth.uid") &&
    rulesContent.includes("resource.data.artisanId == request.auth.uid") &&
    rulesContent.includes("resource.data.isBroadcast == true"),
    "jobRequests read rules must evaluate resource.data to support direct Firestore collection queries"
  );

  // Verify that reviews are publicly readable
  assert.match(
    rulesContent,
    /match\s+\/reviews\/\{reviewId\}\s*\{\s*allow read:\s*if true;/,
    "reviews must be publicly readable for ratings and profiles"
  );

  // Verify that platformConfig is publicly readable
  assert.match(
    rulesContent,
    /match\s+\/platformConfig\/\{docId\}\s*\{\s*allow read:\s*if true;/,
    "platformConfig must be publicly readable for platform parameters"
  );
});
