"use strict";

const mockWarn = jest.fn();
jest.mock("firebase-functions/logger", () => ({ warn: (...a) => mockWarn(...a) }));
jest.mock("firebase-functions/v2/https", () => ({ onRequest: (_opts, handler) => handler }));

const { normalize, cspReport } = require("../src/cspReport");

const res = () => {
  const r = { statusCode: 0, end: jest.fn() };
  r.status = jest.fn((code) => {
    r.statusCode = code;
    return r;
  });
  return r;
};

describe("normalize", () => {
  it("reads the legacy csp-report body", () => {
    expect(
      normalize({
        "csp-report": {
          "violated-directive": "script-src",
          "blocked-uri": "https://evil.example/x.js",
          "document-uri": "https://app/",
        },
      }),
    ).toEqual([{ directive: "script-src", blocked: "https://evil.example/x.js", page: "https://app/", source: undefined }]);
  });

  it("reads Reporting API batches and ignores other report types", () => {
    const out = normalize([
      { type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "data:x", documentURL: "https://app/" } },
      { type: "deprecation", body: {} },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].directive).toBe("img-src");
  });

  it("caps a batch and clips long values", () => {
    const many = Array.from({ length: 50 }, () => ({ "csp-report": { "blocked-uri": "x".repeat(1000) } }));
    const out = normalize(many);
    expect(out).toHaveLength(20);
    expect(out[0].blocked).toHaveLength(300);
  });

  it("returns nothing for junk", () => {
    expect(normalize(null)).toEqual([]);
    expect(normalize("nope")).toEqual([]);
  });
});

describe("cspReport", () => {
  it("logs each report and answers 204", () => {
    const r = res();
    cspReport({ method: "POST", body: { "csp-report": { "violated-directive": "frame-src" } } }, r);
    expect(mockWarn).toHaveBeenCalledWith("CSP violation", expect.objectContaining({ directive: "frame-src" }));
    expect(r.statusCode).toBe(204);
  });

  it("parses a raw body the platform didn't decode", () => {
    const r = res();
    const raw = Buffer.from(JSON.stringify({ "csp-report": { "violated-directive": "style-src" } }));
    cspReport({ method: "POST", body: raw, rawBody: raw }, r);
    expect(mockWarn).toHaveBeenCalledWith("CSP violation", expect.objectContaining({ directive: "style-src" }));
  });

  it("rejects anything but POST", () => {
    const r = res();
    cspReport({ method: "GET" }, r);
    expect(r.statusCode).toBe(405);
    expect(mockWarn).not.toHaveBeenCalled();
  });
});
