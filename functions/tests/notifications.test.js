"use strict";

/**
 * Tests for the notification-related Cloud Functions added alongside the
 * in-app notification bell: onRegistrationCreated / onRegistrationUpdated's
 * notification branches, and the sendReminderNotifications scheduled job.
 *
 * Uses a small in-memory fake Firestore (path-routed maps) instead of the
 * flat single-object mock in index.test.js, since these handlers exercise
 * db.collection().where().get() and multi-collection reads that the simpler
 * mock doesn't support.
 */

const notifStore = {};
const climbStore = {};
const climbPrivateStore = {};
const userStore = {};
const regStore = {};
const climbUpdates = [];
let autoIdCounter = 0;

function resetStores() {
  for (const k of Object.keys(notifStore)) delete notifStore[k];
  for (const k of Object.keys(climbStore)) delete climbStore[k];
  for (const k of Object.keys(climbPrivateStore)) delete climbPrivateStore[k];
  for (const k of Object.keys(userStore)) delete userStore[k];
  for (const k of Object.keys(regStore)) delete regStore[k];
  climbUpdates.length = 0;
  autoIdCounter = 0;
}

function storeFor(col) {
  if (col === "climbs") return climbStore;
  if (col === "climbPrivate") return climbPrivateStore;
  if (col === "users") return userStore;
  if (col === "registrations") return regStore;
  return notifStore;
}

function docRef(path) {
  const [col, id] = path.split("/");
  const store = storeFor(col);
  return {
    get: async () => ({
      exists: store[id] !== undefined,
      data: () => store[id],
    }),
    update: async (patch) => {
      climbUpdates.push({ path, patch });
    },
    set: async (payload, opts) => {
      store[id] = opts?.merge ? { ...(store[id] || {}), ...payload } : payload;
    },
    delete: async () => {
      delete store[id];
    },
  };
}

function collectionRef(name) {
  const store = storeFor(name);
  return {
    doc: (id) => docRef(`${name}/${id}`),
    add: async (payload) => {
      const id = `auto${autoIdCounter++}`;
      store[id] = payload;
      return { id };
    },
    where: (field, op, value) => ({
      get: async () => {
        const entries = Object.entries(store).filter(([, data]) => {
          if (op === "==") return data[field] === value;
          if (op === "in") return Array.isArray(value) && value.includes(data[field]);
          return true;
        });
        return { docs: entries.map(([id, data]) => ({ id, data: () => data })) };
      },
    }),
  };
}

const mockDb = {
  doc: jest.fn((path) => docRef(path)),
  collection: jest.fn((name) => collectionRef(name)),
};

jest.mock("firebase-admin/app", () => ({ initializeApp: jest.fn() }));
jest.mock("firebase-admin/auth", () => ({ getAuth: () => ({}) }));
jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => mockDb,
  FieldValue: {
    serverTimestamp: jest.fn(() => "SERVER_TS"),
    increment: jest.fn((n) => ({ __increment: n })),
    arrayUnion: jest.fn((...vals) => ({ __arrayUnion: vals })),
    arrayRemove: jest.fn((...vals) => ({ __arrayRemove: vals })),
  },
}));

let createdHandler;
let updatedHandler;
let climbUpdatedHandler;
let deletedHandler;
let scheduleHandler;

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: (_opts, fn) => {
    createdHandler = fn;
    return fn;
  },
  onDocumentUpdated: (opts, fn) => {
    if (opts.document === "climbs/{climbId}") {
      climbUpdatedHandler = fn;
    } else {
      updatedHandler = fn;
    }
    return fn;
  },
  onDocumentDeleted: (_opts, fn) => {
    deletedHandler = fn;
    return fn;
  },
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (_opts, fn) => {
    scheduleHandler = fn;
    return fn;
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: (...args) => (args.length === 2 ? args[1] : args[0]),
  HttpsError: class HttpsError extends Error {
    constructor(code, msg) {
      super(msg);
      this.code = code;
    }
  },
}));

require("../src/index");
const { FieldValue } = require("firebase-admin/firestore");

beforeEach(() => {
  resetStores();
  // jest.config.cjs sets resetMocks: true, which strips mock implementations
  // (not just call history) before every test — re-establish them here.
  mockDb.doc.mockImplementation((path) => docRef(path));
  mockDb.collection.mockImplementation((name) => collectionRef(name));
  FieldValue.serverTimestamp.mockImplementation(() => "SERVER_TS");
  FieldValue.increment.mockImplementation((n) => ({ __increment: n }));
  FieldValue.arrayUnion.mockImplementation((...vals) => ({ __arrayUnion: vals }));
  FieldValue.arrayRemove.mockImplementation((...vals) => ({ __arrayRemove: vals }));
  process.env.BREVO_API_KEY = "k";
  process.env.BREVO_FROM_EMAIL = "noreply@mms.ph";
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  });
});

