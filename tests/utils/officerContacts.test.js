import { describe, it, expect } from "vitest";
import { splitOfficerEmails, mergeOfficerEmails } from "@/utils/officerContacts";

const officers = [
  { name: "Ana", role: "Team Leader", contact: "0917", email: "ana@mms.ph", userId: "u1" },
  { name: "Ben", role: "Sweeper", contact: "0918", email: "" },
];

describe("splitOfficerEmails", () => {
  it("keeps emails off the public officers and in an index-aligned private list", () => {
    const { publicOfficers, officerEmails } = splitOfficerEmails(officers);
    expect(publicOfficers).toEqual([
      { name: "Ana", role: "Team Leader", contact: "0917", userId: "u1" },
      { name: "Ben", role: "Sweeper", contact: "0918" },
    ]);
    expect(officerEmails).toEqual([
      { name: "Ana", email: "ana@mms.ph", userId: "u1" },
      { name: "Ben", email: "", userId: "" },
    ]);
  });

  it("handles a climb with no officers", () => {
    expect(splitOfficerEmails(undefined)).toEqual({ publicOfficers: [], officerEmails: [] });
  });
});

describe("mergeOfficerEmails", () => {
  it("restores emails by position for editing", () => {
    const { publicOfficers, officerEmails } = splitOfficerEmails(officers);
    expect(mergeOfficerEmails(publicOfficers, officerEmails)[0].email).toBe("ana@mms.ph");
  });

  it("prefers an email still on the public doc (not yet migrated)", () => {
    const merged = mergeOfficerEmails([{ name: "Ana", email: "old@mms.ph" }], [{ email: "new@mms.ph" }]);
    expect(merged[0].email).toBe("old@mms.ph");
  });
});
