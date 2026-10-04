/**
 * The service layer is the only code that touches Firebase (ADR 0004), so
 * its contract — plain `{ id, ...data }` objects out, never snapshots — is
 * what every page relies on.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDoc,
  getDocs,
  onSnapshot,
  where,
  writeBatch,
  getCountFromServer,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { makeSnapshot, makeQuerySnapshot } from "@tests/setup";
import { fetchDoc, fetchWhereIn, watchDoc, watchAll, countAll } from "@/services/firestore";
import { updateRegistrationsAtomically, countRegistrations } from "@/services/registrations";
import { getClimbPrivate, getClimbOfficerEmails } from "@/services/climbs";
import { uploadRegistrationFile } from "@/services/storage";
import { callFunction } from "@/services/callables";
import { localStore } from "@/services/browserStorage";

beforeEach(() => {
  getDoc.mockReset();
  getDocs.mockReset();
});

describe("firestore helpers", () => {
  it("returns the doc as a plain object keyed by the requested id", async () => {
    getDoc.mockResolvedValue(makeSnapshot("ignored", { title: "Pulag" }));
    await expect(fetchDoc("climbs", "c1")).resolves.toEqual({ id: "c1", title: "Pulag" });
  });

  it("returns null for a missing doc", async () => {
    getDoc.mockResolvedValue(makeSnapshot("c1", null));
    await expect(fetchDoc("climbs", "c1")).resolves.toBeNull();
  });

  it("splits `in` queries into chunks of 30 and flattens the results", async () => {
    getDocs.mockResolvedValue(makeQuerySnapshot([{ id: "a", data: { n: 1 } }]));
    const ids = Array.from({ length: 61 }, (_, i) => `id${i}`);
    const rows = await fetchWhereIn("auditLog", "targetId", ids);
    expect(getDocs).toHaveBeenCalledTimes(3);
    expect(where).toHaveBeenCalledWith("targetId", "in", ids.slice(0, 30));
    expect(rows).toHaveLength(3);
  });

  it("skips the read entirely for an empty id list", async () => {
    await expect(fetchWhereIn("auditLog", "targetId", [])).resolves.toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it("maps live doc and query snapshots to objects", () => {
    const onDoc = vi.fn();
    onSnapshot.mockImplementationOnce((_ref, cb) => cb(makeSnapshot("x", { a: 1 })));
    watchDoc("climbs", "c1", onDoc);
    expect(onDoc).toHaveBeenCalledWith({ id: "c1", a: 1 });

    const onList = vi.fn();
    onSnapshot.mockImplementationOnce((_q, cb) =>
      cb(makeQuerySnapshot([{ id: "r1", data: { s: "ok" } }])),
    );
    watchAll("registrations", [], onList);
    expect(onList).toHaveBeenCalledWith([{ id: "r1", s: "ok" }]);
  });

  it("unwraps aggregate counts", async () => {
    getCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 7 }) });
    await expect(countAll("users")).resolves.toBe(7);
  });
});

describe("registrations", () => {
  it("writes every patch in one batch", async () => {
    const batch = { update: vi.fn(), commit: vi.fn(() => Promise.resolve()) };
    writeBatch.mockReturnValueOnce(batch);
    await updateRegistrationsAtomically([
      { id: "a", patch: { x: 1 } },
      { id: "b", patch: { x: 2 } },
    ]);
    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("turns an equality filter into where clauses", async () => {
    getCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 2 }) });
    await expect(countRegistrations({ status: "pending" })).resolves.toBe(2);
    expect(where).toHaveBeenCalledWith("status", "==", "pending");
  });
});

describe("climbs", () => {
  it("resolves a denied climbPrivate read to null", async () => {
    getDoc.mockRejectedValueOnce(new Error("permission-denied"));
    await expect(getClimbPrivate("c1")).resolves.toBeNull();
  });

  it("defaults officer emails to an empty list", async () => {
    getDoc.mockResolvedValueOnce(makeSnapshot("c1", null));
    await expect(getClimbOfficerEmails("c1")).resolves.toEqual([]);
  });
});

describe("storage", () => {
  it("files a walk-in's upload under the registration id", async () => {
    const file = new File(["x"], "gcash.png", { type: "text/plain" });
    const result = await uploadRegistrationFile("payment-proofs", { id: "reg-1", climbId: "c1" }, file);
    expect(ref.mock.calls[0][1]).toMatch(/^payment-proofs\/c1\/reg-1\/\d+_gcash\.png$/);
    expect(uploadBytes).toHaveBeenCalled();
    expect(result).toEqual({ url: "https://example.com/file.jpg", fileName: "gcash.png" });
  });
});

describe("callables", () => {
  it("returns the callable's data", async () => {
    httpsCallable.mockReturnValueOnce(vi.fn(() => Promise.resolve({ data: { sent: 3 } })));
    await expect(callFunction("sendReleaseNoteEmail", { id: "n1" })).resolves.toEqual({ sent: 3 });
    expect(httpsCallable.mock.calls.at(-1)[1]).toBe("sendReleaseNoteEmail");
  });
});

describe("browserStorage", () => {
  it("degrades to nothing stored when storage throws (private mode)", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(localStore.get("k")).toBeNull();
    spy.mockRestore();
  });
});