describe("onRegistrationCreated", () => {
  it("does nothing when the climb no longer exists", async () => {
    await createdHandler({
      data: { data: () => ({ name: "Juan", email: "juan@x.com", climbId: "missing" }) },
      params: { regId: "reg-1" },
    });
    expect(climbUpdates).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("increments registrationCount, creates a payment reminder, and emails the registrant + admins", async () => {
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      dateLabel: "Aug 1-3",
      location: "Benguet",
      officers: [],
    };
    userStore["admin-1"] = { role: "admin", email: "admin@mms.ph", displayName: "Admin" };

    await createdHandler({
      data: {
        data: () => ({
          name: "Juan Cruz",
          email: "juan@x.com",
          climbId: "climb-1",
          userId: "user-1",
          paymentStatus: "unpaid",
        }),
      },
      params: { regId: "reg-1" },
    });

    expect(climbUpdates).toContainEqual({
      path: "climbs/climb-1",
      patch: { registrationCount: { __increment: 1 } },
    });
    expect(notifStore["payment_reg-1"]).toMatchObject({
      userId: "user-1",
      type: "payment_reminder",
    });
    expect(global.fetch).toHaveBeenCalled();
  });

  it("adds the registrant to registeredUserIds on creation", async () => {
    climbStore["climb-1"] = { title: "Mt. Pulag", officers: [] };
    await createdHandler({
      data: {
        data: () => ({
          name: "Juan Cruz",
          climbId: "climb-1",
          userId: "user-1",
          status: "pending",
        }),
      },
      params: { regId: "reg-1" },
    });
    expect(climbUpdates).toContainEqual({
      path: "climbs/climb-1",
      patch: { registeredUserIds: { __arrayUnion: ["user-1"] } },
    });
  });

  it("increments docsCompleteCount when the registrant already satisfies all required docs", async () => {
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      officers: [],
      requiresRegistrationForm: true,
    };
    await createdHandler({
      data: {
        data: () => ({
          climbId: "climb-1",
          userId: "user-1",
          status: "pending",
          registrationFormUpload: { url: "https://x/form.pdf" },
        }),
      },
      params: { regId: "reg-1" },
    });
    expect(climbUpdates).toContainEqual({
      path: "climbs/climb-1",
      patch: { docsCompleteCount: { __increment: 1 } },
    });
  });

  it("does not increment docsCompleteCount when a required doc is missing", async () => {
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      officers: [],
      requiresRegistrationForm: true,
    };
    await createdHandler({
      data: {
        data: () => ({ climbId: "climb-1", userId: "user-1", status: "pending" }),
      },
      params: { regId: "reg-1" },
    });
    expect(
      climbUpdates.some((u) => "docsCompleteCount" in u.patch),
    ).toBe(false);
  });

  it("notifies about missing required documents on creation", async () => {
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      officers: [],
      requiresRegistrationForm: true,
      requiresMedicalCert: true,
    };
    userStore["admin-1"] = { role: "admin", email: "admin@mms.ph", displayName: "Admin" };

    await createdHandler({
      data: {
        data: () => ({
          name: "Juan Cruz",
          email: "juan@x.com",
          climbId: "climb-1",
          userId: "user-1",
          paymentStatus: "unpaid",
        }),
      },
      params: { regId: "reg-1" },
    });

    expect(notifStore["regform_reg-1"]).toMatchObject({
      userId: "user-1",
      type: "document_reminder",
      title: "Registration form still needed",
    });
    expect(notifStore["medcert_reg-1"]).toMatchObject({
      userId: "user-1",
      type: "document_reminder",
      title: "Medical certificate still needed",
    });
  });

  it("does not nag about documents that were already uploaded", async () => {
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      officers: [],
      requiresRegistrationForm: true,
    };
    userStore["admin-1"] = { role: "admin", email: "admin@mms.ph", displayName: "Admin" };

    await createdHandler({
      data: {
        data: () => ({
          name: "Juan Cruz",
          email: "juan@x.com",
          climbId: "climb-1",
          userId: "user-1",
          paymentStatus: "verified",
          registrationFormUpload: { url: "https://x/form.pdf", fileName: "form.pdf" },
        }),
      },
      params: { regId: "reg-1" },
    });

    expect(notifStore["regform_reg-1"]).toBeUndefined();
  });

  it("skips the confirmation email and payment reminder for admin-added walk-ins with no email/userId", async () => {
    climbStore["climb-1"] = { title: "Mt. Pulag", officers: [] };
    userStore["admin-1"] = { role: "admin", email: "admin@mms.ph", displayName: "Admin" };

    await createdHandler({
      data: {
        data: () => ({
          name: "Walk-in Joiner",
          email: "",
          climbId: "climb-1",
          userId: null,
          paymentStatus: "unpaid",
        }),
      },
      params: { regId: "reg-2" },
    });

    expect(notifStore["payment_reg-2"]).toBeUndefined();
    // Only the admin-notification email should have gone out, not a member confirmation.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("onRegistrationUpdated", () => {
  it("marks the payment reminder read and notifies when payment is verified", async () => {
    notifStore["payment_reg-1"] = { read: false };
    climbStore["climb-1"] = { title: "Mt. Pulag", officers: [] };

    await updatedHandler({
      data: {
        before: { data: () => ({ status: "pending", paymentStatus: "submitted", climbId: "climb-1", userId: "user-1" }) },
        after: { data: () => ({ status: "pending", paymentStatus: "verified", climbId: "climb-1", userId: "user-1", climbTitle: "Mt. Pulag" }) },
      },
      params: { regId: "reg-1" },
    });

    expect(notifStore["payment_reg-1"].read).toBe(true);
    const created = Object.values(notifStore).find((n) => n.type === "payment_verified");
    expect(created).toBeTruthy();
  });

  it("clears every admin's payment_submitted notification once the payment is verified", async () => {
    userStore["admin-1"] = { role: "admin", email: "admin1@mms.ph" };
    userStore["admin-2"] = { role: "admin", email: "admin2@mms.ph" };
    notifStore["submitted_reg-1_admin-1"] = { read: false, type: "payment_submitted" };
    notifStore["submitted_reg-1_admin-2"] = { read: false, type: "payment_submitted" };
    climbStore["climb-1"] = { title: "Mt. Pulag", officers: [] };

    await updatedHandler({
      data: {
        before: { data: () => ({ status: "pending", paymentStatus: "submitted", climbId: "climb-1", userId: "user-1" }) },
        after: { data: () => ({ status: "pending", paymentStatus: "verified", climbId: "climb-1", userId: "user-1", climbTitle: "Mt. Pulag" }) },
      },
      params: { regId: "reg-1" },
    });

    expect(notifStore["submitted_reg-1_admin-1"].read).toBe(true);
    expect(notifStore["submitted_reg-1_admin-2"].read).toBe(true);
  });

  it("clears every admin's payment_submitted notification once the payment is rejected", async () => {
    userStore["admin-1"] = { role: "admin", email: "admin1@mms.ph" };
    notifStore["submitted_reg-1_admin-1"] = { read: false, type: "payment_submitted" };
    climbStore["climb-1"] = { title: "Mt. Pulag", officers: [] };

    await updatedHandler({
      data: {
        before: { data: () => ({ status: "pending", paymentStatus: "submitted", climbId: "climb-1", userId: "user-1" }) },
        after: { data: () => ({ status: "pending", paymentStatus: "rejected", climbId: "climb-1", userId: "user-1", climbTitle: "Mt. Pulag" }) },
      },
      params: { regId: "reg-1" },
    });

    expect(notifStore["submitted_reg-1_admin-1"].read).toBe(true);
  });

  it("clears the document reminder once a required upload is submitted", async () => {
    notifStore["regform_reg-1"] = { read: false, type: "document_reminder" };
    notifStore["medcert_reg-1"] = { read: false, type: "document_reminder" };

    await updatedHandler({
      data: {
        before: {
          data: () => ({
            status: "pending",
            paymentStatus: "unpaid",
            climbId: "climb-1",
            userId: "user-1",
            registrationFormUpload: null,
            medicalCertUpload: null,
          }),
        },
        after: {
          data: () => ({
            status: "pending",
            paymentStatus: "unpaid",
            climbId: "climb-1",
            userId: "user-1",
            registrationFormUpload: { url: "https://x/form.pdf" },
            medicalCertUpload: null,
          }),
        },
      },
      params: { regId: "reg-1" },
    });

    expect(notifStore["regform_reg-1"].read).toBe(true);
    expect(notifStore["medcert_reg-1"].read).toBe(false);
  });

  it("re-opens the payment reminder when payment is rejected", async () => {
    climbStore["climb-1"] = { title: "Mt. Pulag", officers: [] };

    await updatedHandler({
      data: {
        before: { data: () => ({ status: "pending", paymentStatus: "submitted", climbId: "climb-1", userId: "user-1" }) },
        after: {
          data: () => ({
            status: "pending",
            paymentStatus: "rejected",
            climbId: "climb-1",
            userId: "user-1",
            climbTitle: "Mt. Pulag",
            adminNotes: "Amount mismatch",
          }),
        },
      },
      params: { regId: "reg-1" },
    });

    expect(notifStore["payment_reg-1"]).toMatchObject({
      read: false,
      type: "payment_reminder",
    });
  });

  it("notifies every admin when a member submits a payment", async () => {
    userStore["admin-1"] = { role: "admin", email: "admin1@mms.ph" };
    userStore["admin-2"] = { role: "admin", email: "admin2@mms.ph" };
    userStore["user-1"] = { role: "member", email: "juan@x.com" };

    await updatedHandler({
      data: {
        before: { data: () => ({ status: "pending", paymentStatus: "unpaid", climbId: "climb-1", userId: "user-1" }) },
        after: {
          data: () => ({
            status: "pending",
            paymentStatus: "submitted",
            climbId: "climb-1",
            userId: "user-1",
            climbTitle: "Mt. Pulag",
            name: "Juan Cruz",
            amountPaid: 500,
          }),
        },
      },
      params: { regId: "reg-1" },
    });

    expect(notifStore["submitted_reg-1_admin-1"]).toMatchObject({
      userId: "admin-1",
      type: "payment_submitted",
      link: "/admin/payments",
    });
    expect(notifStore["submitted_reg-1_admin-2"]).toMatchObject({
      userId: "admin-2",
      type: "payment_submitted",
    });
    expect(notifStore["submitted_reg-1_admin-1"].message).toMatch(/Juan Cruz/);
    expect(notifStore["submitted_reg-1_admin-1"].message).toMatch(/₱500/);
    // The member's own reminder notification is not an admin notification.
    expect(Object.values(notifStore).filter((n) => n.type === "payment_submitted")).toHaveLength(2);
  });

  it("clears admin notifications and re-nags the member when payment is reset to unpaid", async () => {
    userStore["admin-1"] = { role: "admin", email: "admin1@mms.ph" };
    notifStore["submitted_reg-1_admin-1"] = { read: false, type: "payment_submitted" };

    await updatedHandler({
      data: {
        before: { data: () => ({ status: "pending", paymentStatus: "submitted", climbId: "climb-1", userId: "user-1" }) },
        after: { data: () => ({ status: "pending", paymentStatus: "unpaid", climbId: "climb-1", userId: "user-1", climbTitle: "Mt. Pulag" }) },
      },
      params: { regId: "reg-1" },
    });

    expect(notifStore["submitted_reg-1_admin-1"].read).toBe(true);
    expect(notifStore["payment_reg-1"]).toMatchObject({
      userId: "user-1",
      type: "payment_reminder",
      title: "Payment status reset",
    });
  });

  it("does nothing when neither status nor paymentStatus changed", async () => {
    await updatedHandler({
      data: {
        before: { data: () => ({ status: "pending", paymentStatus: "unpaid" }) },
        after: { data: () => ({ status: "pending", paymentStatus: "unpaid" }) },
      },
      params: { regId: "reg-1" },
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(Object.keys(notifStore)).toHaveLength(0);
  });

  it("emails and notifies on confirmation, decrements count on cancellation", async () => {
    climbStore["climb-1"] = { title: "Mt. Pulag", officers: [] };
    userStore["admin-1"] = { role: "admin", email: "admin@mms.ph", displayName: "Admin" };

    await updatedHandler({
      data: {
        before: { data: () => ({ status: "pending", paymentStatus: "verified", climbId: "climb-1", userId: "user-1", name: "Juan", email: "juan@x.com" }) },
        after: { data: () => ({ status: "confirmed", paymentStatus: "verified", climbId: "climb-1", userId: "user-1", name: "Juan", email: "juan@x.com" }) },
      },
      params: { regId: "reg-1" },
    });

    const statusNotif = Object.values(notifStore).find((n) => n.type === "status_update");
    expect(statusNotif).toMatchObject({ title: "You're confirmed!" });
    expect(global.fetch).toHaveBeenCalled();

    global.fetch.mockClear();
    await updatedHandler({
      data: {
        before: { data: () => ({ status: "confirmed", paymentStatus: "verified", climbId: "climb-1", userId: "user-1", name: "Juan", email: "juan@x.com" }) },
        after: { data: () => ({ status: "cancelled", paymentStatus: "verified", climbId: "climb-1", userId: "user-1", name: "Juan", email: "juan@x.com" }) },
      },
      params: { regId: "reg-1" },
    });
    expect(climbUpdates).toContainEqual({
      path: "climbs/climb-1",
      patch: { registrationCount: { __increment: -1 } },
    });
  });

  it("removes the user from registeredUserIds when cancelled, and re-adds on reinstatement", async () => {
    climbStore["climb-1"] = { title: "Mt. Pulag", officers: [] };

    await updatedHandler({
      data: {
        before: { data: () => ({ status: "confirmed", climbId: "climb-1", userId: "user-1" }) },
        after: { data: () => ({ status: "cancelled", climbId: "climb-1", userId: "user-1" }) },
      },
      params: { regId: "reg-1" },
    });
    expect(climbUpdates).toContainEqual({
      path: "climbs/climb-1",
      patch: { registeredUserIds: { __arrayRemove: ["user-1"] } },
    });

    climbUpdates.length = 0;
    await updatedHandler({
      data: {
        before: { data: () => ({ status: "cancelled", climbId: "climb-1", userId: "user-1" }) },
        after: { data: () => ({ status: "pending", climbId: "climb-1", userId: "user-1" }) },
      },
      params: { regId: "reg-1" },
    });
    expect(climbUpdates).toContainEqual({
      path: "climbs/climb-1",
      patch: { registeredUserIds: { __arrayUnion: ["user-1"] } },
    });
  });

  it("does not touch registeredUserIds for a pending → confirmed transition", async () => {
    climbStore["climb-1"] = { title: "Mt. Pulag", officers: [] };
    await updatedHandler({
      data: {
        before: { data: () => ({ status: "pending", paymentStatus: "verified", climbId: "climb-1", userId: "user-1" }) },
        after: { data: () => ({ status: "confirmed", paymentStatus: "verified", climbId: "climb-1", userId: "user-1" }) },
      },
      params: { regId: "reg-1" },
    });
    expect(
      climbUpdates.some((u) => "registeredUserIds" in u.patch),
    ).toBe(false);
  });

  it("increments docsCompleteCount once the missing document is uploaded", async () => {
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      officers: [],
      requiresRegistrationForm: true,
    };
    await updatedHandler({
      data: {
        before: { data: () => ({ status: "pending", climbId: "climb-1", userId: "user-1" }) },
        after: {
          data: () => ({
            status: "pending",
            climbId: "climb-1",
            userId: "user-1",
            registrationFormUpload: { url: "https://x/form.pdf" },
          }),
        },
      },
      params: { regId: "reg-1" },
    });
    expect(climbUpdates).toContainEqual({
      path: "climbs/climb-1",
      patch: { docsCompleteCount: { __increment: 1 } },
    });
  });

  it("decrements docsCompleteCount when a compliant registrant is cancelled", async () => {
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      officers: [],
      requiresRegistrationForm: true,
    };
    await updatedHandler({
      data: {
        before: {
          data: () => ({
            status: "confirmed",
            climbId: "climb-1",
            userId: "user-1",
            registrationFormUpload: { url: "https://x/form.pdf" },
          }),
        },
        after: {
          data: () => ({
            status: "cancelled",
            climbId: "climb-1",
            userId: "user-1",
            registrationFormUpload: { url: "https://x/form.pdf" },
          }),
        },
      },
      params: { regId: "reg-1" },
    });
    expect(climbUpdates).toContainEqual({
      path: "climbs/climb-1",
      patch: { docsCompleteCount: { __increment: -1 } },
    });
  });

  it("does not touch docsCompleteCount for an unrelated field change (e.g. payment status)", async () => {
    climbStore["climb-1"] = { title: "Mt. Pulag", officers: [] };
    await updatedHandler({
      data: {
        before: { data: () => ({ status: "pending", paymentStatus: "submitted", climbId: "climb-1", userId: "user-1" }) },
        after: { data: () => ({ status: "pending", paymentStatus: "verified", climbId: "climb-1", userId: "user-1" }) },
      },
      params: { regId: "reg-1" },
    });
    expect(
      climbUpdates.some((u) => "docsCompleteCount" in u.patch),
    ).toBe(false);
  });
});

