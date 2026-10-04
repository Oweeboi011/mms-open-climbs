import { describe, it, expect, vi, afterEach } from "vitest";
import { compressImage } from "@/utils/compressImage";

function fakeFile(type, size, name = "receipt.png") {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("compressImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes PDFs through untouched", async () => {
    const pdf = fakeFile("application/pdf", 5_000_000, "receipt.pdf");
    expect(await compressImage(pdf)).toBe(pdf);
  });

  it("leaves small images alone", async () => {
    const small = fakeFile("image/png", 100_000);
    expect(await compressImage(small)).toBe(small);
  });

  it("passes undefined through, so optional document slots stay empty", async () => {
    expect(await compressImage(undefined)).toBeUndefined();
  });

  it("falls back to the original when the browser cannot decode images", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const big = fakeFile("image/jpeg", 5_000_000, "photo.jpg");
    expect(await compressImage(big)).toBe(big);
  });

  it("falls back to the original when decoding throws", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.reject(new Error("bad image"))));
    const big = fakeFile("image/jpeg", 5_000_000, "photo.jpg");
    expect(await compressImage(big)).toBe(big);
  });

  it("re-encodes a large image as a smaller JPEG", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.resolve({ width: 4000, height: 3000, close: vi.fn() })),
    );
    const ctx = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "" };
    const canvas = {
      getContext: () => ctx,
      toBlob: (cb) => cb(new Blob(["small"], { type: "image/jpeg" })),
    };
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) =>
      tag === "canvas" ? canvas : realCreate(tag),
    );

    const big = fakeFile("image/png", 5_000_000, "screenshot.png");
    const out = await compressImage(big);

    expect(out).not.toBe(big);
    expect(out.type).toBe("image/jpeg");
    expect(out.name).toBe("screenshot.jpg");
    expect(canvas.width).toBe(2000);
    expect(canvas.height).toBe(1500);
    document.createElement.mockRestore();
  });
});
