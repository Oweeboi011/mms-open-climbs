// Admins paste either a trail link or the whole "Embed" iframe snippet that
// Komoot/AllTrails generate. Pull the URL out of a pasted snippet so only a
// URL is stored.
export function normalizeEmbedInput(input) {
  const raw = String(input || "").trim();
  if (!/<iframe/i.test(raw)) return raw;
  const src = raw.match(/src\s*=\s*["']([^"']+)["']/i)?.[1];
  return src ? src.replace(/&amp;/g, "&") : raw;
}

// Only https URLs on the given site's domain make it into an iframe, so a
// mistyped or malicious link never embeds an arbitrary page.
function parseSiteUrl(input, hostPattern) {
  let url;
  try {
    url = new URL(normalizeEmbedInput(input));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !hostPattern.test(url.hostname)) {
    return null;
  }
  return url;
}

// Keeps the share_token that private tours need.
export function getKomootEmbed(input) {
  const url = parseSiteUrl(input, /(^|\.)komoot\.(com|de)$/i);
  const tourId = url?.pathname.match(/\/tour\/(\d+)/)?.[1];
  if (!tourId) return null;

  const shareToken = url.searchParams.get("share_token");
  const pageParams = new URLSearchParams();
  if (shareToken) pageParams.set("share_token", shareToken);
  const embedParams = new URLSearchParams(pageParams);
  embedParams.set("layout", "classic");
  embedParams.set("profile", "1");

  const base = `https://www.komoot.com/tour/${tourId}`;
  const pageQuery = pageParams.toString();
  return {
    embedSrc: `${base}/embed?${embedParams}`,
    pageUrl: pageQuery ? `${base}?${pageQuery}` : base,
  };
}

// Accepts a trail page link or a /widget/trail/ embed src; keeps whatever
// query params AllTrails put on it (e.g. its share hash) and defaults to
// metric units.
export function getAllTrailsEmbed(input) {
  const url = parseSiteUrl(input, /(^|\.)alltrails\.com$/i);
  const trailPath = url?.pathname.match(/\/(?:widget\/)?trail\/(.+?)\/?$/)?.[1];
  if (!trailPath) return null;

  const embedParams = new URLSearchParams(url.search);
  if (!embedParams.has("u")) embedParams.set("u", "m");
  if (!embedParams.has("width")) embedParams.set("width", "100%");

  return {
    embedSrc: `https://www.alltrails.com/widget/trail/${trailPath}?${embedParams}`,
    pageUrl: `https://www.alltrails.com/trail/${trailPath}`,
  };
}
