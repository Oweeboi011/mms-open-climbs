import { describe, it, expect } from "vitest";
import { buildParticipantList, participantListDiffers, shortName } from "@/utils/participantList";

describe("participant list", () => {
  it("shortens names to first name + last initial", () => {
    expect(shortName("Ana Maria Reyes")).toBe("Ana R.");
    expect(shortName("Ben")).toBe("Ben");
    expect(shortName("  ")).toBe("Participant");
  });
  it("lists only pending and confirmed registrants", () => {
    const list = buildParticipantList([
      { name: "Ana Reyes", memberType: "member", status: "confirmed" },
      { name: "Cara Lim", status: "cancelled" },
      { name: "Dan Cruz", status: "waitlisted" },
      { name: "Ben", memberType: "joiner", status: "pending" },
    ]);
    expect(list).toEqual([{ name: "Ana R.", memberType: "member" }, { name: "Ben", memberType: "joiner" }]);
  });
  it("detects a missing or stale list", () => {
    const next = [{ name: "Ana R.", memberType: "member" }];
    expect(participantListDiffers(undefined, next)).toBe(true);
    expect(participantListDiffers([], next)).toBe(true);
    expect(participantListDiffers([{ name: "Ana R.", memberType: "member" }], next)).toBe(false);
  });
});
