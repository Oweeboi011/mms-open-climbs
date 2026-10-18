import { describe, it, expect } from "vitest";
import { emailJobState } from "@/utils/releaseNoteEmail";

const NOW = 10_000_000;
const MIN = 60 * 1000;

describe("emailJobState", () => {
  it("is none without a job, and passes finished states through", () => {
    expect(emailJobState(null, NOW)).toBe("none");
    for (const status of ["done", "failed", "superseded"]) {
      expect(emailJobState({ status }, NOW)).toBe(status);
    }
  });

  it("keeps a sending job live while its heartbeat is recent", () => {
    expect(emailJobState({ status: "sending", queuedAt: NOW - 60 * MIN, heartbeatAt: NOW - 2 * MIN }, NOW)).toBe("sending");
  });

  it("calls a sending job stalled once its heartbeat is 15 minutes old", () => {
    expect(emailJobState({ status: "sending", queuedAt: NOW - 60 * MIN, heartbeatAt: NOW - 15 * MIN }, NOW)).toBe("stalled");
  });

  it("lets a queued job wait up to an hour", () => {
    expect(emailJobState({ status: "queued", queuedAt: NOW - 59 * MIN }, NOW)).toBe("queued");
    expect(emailJobState({ status: "queued", queuedAt: NOW - 60 * MIN }, NOW)).toBe("stalled");
  });

  it("falls back to createdAt when queuedAt is missing", () => {
    const createdAt = { toMillis: () => NOW - MIN };
    expect(emailJobState({ status: "queued", createdAt }, NOW)).toBe("queued");
  });
});
