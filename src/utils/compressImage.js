// Phone screenshots of GCash receipts and photos of medical certificates
// routinely arrive at 3–8 MB. Every one is stored for the season and
// downloaded each time an admin reviews it, so shrinking them before upload
// is the cheapest storage and bandwidth saving the app has.
//
// Downscales to fit MAX_DIMENSION and re-encodes as JPEG — still easily
// legible for a receipt or a certificate. PDFs, GIFs, SVGs, small images and
// anything the browser can't decode go up unchanged: compression is an
// optimisation, never a reason for an upload to fail.
const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.82;
const SKIP_BELOW_BYTES = 400 * 1024;
const COMPRESSIBLE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function compressImage(file) {
  if (!file || !COMPRESSIBLE_TYPES.includes(file.type)) return file;
  if (file.size < SKIP_BELOW_BYTES) return file;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // JPEG has no alpha; a transparent PNG would otherwise turn black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
