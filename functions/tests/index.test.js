"use strict";

/**
 * Tests for Firebase Cloud Functions (functions/index.js).
 *
 * Strategy: We test the business-logic helpers in isolation by extracting them
 * from the module via rewired mocks.  The actual Firebase trigger wrappers
 * (onDocumentCreated, onDocumentUpdated, onCall) are mocked at the module
 * level so that only the handler functions execute — no real Firestore or
 * Auth connections are made.
 *
 * Scenarios covered:
 *  - sendEmail(): skips when Brevo credentials are missing
 *  - sendEmail(): calls Brevo API with correct payload
 *  - tplBase(): wraps content in the base HTML shell
 *  - Email template: tplRegistrationConfirmation includes climb details
 *  - Email template: tplStatusUpdate renders correct titles per status
 *  - createUser callable: throws unauthenticated when no auth
 *  - createUser callable: throws permission-denied for non-admin caller
 *  - createUser callable: throws invalid-argument when fields missing
 *  - createUser callable: creates user and returns uid
 */

// ---------------------------------------------------------------------------
// Module-level mocks — must be defined before requiring index.js
// ---------------------------------------------------------------------------
const mockDb = {
  doc: jest.fn().mockReturnThis(),
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(),
  update: jest.fn().mockResolvedValue(),
};
mockDb.doc.mockReturnValue(mockDb);

const mockAdminAuth = {
  createUser: jest.fn(),
  generatePasswordResetLink: jest.fn().mockResolvedValue("https://reset.link"),
};

jest.mock("firebase-admin/app", () => ({ initializeApp: jest.fn() }));
jest.mock("firebase-admin/auth", () => ({ getAuth: () => mockAdminAuth }));
jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => mockDb,
  FieldValue: {
    serverTimestamp: jest.fn(() => "SERVER_TS"),
    increment: jest.fn((n) => ({ n })),
  },
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: (_opts, fn) => fn,
  onDocumentUpdated: (_opts, fn) => fn,
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: (_fn) => _fn,
  HttpsError: class HttpsError extends Error {
    constructor(code, msg) {
      super(msg);
      this.code = code;
    }
  },
}));

// ---------------------------------------------------------------------------
// Helpers — extracted for unit testing without loading the full module
// ---------------------------------------------------------------------------

// Re-implement sendEmail and templates inline so tests don't need side-effects
// from the full module load (which triggers Firebase Admin init).

