/**
 * Tests for the required-document roll-up shown on the admin climb detail
 * page. The denominator is the interesting part: only the doc types a climb
 * switched on, and only registrants still on the climb, count towards it.
 */
import { describe, it, expect } from "vitest";
import { getDocCompliance } from "@/utils/docCompliance";

const uploaded = { url: "https://example.test/f.pdf", fileName: "f.pdf" };

describe("getDocCompliance", () => {
  it("reports nothing expected when the climb requires no documents", () => {
    const result = getDocCompliance({}, [{ id: "r1", status: "confirmed" }]);
    expect(result.types).toEqual([]);
    expect(result.expected).toBe(0);
    expect(result.submitted).toBe(0);
    expect(result.complete).toBe(false);
  });

  it("counts only the doc types the climb switched on", () => {
    const climb = { requiresMedicalCert: true };
    const result = getDocCompliance(climb, [
      { id: "r1", status: "confirmed", medicalCertUpload: uploaded },
      { id: "r2", status: "pending" },
    ]);
    expect(result.types).toHaveLength(1);
    expect(result.types[0].key).toBe("medicalCert");
    expect(result.submitted).toBe(1);
    expect(result.expected).toBe(2);
    expect(result.missing).toBe(1);
    expect(result.complete).toBe(false);
  });

  it("excludes cancelled registrants from the denominator", () => {
    const climb = { requiresMedicalCert: true };
    const result = getDocCompliance(climb, [
      { id: "r1", status: "confirmed", medicalCertUpload: uploaded },
      { id: "r2", status: "cancelled" },
    ]);
    expect(result.expected).toBe(1);
    expect(result.submitted).toBe(1);
    expect(result.complete).toBe(true);
  });

  it("sums across every required type and counts registrants still owing", () => {
    const climb = { requiresMedicalCert: true, requiresPermit: true };
    const result = getDocCompliance(climb, [
      {
        id: "r1",
        status: "confirmed",
        medicalCertUpload: uploaded,
        permitUpload: uploaded,
      },
      { id: "r2", status: "confirmed", medicalCertUpload: uploaded },
      { id: "r3", status: "pending" },
    ]);
    expect(result.expected).toBe(6);
    expect(result.submitted).toBe(3);
    expect(result.missing).toBe(3);
    // r2 owes a permit, r3 owes both — one complete registrant.
    expect(result.registrantsMissing).toBe(2);
  });

  it("ignores an upload with no url", () => {
    const climb = { requiresPermit: true };
    const result = getDocCompliance(climb, [
      { id: "r1", status: "confirmed", permitUpload: { fileName: "x.pdf" } },
    ]);
    expect(result.submitted).toBe(0);
  });

  it("handles a climb with no registrations yet", () => {
    const result = getDocCompliance({ requiresPermit: true }, []);
    expect(result.expected).toBe(0);
    expect(result.complete).toBe(false);
  });
});
