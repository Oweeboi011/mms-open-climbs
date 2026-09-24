// Security-rule checks for firestore.rules and storage.rules, run against the
// local emulators (needs Java):
//
//   npm run test:rules
//
// Kept out of `npm test` because Vitest has no emulator. Covers the rules
// that guard money and members' private files: registration create shape,
// append-only payment history, the climbInternal roster, feedback, analytics
// TTL fields, and owner/admin-only storage access.
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { readFileSync } from "node:fs";

const FV = firebase.firestore.FieldValue;
const TS = firebase.firestore.Timestamp;
const env = await initializeTestEnvironment({
  projectId: "demo-rules",
  // Hosts/ports come from the env vars `firebase emulators:exec` sets.
  firestore: { rules: readFileSync("firestore.rules", "utf8") },
  storage: { rules: readFileSync("storage.rules", "utf8") },
});

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + " :: " + String(e.message || e).slice(0, 200)); }
}

const ts = TS.fromMillis(1_700_000_000_000);
async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await db.doc("users/admin").set({ role: "admin" });
    await db.doc("users/m1").set({ role: "member" });
    await db.doc("users/m2").set({ role: "member" });
    await db.doc("climbs/c1").set({ status: "open", title: "Pulag" });
    await db.doc("climbInternal/c1").set({ registeredUserIds: ["m1"], officerEmails: [{ email: "o@x.com" }] });
    await db.doc("climbPrivate/c1").set({ resources: [] });
    // c2: not yet migrated — roster still only on the climb doc.
    await db.doc("climbs/c2").set({ status: "open", title: "Apo", registeredUserIds: ["m2"] });
    await db.doc("climbPrivate/c2").set({ resources: [] });
    await db.doc("registrations/r_unpaid").set({ userId: "m1", climbId: "c1", status: "pending", paymentStatus: "unpaid", amountPaid: null, payments: [], waiverSigned: false });
    await db.doc("registrations/r_hist").set({ userId: "m1", climbId: "c1", status: "confirmed", paymentStatus: "verified", amountPaid: 500,
      payments: [{ amount: 500, proofs: [], submittedAt: ts, status: "verified", reviewedBy: "A" }] });
    await db.doc("registrations/r_legacy").set({ userId: "m1", climbId: "c1", status: "confirmed", paymentStatus: "verified", amountPaid: 300, paymentProofs: [{ url: "u" }] });
  });
}

