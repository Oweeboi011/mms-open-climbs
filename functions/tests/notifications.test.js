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
const userStore = {};
const regStore = {};
const climbUpdates = [];
let autoIdCounter = 0;

function resetStores() {
  for (const k of Object.keys(notifStore)) delete notifStore[k];
  for (const k of Object.keys(climbStore)) delete climbStore[k];
  for (const k of Object.keys(userStore)) delete userStore[k];
  for (const k of Object.keys(regStore)) delete regStore[k];
  climbUpdates.length = 0;
  autoIdCounter = 0;
}

function storeFor(col) {
  if (col === "climbs") return climbStore;
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
  },
}));

let createdHandler;
let updatedHandler;
let scheduleHandler;

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: (_opts, fn) => {
    createdHandler = fn;
    return fn;
  },
  onDocumentUpdated: (_opts, fn) => {
    updatedHandler = fn;
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

  it("emails confirmed participants a thank-you once a climb has ended, and only once", async () => {
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
    expect(climbUpdates).toContainEqual({
      path: "climbs/climb-1",
      patch: { thankYouSentAt: "SERVER_TS" },
    });
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
});