describe("onRegistrationDeleted", () => {
  it("removes the user from registeredUserIds when an active registration is deleted", async () => {
    await deletedHandler({
      data: { data: () => ({ climbId: "climb-1", userId: "user-1", status: "confirmed" }) },
      params: { regId: "reg-1" },
    });
    expect(climbUpdates).toContainEqual({
      path: "climbs/climb-1",
      patch: { registeredUserIds: { __arrayRemove: ["user-1"] } },
    });
  });

  it("does nothing when the deleted registration was already cancelled", async () => {
    await deletedHandler({
      data: { data: () => ({ climbId: "climb-1", userId: "user-1", status: "cancelled" }) },
      params: { regId: "reg-1" },
    });
    expect(climbUpdates).toHaveLength(0);
  });

  it("decrements docsCompleteCount when a compliant registration is hard-deleted", async () => {
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      requiresRegistrationForm: true,
    };
    await deletedHandler({
      data: {
        data: () => ({
          climbId: "climb-1",
          userId: "user-1",
          status: "confirmed",
          registrationFormUpload: { url: "https://x/form.pdf" },
        }),
      },
      params: { regId: "reg-1" },
    });
    expect(climbUpdates).toContainEqual({
      path: "climbs/climb-1",
      patch: { docsCompleteCount: { __increment: -1 } },
    });
  });
});

