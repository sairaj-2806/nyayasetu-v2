import assert from "node:assert";
import {
  checkActiveShareGrant,
  addDocumentShare,
  updateDocumentShare,
  getSharesForDocument,
} from "../src/lib/document-shares";

console.log("===========================================================================");
console.log("📂 NYAYASETU SIH26190 DMS COLLABORATION & ACCESS CONTROL VERIFICATION SUITE");
console.log("===========================================================================");

let testIndex = 0;
function test(name, fn) {
  testIndex++;
  try {
    fn();
    console.log(`  ✅ PASS [${testIndex}]: ${name}`);
  } catch (err) {
    console.error(`  ❌ FAIL [${testIndex}]: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Creation and Validation of Active Share Grant
test("Active share grant permits authorized recipient with valid permission", () => {
  const share = {
    id: "share-test-1",
    document_id: "doc-test-101",
    document_number: "DOC-2026-FSL-001",
    recipient_type: "USER",
    recipient_id: "officer-sharma-42",
    recipient_name: "Inspector Vikram Rathore",
    recipient_role: "investigating_officer",
    case_scope: "BNS/2026/0014",
    permissions: ["VIEW", "DOWNLOAD"],
    granted_by: "admin-system",
    granted_by_name: "Court Registrar",
    granted_by_role: "registrar",
    granted_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(), // 24 hours
    is_revoked: false,
    reason: "Inter-agency ballistic inspection",
    created_at: new Date().toISOString(),
  };

  addDocumentShare(share);

  const viewRes = checkActiveShareGrant(
    "doc-test-101",
    "officer-sharma-42",
    ["investigating_officer"],
    "VIEW",
  );
  const downloadRes = checkActiveShareGrant(
    "doc-test-101",
    "officer-sharma-42",
    ["investigating_officer"],
    "DOWNLOAD",
  );
  const editRes = checkActiveShareGrant(
    "doc-test-101",
    "officer-sharma-42",
    ["investigating_officer"],
    "EDIT",
  );

  assert.strictEqual(viewRes.allowed, true, "Recipient should be allowed to VIEW");
  assert.strictEqual(downloadRes.allowed, true, "Recipient should be allowed to DOWNLOAD");
  assert.strictEqual(
    editRes.allowed,
    false,
    "Recipient should NOT be allowed to EDIT without grant",
  );
});

// 2. Unrelated user cannot use another recipient's grant
test("Unrelated recipient ID is strictly denied access", () => {
  const otherRes = checkActiveShareGrant(
    "doc-test-101",
    "unrelated-officer-99",
    ["police_officer"],
    "VIEW",
  );
  assert.strictEqual(otherRes.allowed, false, "Unrelated officer must not inherit share grant");
  assert.strictEqual(otherRes.reason, "NO_ACTIVE_SHARE");
});

// 3. Expired grant fails closed
test("Expired share grant automatically fails closed", () => {
  const expiredShare = {
    id: "share-test-2",
    document_id: "doc-test-102",
    document_number: "DOC-2026-SEALED-009",
    recipient_type: "USER",
    recipient_id: "officer-expired-01",
    recipient_name: "SI Sandeep Nain",
    recipient_role: "police_officer",
    permissions: ["VIEW"],
    granted_by: "admin-system",
    granted_by_name: "Court Registrar",
    granted_by_role: "registrar",
    granted_at: new Date(Date.now() - 7200000).toISOString(),
    expires_at: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hr ago
    is_revoked: false,
    reason: "Temporary spot inspection",
    created_at: new Date(Date.now() - 7200000).toISOString(),
  };

  addDocumentShare(expiredShare);

  const expiredRes = checkActiveShareGrant(
    "doc-test-102",
    "officer-expired-01",
    ["police_officer"],
    "VIEW",
  );
  assert.strictEqual(expiredRes.allowed, false, "Expired grant must fail closed and reject access");
  assert.strictEqual(expiredRes.reason, "SHARE_EXPIRED");
});

// 4. Immediate revocation cuts off access instantly
test("Revoking an active share grant immediately cuts off access", () => {
  const revocableShare = {
    id: "share-test-3",
    document_id: "doc-test-103",
    document_number: "DOC-2026-WITNESS-014",
    recipient_type: "USER",
    recipient_id: "advocate-verma-77",
    recipient_name: "Adv. Sanjay Aggarwal",
    recipient_role: "legal_officer",
    permissions: ["VIEW"],
    granted_by: "admin-system",
    granted_by_name: "Court Registrar",
    granted_by_role: "registrar",
    granted_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 2).toISOString(),
    is_revoked: false,
    reason: "Advance copy service u/s 193 BNSS",
    created_at: new Date().toISOString(),
  };

  addDocumentShare(revocableShare);

  // Pre-revocation check
  const beforeRevoke = checkActiveShareGrant(
    "doc-test-103",
    "advocate-verma-77",
    ["legal_officer"],
    "VIEW",
  );
  assert.strictEqual(beforeRevoke.allowed, true, "Access should be active before revocation");

  // Revoke grant
  const updated = updateDocumentShare("share-test-3", {
    is_revoked: true,
    revoked_at: new Date().toISOString(),
    revoked_by_name: "Court Registrar",
    revocation_reason: "Court Order cancelling advance copy",
  });
  assert.strictEqual(updated, true, "Update share should return true");

  // Post-revocation check
  const afterRevoke = checkActiveShareGrant(
    "doc-test-103",
    "advocate-verma-77",
    ["legal_officer"],
    "VIEW",
  );
  assert.strictEqual(
    afterRevoke.allowed,
    false,
    "Access must be denied immediately after revocation",
  );
  assert.strictEqual(afterRevoke.reason, "SHARE_REVOKED");
});

// 5. Role-based share grant
test("Role-based share grant permits any user holding that role", () => {
  const roleShare = {
    id: "share-test-4",
    document_id: "doc-test-104",
    document_number: "DOC-2026-CYBER-055",
    recipient_type: "ROLE",
    recipient_name: "All Forensic Science Examiners",
    recipient_role: "forensic_officer",
    permissions: ["VIEW", "COMMENT"],
    granted_by: "admin-system",
    granted_by_name: "Court Registrar",
    granted_by_role: "registrar",
    granted_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 3).toISOString(),
    is_revoked: false,
    reason: "Lab peer review",
    created_at: new Date().toISOString(),
  };

  addDocumentShare(roleShare);

  const fslRes = checkActiveShareGrant(
    "doc-test-104",
    "any-examiner-99",
    ["forensic_officer"],
    "VIEW",
  );
  assert.strictEqual(fslRes.allowed, true, "User with forensic_officer role should be allowed");

  const ioRes = checkActiveShareGrant(
    "doc-test-104",
    "any-io-88",
    ["investigating_officer"],
    "VIEW",
  );
  assert.strictEqual(ioRes.allowed, false, "User without forensic_officer role should be denied");
});

console.log("===========================================================================");
console.log("🏁 ALL DMS COLLABORATION & SHARING SECURITY TESTS PASSED!");
console.log("===========================================================================");