const m1 = () => env.authenticatedContext("m1", { email: "m1@x.com" }).firestore();
const m2 = () => env.authenticatedContext("m2", { email: "m2@x.com" }).firestore();
const admin = () => env.authenticatedContext("admin", { email: "a@x.com", admin: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const baseReg = { userId: "m1", climbId: "c1", email: "m1@x.com", name: "Juan", status: "pending", memberType: "joiner",
  waiverSigned: true, waiverSignedName: "Juan Cruz", paymentStatus: "unpaid", amountPaid: null, payments: [], paymentProofs: [] };
const newPay = (amount, extra = {}) => ({ amount, proofs: [{ url: "p" }], submittedAt: TS.now(), status: "submitted", ...extra });
const ok = (name, fn) => t(name, () => assertSucceeds(fn()));
const no = (name, fn) => t(name, () => assertFails(fn()));

console.log("Firestore: registration create");
await seed();
await ok("member creates unpaid registration", () => m1().collection("registrations").add(baseReg));
await ok("member creates with one submitted payment", () => m1().collection("registrations").add({ ...baseReg, paymentStatus: "submitted", amountPaid: 800, payments: [newPay(800)] }));
await no("reject status confirmed", () => m1().collection("registrations").add({ ...baseReg, status: "confirmed" }));
await no("reject paymentStatus verified", () => m1().collection("registrations").add({ ...baseReg, paymentStatus: "verified" }));
await no("reject someone else's email", () => m1().collection("registrations").add({ ...baseReg, email: "victim@x.com" }));
await no("reject pre-verified payment entry", () => m1().collection("registrations").add({ ...baseReg, paymentStatus: "submitted", amountPaid: 800, payments: [newPay(800, { status: "verified" })] }));
await no("reject amountPaid above payment", () => m1().collection("registrations").add({ ...baseReg, paymentStatus: "submitted", amountPaid: 9000, payments: [newPay(800)] }));
await no("reject bad memberType", () => m1().collection("registrations").add({ ...baseReg, memberType: "vip" }));
await no("reject registering as another user", () => m2().collection("registrations").add({ ...baseReg }));
await ok("admin creates walk-in", () => admin().collection("registrations").add({ ...baseReg, email: "walkin@x.com", status: "confirmed" }));

console.log("Firestore: payment history updates");
await seed();
await ok("first payment on unpaid (amountPaid null)", () => m1().doc("registrations/r_unpaid").update({ payments: FV.arrayUnion(newPay(200)), amountPaid: 200, paymentStatus: "submitted", paymentSubmittedAt: FV.serverTimestamp(), verifiedAt: null, verifiedBy: null }));
await seed();
await ok("append on history", () => m1().doc("registrations/r_hist").update({ payments: FV.arrayUnion(newPay(200)), amountPaid: 700, paymentStatus: "submitted", verifiedAt: null, verifiedBy: null }));
await seed();
await no("reject forged verified entry", () => m1().doc("registrations/r_hist").update({ payments: FV.arrayUnion(newPay(200, { status: "verified" })), amountPaid: 700 }));
await no("reject rewriting accepted amount", () => m1().doc("registrations/r_hist").update({ payments: [{ amount: 5000, proofs: [], submittedAt: ts, status: "verified", reviewedBy: "A" }], amountPaid: 5000 }));
await no("reject inflated amountPaid", () => m1().doc("registrations/r_hist").update({ payments: FV.arrayUnion(newPay(200)), amountPaid: 5000 }));
await no("reject amountPaid alone", () => m1().doc("registrations/r_hist").update({ amountPaid: 5000 }));
await no("reject two entries at once", () => m1().doc("registrations/r_hist").update({ payments: FV.arrayUnion(newPay(1), newPay(2)), amountPaid: 503 }));
await no("reject self-verify status", () => m1().doc("registrations/r_unpaid").update({ paymentStatus: "verified" }));
await ok("legacy registration migrates on first new payment", () => m1().doc("registrations/r_legacy").update({ payments: [{ amount: 300, proofs: [{ url: "u" }], submittedAt: null, status: "verified" }, newPay(100)], amountPaid: 400, paymentStatus: "submitted" }));
await seed();
await no("reject legacy migration that inflates", () => m1().doc("registrations/r_legacy").update({ payments: [{ amount: 900, proofs: [], submittedAt: null, status: "verified" }, newPay(100)], amountPaid: 1000 }));
await ok("member uploads document", () => m1().doc("registrations/r_hist").update({ medicalCertUpload: { url: "x", fileName: "a.pdf" } }));
await ok("member signs own waiver", () => m1().doc("registrations/r_unpaid").update({ waiverSigned: true, waiverSignedName: "Juan Cruz", waiverSignedAt: FV.serverTimestamp() }));
await ok("member updates own details", () => m1().doc("registrations/r_hist").update({ mobile: "0917" }));
await ok("member pledges a donation", () => m1().doc("registrations/r_hist").update({ donation: { cashPledge: 500, inKind: "10 notebooks" }, updatedAt: FV.serverTimestamp() }));
await ok("member withdraws a pledge", () => m1().doc("registrations/r_hist").update({ donation: null }));
await no("member cannot record their own donation as received", () => m1().doc("registrations/r_hist").update({ donationReceived: { cash: 500, items: "", receivedBy: "me" } }));
await no("member cannot clear a no-show mark", () => m1().doc("registrations/r_hist").update({ noShow: false }));
await no("pledge with extra fields denied", () => m1().doc("registrations/r_hist").update({ donation: { cashPledge: 500, received: true } }));
await no("negative cash pledge denied", () => m1().doc("registrations/r_hist").update({ donation: { cashPledge: -5, inKind: "" } }));
await ok("member registers with a pledge", () => m1().collection("registrations").add({ ...baseReg, donation: { cashPledge: 300, inKind: "" } }));
await no("member cannot register as already-received donor", () => m1().collection("registrations").add({ ...baseReg, donationReceived: { cash: 300 } }));
await ok("admin records a received donation", () => admin().doc("registrations/r_hist").update({ donationReceived: { cash: 500, items: "", receivedBy: "Lead" } }));
await ok("admin edits payment", () => admin().doc("registrations/r_hist").update({ paymentStatus: "verified", amountPaid: 1 }));

console.log("Firestore: roster, private, feedback, analytics");
await seed();
await ok("registrant reads climbPrivate", () => m1().doc("climbPrivate/c1").get());
await no("non-registrant denied climbPrivate", () => m2().doc("climbPrivate/c1").get());
await ok("registrant of an unmigrated climb reads climbPrivate", () => m2().doc("climbPrivate/c2").get());
await no("non-registrant of an unmigrated climb denied", () => m1().doc("climbPrivate/c2").get());
await no("member denied climbInternal", () => m1().doc("climbInternal/c1").get());
await ok("admin reads climbInternal", () => admin().doc("climbInternal/c1").get());
await ok("public still reads climbs", () => anon().doc("climbs/c1").get());
const fb = { climbId: "c1", climbTitle: "Pulag", userId: "m1", name: "Juan", rating: 5, comments: "great", createdAt: FV.serverTimestamp() };
await ok("registrant leaves feedback", () => m1().doc("feedback/c1_m1").set(fb));
await no("non-registrant feedback denied", () => m2().doc("feedback/c1_m2").set({ ...fb, userId: "m2" }));
await seed();
await no("oversized feedback denied", () => m1().doc("feedback/c1_m1").set({ ...fb, comments: "x".repeat(3000) }));
const pv = { path: "/", climbId: null, userId: null, userRole: "guest", sessionId: "s", timestamp: FV.serverTimestamp() };
await ok("guest page view with expireAt", () => anon().collection("pageViews").add({ ...pv, expireAt: TS.fromMillis(Date.now() + 90 * 864e5) }));
await ok("guest page view without expireAt", () => anon().collection("pageViews").add(pv));
await no("page view expireAt 5y out denied", () => anon().collection("pageViews").add({ ...pv, expireAt: TS.fromMillis(Date.now() + 5 * 365 * 864e5) }));
await ok("failed request with expireAt", () => anon().collection("failedRequests").add({ type: "client", source: "x", message: "m", userId: null, createdAt: FV.serverTimestamp(), expireAt: TS.fromMillis(Date.now() + 90 * 864e5) }));
await no("member cannot self-promote", () => m1().doc("users/m1").update({ role: "admin" }));

console.log("Storage");
const png = new Uint8Array([137, 80, 78, 71]);
const sm1 = () => env.authenticatedContext("m1", { email: "m1@x.com" }).storage();
const sm2 = () => env.authenticatedContext("m2", { email: "m2@x.com" }).storage();
const sad = () => env.authenticatedContext("admin", { email: "a@x.com", admin: true }).storage();
await ok("member uploads own receipt", () => sm1().ref("payment-proofs/c1/m1/1_r.png").put(png, { contentType: "image/png" }));
await ok("member reads own receipt", () => sm1().ref("payment-proofs/c1/m1/1_r.png").getMetadata());
await no("other member cannot read it", () => sm2().ref("payment-proofs/c1/m1/1_r.png").getMetadata());
await no("other member cannot list folder", () => sm2().ref("payment-proofs/c1/m1").listAll());
await ok("admin reads it", () => sad().ref("payment-proofs/c1/m1/1_r.png").getMetadata());
await no("member cannot overwrite own receipt", () => sm1().ref("payment-proofs/c1/m1/1_r.png").put(png, { contentType: "image/png" }));
await no("member cannot upload into another's folder", () => sm2().ref("payment-proofs/c1/m1/2_r.png").put(png, { contentType: "image/png" }));
await ok("admin uploads for walk-in", () => sad().ref("payment-proofs/c1/reg123/1_r.pdf").put(png, { contentType: "application/pdf" }));
await ok("docx medical cert allowed", () => sm1().ref("medical-cert-uploads/c1/m1/1_m.docx").put(png, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
await no("html upload denied", () => sm1().ref("medical-cert-uploads/c1/m1/1_m.html").put(png, { contentType: "text/html" }));
await no("member cannot replace GCash QR", () => sm1().ref("gcash-qr/c1/qr.png").put(png, { contentType: "image/png" }));
await ok("admin sets GCash QR", () => sad().ref("gcash-qr/c1/qr.png").put(png, { contentType: "image/png" }));
await ok("public reads GCash QR", () => env.unauthenticatedContext().storage().ref("gcash-qr/c1/qr.png").getMetadata());
await ok("admin uploads then deletes template", async () => { await sad().ref("permit-templates/c1/t.pdf").put(png, { contentType: "application/pdf" }); await sad().ref("permit-templates/c1/t.pdf").delete(); });

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