describe("onClimbUpdated", () => {
  it("notifies every active registrant when a new announcement is added", async () => {
    regStore["reg-1"] = { climbId: "climb-1", userId: "user-1", status: "pending" };
    regStore["reg-2"] = { climbId: "climb-1", userId: "user-2", status: "confirmed" };
    regStore["reg-cancelled"] = { climbId: "climb-1", userId: "user-3", status: "cancelled" };

    await climbUpdatedHandler({
      data: {
        before: { data: () => ({ title: "Mt. Pulag", announcements: [] }) },
        after: {
          data: () => ({
            title: "Mt. Pulag",
            announcements: [
              { message: "Bring extra water", pinned: false, createdAt: 1000 },
            ],
          }),
        },
      },
      params: { climbId: "climb-1" },
    });

    expect(notifStore["announcement_climb-1_1000_user-1"]).toMatchObject({
      userId: "user-1",
      type: "climb_announcement",
      message: "Bring extra water",
      link: "/event/climb-1",
    });
    expect(notifStore["announcement_climb-1_1000_user-2"]).toMatchObject({
      userId: "user-2",
    });
    expect(notifStore["announcement_climb-1_1000_user-3"]).toBeUndefined();
  });

  it("labels pinned announcements as reminders and skips ones already notified", async () => {
    regStore["reg-1"] = { climbId: "climb-1", userId: "user-1", status: "pending" };

    await climbUpdatedHandler({
      data: {
        before: {
          data: () => ({
            title: "Mt. Pulag",
            announcements: [{ message: "Old note", pinned: false, createdAt: 1000 }],
          }),
        },
        after: {
          data: () => ({
            title: "Mt. Pulag",
            announcements: [
              { message: "Old note", pinned: false, createdAt: 1000 },
              { message: "Trail closed on the north side", pinned: true, createdAt: 2000 },
            ],
          }),
        },
      },
      params: { climbId: "climb-1" },
    });

    expect(notifStore["announcement_climb-1_2000_user-1"]).toMatchObject({
      title: "New reminder — Mt. Pulag",
      message: "Trail closed on the north side",
    });
    expect(notifStore["announcement_climb-1_1000_user-1"]).toBeUndefined();
  });

  it("clears the document reminders for active registrants once a requirement is turned off", async () => {
    regStore["reg-1"] = { climbId: "climb-1", userId: "user-1", status: "pending" };
    regStore["reg-2"] = { climbId: "climb-1", userId: "user-2", status: "cancelled" };
    notifStore["regform_reg-1"] = { read: false, type: "document_reminder" };
    notifStore["medcert_reg-1"] = { read: false, type: "document_reminder" };
    notifStore["regform_reg-2"] = { read: false, type: "document_reminder" };

    await climbUpdatedHandler({
      data: {
        before: {
          data: () => ({
            title: "Mt. Pulag",
            requiresRegistrationForm: true,
            requiresMedicalCert: true,
            announcements: [],
          }),
        },
        after: {
          data: () => ({
            title: "Mt. Pulag",
            requiresRegistrationForm: false,
            requiresMedicalCert: true,
            announcements: [],
          }),
        },
      },
      params: { climbId: "climb-1" },
    });

    expect(notifStore["regform_reg-1"].read).toBe(true);
    // Medical cert requirement is still on, so its reminder stays untouched.
    expect(notifStore["medcert_reg-1"].read).toBe(false);
    // Cancelled registrants aren't touched either way.
    expect(notifStore["regform_reg-2"].read).toBe(false);
  });

  it("does nothing when announcements are unchanged", async () => {
    await climbUpdatedHandler({
      data: {
        before: { data: () => ({ announcements: [{ message: "x", createdAt: 1 }] }) },
        after: { data: () => ({ announcements: [{ message: "x", createdAt: 1 }] }) },
      },
      params: { climbId: "climb-1" },
    });
    expect(Object.keys(notifStore)).toHaveLength(0);
  });

  it("recounts docsCompleteCount against every active registrant when a requirement turns on", async () => {
    regStore["reg-1"] = {
      climbId: "climb-1",
      userId: "user-1",
      status: "confirmed",
      registrationFormUpload: { url: "https://x/form.pdf" },
    };
    regStore["reg-2"] = {
      climbId: "climb-1",
      userId: "user-2",
      status: "pending",
      // no upload — not compliant
    };
    regStore["reg-cancelled"] = {
      climbId: "climb-1",
      userId: "user-3",
      status: "cancelled",
      registrationFormUpload: { url: "https://x/form.pdf" },
    };

    await climbUpdatedHandler({
      data: {
        before: {
          data: () => ({ title: "Mt. Pulag", requiresRegistrationForm: false, announcements: [] }),
        },
        after: {
          data: () => ({ title: "Mt. Pulag", requiresRegistrationForm: true, announcements: [] }),
        },
      },
      params: { climbId: "climb-1" },
    });

    expect(climbUpdates).toContainEqual({
      path: "climbs/climb-1",
      patch: { docsCompleteCount: 1 },
    });
  });
});

