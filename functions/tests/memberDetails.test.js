"use strict";

const mockSet = jest.fn();
const mockDoc = jest.fn(() => ({ set: mockSet }));
jest.mock("../src/shared/admin", () => ({ db: { doc: mockDoc } }));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TS" },
}));
jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: (opts, fn) => fn,
}));

const {
  detailsFromRegistration,
  latestDetails,
} = require("../src/shared/memberDetails");
const { onRegistrationDetailsWritten } = require("../src/triggers/memberDetails");

const ts = (ms) => ({ toMillis: () => ms });
const reg = (extra = {}) => ({
  userId: "u1",
  climbTitle: "Kibungan Cross Country",
  mobile: "+63 917 000 0000",
  experienceLevel: "intermediate",
  memberType: "joiner",
  medicalConditions: "Asthma",
  emergencyContact: { name: "Ana", mobile: "+63 918 000 0000", relationship: "Sister" },
  ...extra,
});
const event = (before, after) => ({
  params: { regId: "r1" },
  data: {
    before: before ? { data: () => before } : undefined,
    after: after ? { data: () => after } : undefined,
  },
});

beforeEach(() => {
  mockSet.mockResolvedValue();
  mockDoc.mockImplementation(() => ({ set: mockSet }));
});

describe("detailsFromRegistration", () => {
  it("flattens the emergency contact and keeps only answered fields", () => {
    expect(detailsFromRegistration(reg({ address: "  ", dateOfBirth: "" }))).toEqual({
      mobile: "+63 917 000 0000",
      experienceLevel: "intermediate",
      memberType: "joiner",
      medicalConditions: "Asthma",
      ecName: "Ana",
      ecMobile: "+63 918 000 0000",
      ecRelationship: "Sister",
    });
  });

  it("returns nothing for a deleted account's scrubbed registration", () => {
    expect(detailsFromRegistration(reg({ accountDeletedAt: ts(1) }))).toEqual({});
  });
});

describe("latestDetails", () => {
  it("takes each field's most recent non-blank answer", () => {
    const result = latestDetails([
      reg({ createdAt: ts(3), climbTitle: "Pulag", mobile: "", address: "Baguio" }),
      reg({ createdAt: ts(1), climbTitle: "Batulao", address: "Manila", mobile: "+63 900 111 2222" }),
    ]);
    expect(result).toMatchObject({
      address: "Baguio",
      mobile: "+63 900 111 2222",
      sourceClimbTitle: "Pulag",
    });
  });

  it("lets the member's own answers win over a newer officer-added registration", () => {
    const result = latestDetails([
      reg({ createdAt: ts(1), climbTitle: "Pulag", memberType: "member", experienceLevel: "experienced" }),
      {
        userId: "u1",
        addedByAdmin: true,
        createdAt: ts(5),
        climbTitle: "Apo",
        memberType: "joiner",
        experienceLevel: "beginner",
        address: "Baguio",
      },
    ]);
    expect(result).toMatchObject({
      memberType: "member",
      experienceLevel: "experienced",
      address: "Baguio",
      sourceClimbTitle: "Pulag",
    });
  });

  it("returns null when no registration has any details", () => {
    expect(latestDetails([{ userId: "u1" }])).toBeNull();
  });
});

describe("onRegistrationDetailsWritten", () => {
  it("saves a new registration's details on the member's record", async () => {
    await onRegistrationDetailsWritten(event(null, reg()));
    expect(mockDoc).toHaveBeenCalledWith("memberDetails/u1");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ ecName: "Ana", sourceClimbTitle: "Kibungan Cross Country", updatedAt: "SERVER_TS" }),
      { merge: true },
    );
  });

  it("writes nothing when only payment or status changed", async () => {
    await onRegistrationDetailsWritten(event(reg(), reg({ paymentStatus: "verified", status: "confirmed" })));
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("saves edited details", async () => {
    await onRegistrationDetailsWritten(event(reg(), reg({ mobile: "+63 999 000 0000" })));
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ mobile: "+63 999 000 0000" }), { merge: true });
  });

  it("skips walk-ins with no account, deletions and deleted accounts", async () => {
    await onRegistrationDetailsWritten(event(null, reg({ userId: null })));
    await onRegistrationDetailsWritten(event(reg(), null));
    await onRegistrationDetailsWritten(event(reg(), reg({ accountDeletedAt: ts(1) })));
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("logs rather than throws when the save fails", async () => {
    mockSet.mockRejectedValueOnce(new Error("offline"));
    await expect(onRegistrationDetailsWritten(event(null, reg()))).resolves.toBeUndefined();
  });
});