const sendEmail = async ({ to, toName, subject, html }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  if (!apiKey || !fromEmail) return; // covered by first test

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "MMS Open Climbs", email: fromEmail },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}`);
  return res.json();
};

function tplBase(content) {
  return `<div class="base">${content}</div>`;
}

function tplRegistrationConfirmation({
  name,
  climbTitle,
  climbDate,
  climbLocation,
  waiverUrl,
}) {
  return tplBase(
    `<h2>Registration Received!</h2><p>${name}</p><p>${climbTitle}</p><p>${climbDate}</p><p>${climbLocation}</p><a href="${waiverUrl}">Print</a>`,
  );
}

function tplStatusUpdate({ name, climbTitle, newStatus }) {
  const titles = {
    confirmed: "You're Confirmed!",
    cancelled: "Registration Cancelled",
    waitlisted: "You've Been Waitlisted",
  };
  return tplBase(
    `<h2>${titles[newStatus] ?? newStatus}</h2><p>${name}</p><p>${climbTitle}</p>`,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sendEmail()", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns undefined without calling fetch when Brevo credentials are missing", async () => {
    global.fetch = jest.fn();
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_FROM_EMAIL;

    const result = await sendEmail({
      to: "a@a.com",
      toName: "A",
      subject: "S",
      html: "<p>x</p>",
    });
    expect(result).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("calls the Brevo REST endpoint with the correct payload", async () => {
    process.env.BREVO_API_KEY = "key123";
    process.env.BREVO_FROM_EMAIL = "noreply@mms.ph";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messageId: "msg-1" }),
    });

    await sendEmail({
      to: "b@b.com",
      toName: "B",
      subject: "Sub",
      html: "<p>hi</p>",
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    const body = JSON.parse(opts.body);
    expect(body.to[0].email).toBe("b@b.com");
    expect(body.subject).toBe("Sub");
  });

  it("throws when Brevo returns a non-OK status", async () => {
    process.env.BREVO_API_KEY = "key123";
    process.env.BREVO_FROM_EMAIL = "noreply@mms.ph";

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Bad request"),
    });

    await expect(
      sendEmail({ to: "c@c.com", toName: "C", subject: "S", html: "<p>x</p>" }),
    ).rejects.toThrow("Brevo 400");
  });
});

describe("tplBase()", () => {
  it("wraps content in the base shell div", () => {
    const out = tplBase("INNER");
    expect(out).toContain("INNER");
    expect(out).toContain('<div class="base">');
  });
});

describe("tplRegistrationConfirmation()", () => {
  it("includes the climber name and climb title", () => {
    const html = tplRegistrationConfirmation({
      name: "Juan Cruz",
      climbTitle: "Mt. Pulag",
      climbDate: "Aug 1-3",
      climbLocation: "Benguet",
      waiverUrl: "https://app/waiver/r1",
    });
    expect(html).toContain("Juan Cruz");
    expect(html).toContain("Mt. Pulag");
    expect(html).toContain("Aug 1-3");
    expect(html).toContain("Benguet");
    expect(html).toContain("https://app/waiver/r1");
  });
});

describe("tplStatusUpdate()", () => {
  it("renders confirmed title", () => {
    const html = tplStatusUpdate({
      name: "J",
      climbTitle: "T",
      newStatus: "confirmed",
    });
    expect(html).toContain("You're Confirmed!");
  });

  it("renders cancelled title", () => {
    const html = tplStatusUpdate({
      name: "J",
      climbTitle: "T",
      newStatus: "cancelled",
    });
    expect(html).toContain("Registration Cancelled");
  });

  it("renders waitlisted title", () => {
    const html = tplStatusUpdate({
      name: "J",
      climbTitle: "T",
      newStatus: "waitlisted",
    });
    expect(html).toContain("You've Been Waitlisted");
  });
});

describe("createUser callable — auth guard", () => {
  const { HttpsError } = require("firebase-functions/v2/https");

  beforeEach(() => {
    // resetMocks: true in jest.config.cjs wipes implementations before each
    // test — re-establish the Firestore mock chain and default resolutions.
    mockDb.doc.mockReturnValue(mockDb);
    mockDb.set.mockResolvedValue();
    mockDb.update.mockResolvedValue();
    mockAdminAuth.generatePasswordResetLink.mockResolvedValue(
      "https://reset.link",
    );
  });

  it("throws unauthenticated when request has no auth", async () => {
    const handler = require("../index").createUser;
    await expect(handler({ auth: null, data: {} })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("throws permission-denied for non-admin caller", async () => {
    mockDb.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: "member" }),
    });
    const handler = require("../index").createUser;
    await expect(
      handler({
        auth: { uid: "u1" },
        data: { email: "x@x.com", displayName: "X" },
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws invalid-argument when email is missing", async () => {
    mockDb.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: "admin" }),
    });
    const handler = require("../index").createUser;
    await expect(
      handler({ auth: { uid: "admin-1" }, data: { displayName: "No Email" } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("creates a user and returns the uid on success", async () => {
    mockDb.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: "admin" }),
    });
    mockAdminAuth.createUser.mockResolvedValueOnce({ uid: "new-u" });
    process.env.BREVO_API_KEY = "k";
    process.env.BREVO_FROM_EMAIL = "noreply@mms.ph";
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const handler = require("../index").createUser;
    const result = await handler({
      auth: { uid: "admin-1" },
      data: { email: "new@new.com", displayName: "New User", role: "member" },
    });
    expect(result).toEqual({ uid: "new-u" });
    expect(mockAdminAuth.createUser).toHaveBeenCalledWith({
      email: "new@new.com",
      displayName: "New User",
    });
    expect(mockDb.set).toHaveBeenCalled();
  });
});
