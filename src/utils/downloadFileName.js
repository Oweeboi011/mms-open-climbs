// Builds names for files the browser saves to disk. Windows rejects
// \ / : * ? " < > | outright, so a climb titled `Mt. Apo: Kapatagan/Traverse`
// carries two illegal characters straight into a download name and the save
// silently mangles. Centralized here because the same title feeds both an
// archive's own name and the folder names inside it.
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/g;

// Keeps spaces and case — for names read inside an archive, where
// `Juan Cruz (reg-1)` beats `juan-cruz-reg-1`.
export function sanitizeFileNamePart(value, fallback = "file") {
  const cleaned = String(value ?? "")
    .replace(ILLEGAL_FILENAME_CHARS, "_")
    .replace(/\s+/g, " ")
    // Windows also drops trailing dots and spaces from a saved name.
    .replace(/^[.\s]+|[.\s]+$/g, "");
  return cleaned || fallback;
}

// Hyphenated form for the downloaded file itself, so it sits in the
// Downloads folder without spaces to quote around.
export function slugifyFileName(value, fallback = "download") {
  const slug = sanitizeFileNamePart(value, fallback)
    .replace(/[\s.]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

// `Mt. Pulag` + `requirement-docs` -> `Mt-Pulag-requirement-docs-2026-08-14.zip`.
// The date stamp keeps a re-download from landing as `... (1)` with nothing to
// tell the two apart. `date` is injectable so tests don't depend on today.
export function makeDatedDownloadName(
  baseName,
  suffix,
  extension,
  date = new Date(),
) {
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
  return `${slugifyFileName(baseName)}-${suffix}-${stamp}.${extension}`;
}