describe("sendReminderNotifications", () => {
  it("nags unpaid/rejected registrants and reminds confirmed climbers 3 and 1 days out", async () => {
    regStore["reg-unpaid"] = {
      status: "pending",
      paymentStatus: "unpaid",
      userId: "user-1",
      climbId: "climb-1",
      climbTitle: "Mt. Pulag",
    };
    regStore["reg-3d"] = {
      status: "confirmed",
      paymentStatus: "verified",
      userId: "user-2",
      climbId: "climb-1",
      climbTitle: "Mt. Pulag",
      climbDate: "Aug 1-3",
    };
    regStore["reg-far"] = {
      status: "confirmed",
      paymentStatus: "verified",
      userId: "user-3",
      climbId: "climb-2",
      climbTitle: "Far Climb",
    };
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      startDate: { toDate: () => new Date(Date.now() + 3 * 86400000 - 60000) },
    };
    climbStore["climb-2"] = {
      title: "Far Climb",
      startDate: { toDate: () => new Date(Date.now() + 30 * 86400000) },
    };

    await scheduleHandler({});

    expect(notifStore["payment_reg-unpaid"]).toMatchObject({
      userId: "user-1",
      type: "payment_reminder",
    });
    expect(notifStore["upcoming3_reg-3d"]).toMatchObject({
      userId: "user-2",
      type: "upcoming_climb",
      link: "/event/climb-1",
    });
    expect(Object.keys(notifStore)).not.toContain("upcoming3_reg-far");
    expect(Object.keys(notifStore)).not.toContain("upcoming1_reg-far");
  });

  it("nags registrants missing a required registration form or medical cert, but not those who already uploaded", async () => {
    regStore["reg-missing"] = {
      status: "pending",
      paymentStatus: "verified",
      userId: "user-1",
      climbId: "climb-1",
      climbTitle: "Mt. Pulag",
    };
    regStore["reg-has-docs"] = {
      status: "confirmed",
      paymentStatus: "verified",
      userId: "user-2",
      climbId: "climb-1",
      climbTitle: "Mt. Pulag",
      registrationFormUpload: { url: "https://x/form.pdf" },
      medicalCertUpload: { url: "https://x/cert.pdf" },
    };
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      requiresRegistrationForm: true,
      requiresMedicalCert: true,
    };

    await scheduleHandler({});

    expect(notifStore["regform_reg-missing"]).toMatchObject({
      userId: "user-1",
      type: "document_reminder",
      title: "Registration form still needed",
    });
    expect(notifStore["medcert_reg-missing"]).toMatchObject({
      userId: "user-1",
      type: "document_reminder",
      title: "Medical certificate still needed",
    });
    expect(notifStore["regform_reg-has-docs"]).toBeUndefined();
    expect(notifStore["medcert_reg-has-docs"]).toBeUndefined();
  });

  it("reminds confirmed climbers 7 days out, flagging unpaid registrants but not paid ones", async () => {
    regStore["reg-7d-unpaid"] = {
      status: "confirmed",
      paymentStatus: "unpaid",
      userId: "user-1",
      climbId: "climb-1",
      climbTitle: "Mt. Pulag",
    };
    regStore["reg-7d-paid"] = {
      status: "confirmed",
      paymentStatus: "verified",
      userId: "user-2",
      climbId: "climb-1",
      climbTitle: "Mt. Pulag",
    };
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      startDate: { toDate: () => new Date(Date.now() + 7 * 86400000 - 60000) },
    };

    await scheduleHandler({});

    expect(notifStore["upcoming7_reg-7d-unpaid"]).toMatchObject({
      userId: "user-1",
      type: "upcoming_climb",
      title: "Your climb is in 7 days",
      link: "/event/climb-1",
    });
    expect(notifStore["upcoming7_reg-7d-unpaid"].message).toMatch(/haven't submitted payment/);
    expect(notifStore["upcoming7_reg-7d-paid"].message).not.toMatch(/haven't submitted payment/);
  });

  it("includes the pre-climb meeting details in the upcoming reminder when set", async () => {
    regStore["reg-3d"] = {
      status: "confirmed",
      paymentStatus: "verified",
      userId: "user-1",
      climbId: "climb-1",
      climbTitle: "Mt. Pulag",
    };
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      startDate: { toDate: () => new Date(Date.now() + 3 * 86400000 - 60000) },
    };
    climbPrivateStore["climb-1"] = {
      preClimbMeetingDate: "2026-07-30",
      preClimbMeetingTime: "6:00 PM",
      preClimbMeetingLocation: "MMS Clubhouse",
    };

    await scheduleHandler({});

    expect(notifStore["upcoming3_reg-3d"].message).toMatch(
      /Pre-climb meeting: July 30 at 6:00 PM — MMS Clubhouse/,
    );
  });

  it("emails confirmed participants a thank-you + feedback request once a climb has ended, and only once", async () => {
    regStore["reg-done"] = {
      status: "confirmed",
      paymentStatus: "verified",
      userId: "user-1",
      climbId: "climb-1",
      climbTitle: "Mt. Pulag",
      name: "Juan Cruz",
      email: "juan@x.com",
    };
    regStore["reg-cancelled"] = {
      status: "cancelled",
      paymentStatus: "verified",
      userId: "user-2",
      climbId: "climb-1",
      email: "cancelled@x.com",
    };
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      endDate: { toDate: () => new Date(Date.now() - 86400000) },
    };

    await scheduleHandler({});

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, opts] = global.fetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.to).toEqual([{ email: "juan@x.com", name: "Juan Cruz" }]);
    expect(body.htmlContent).toMatch(/Thank You, Juan Cruz/);
    expect(body.htmlContent).toMatch(/Share Your Feedback/);
    expect(body.htmlContent).toContain("/feedback/climb-1");
    expect(climbUpdates).toContainEqual({
      path: "climbs/climb-1",
      patch: { thankYouSentAt: "SERVER_TS" },
    });

    expect(notifStore["feedback_climb-1_user-1"]).toMatchObject({
      userId: "user-1",
      type: "feedback_request",
      link: "/feedback/climb-1",
    });
    expect(Object.keys(notifStore)).not.toContain("feedback_climb-1_user-2");
  });

  it("skips the thank-you email for climbs that already have thankYouSentAt or haven't ended", async () => {
    regStore["reg-already"] = {
      status: "confirmed",
      paymentStatus: "verified",
      userId: "user-1",
      climbId: "climb-1",
      name: "Juan Cruz",
      email: "juan@x.com",
    };
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      endDate: { toDate: () => new Date(Date.now() - 86400000) },
      thankYouSentAt: "SERVER_TS",
    };
    regStore["reg-future"] = {
      status: "confirmed",
      paymentStatus: "verified",
      userId: "user-2",
      climbId: "climb-2",
      name: "Ana",
      email: "ana@x.com",
    };
    climbStore["climb-2"] = {
      title: "Mt. Apo",
      endDate: { toDate: () => new Date(Date.now() + 86400000) },
    };

    await scheduleHandler({});

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("skips registrations with no linked user account", async () => {
    regStore["reg-walkin"] = {
      status: "confirmed",
      paymentStatus: "unpaid",
      userId: null,
      climbId: "climb-1",
    };
    await scheduleHandler({});
    expect(Object.keys(notifStore)).toHaveLength(0);
  });

  it("notifies officers (bell + email) when their climb has unpaid or missing-doc registrants", async () => {
    regStore["reg-1"] = {
      status: "pending",
      paymentStatus: "unpaid",
      userId: "user-1",
      climbId: "climb-1",
      climbTitle: "Mt. Pulag",
    };
    regStore["reg-2"] = {
      status: "confirmed",
      paymentStatus: "verified",
      userId: "user-2",
      climbId: "climb-1",
      climbTitle: "Mt. Pulag",
      registrationFormUpload: null,
    };
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      requiresRegistrationForm: true,
      officers: [
        { name: "Officer One", email: "officer1@mms.ph", userId: "officer-1" },
        { name: "Officer Two", email: "officer2@mms.ph" },
      ],
    };

    await scheduleHandler({});

    expect(notifStore["officer_outstanding_climb-1_officer-1"]).toMatchObject({
      userId: "officer-1",
      type: "officer_outstanding_summary",
      link: "/admin/climbs/climb-1",
    });
    expect(notifStore["officer_outstanding_climb-1_officer-1"].message).toMatch(
      /1 unpaid\/rejected registrant/,
    );
    // Both registrants lack a registrationFormUpload, so both count as
    // missing the required document (not just reg-2, which sets it null
    // explicitly — reg-1 simply never had the field at all).
    expect(notifStore["officer_outstanding_climb-1_officer-1"].message).toMatch(
      /2 missing required documents/,
    );

    // Both officers get an email (even the one without a linked userId).
    const emailCalls = global.fetch.mock.calls.filter(([, opts]) => {
      const body = JSON.parse(opts.body);
      return body.subject?.includes("Outstanding Registrant Items");
    });
    expect(emailCalls).toHaveLength(2);
  });

  it("does not notify officers when their climb has no outstanding items", async () => {
    regStore["reg-1"] = {
      status: "confirmed",
      paymentStatus: "verified",
      userId: "user-1",
      climbId: "climb-1",
      climbTitle: "Mt. Pulag",
    };
    climbStore["climb-1"] = {
      title: "Mt. Pulag",
      officers: [{ name: "Officer One", email: "officer1@mms.ph", userId: "officer-1" }],
    };

    await scheduleHandler({});

    expect(
      Object.values(notifStore).some((n) => n.type === "officer_outstanding_summary"),
    ).toBe(false);
  });
});
