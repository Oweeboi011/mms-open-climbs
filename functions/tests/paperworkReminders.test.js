"use strict";

const mockCreateNotification = jest.fn();
const mockSet = jest.fn();
jest.mock("../src/shared/registrationOps", () => ({
  createNotification: (...args) => mockCreateNotification(...args),
}));
jest.mock("../src/shared/admin", () => ({
  db: { collection: () => ({ doc: (id) => ({ set: (...args) => mockSet(id, ...args) }) }) },
}));

const { remindOutstandingPaperwork, clearPaperworkReminders } = require("../src/shared/paperworkReminders");
const { REQUIRED_DOC_TYPES } = require("../src/requiredDocTypes");

const medCert = REQUIRED_DOC_TYPES.find((d) => d.key === "medicalCert");

beforeEach(() => {
  mockCreateNotification.mockResolvedValue();
  mockSet.mockResolvedValue();
});

describe("remindOutstandingPaperwork", () => {
  it("reminds someone an officer added to sign their waiver", async () => {
    await remindOutstandingPaperwork({ userId: "u1", waiverSigned: false }, "r1", {}, "Kibungan");
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", type: "waiver_reminder", id: "waiver_r1", link: "/my-registrations" }),
    );
  });

  it("also reminds about each missing required document", async () => {
    await remindOutstandingPaperwork(
      { userId: "u1", waiverSigned: true },
      "r1",
      { [medCert.requiresField]: true },
      "Kibungan",
    );
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "document_reminder", id: `${medCert.notificationPrefix}_r1` }),
    );
  });

  it("says nothing when the paperwork is done or there's no account", async () => {
    await remindOutstandingPaperwork({ userId: "u1", waiverSigned: true }, "r1", {}, "Kibungan");
    await remindOutstandingPaperwork({ userId: null, waiverSigned: false }, "r2", {}, "Kibungan");
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});

describe("clearPaperworkReminders", () => {
  it("marks the waiver and document reminders read once done", async () => {
    await clearPaperworkReminders(
      { waiverSigned: false },
      { waiverSigned: true, [medCert.uploadField]: { url: "https://x" } },
      "r1",
    );
    expect(mockSet).toHaveBeenCalledWith(`${medCert.notificationPrefix}_r1`, { read: true }, { merge: true });
    expect(mockSet).toHaveBeenCalledWith("waiver_r1", { read: true }, { merge: true });
  });

  it("leaves reminders alone when nothing changed", async () => {
    await clearPaperworkReminders({ waiverSigned: false }, { waiverSigned: false }, "r1");
    expect(mockSet).not.toHaveBeenCalled();
  });
});
