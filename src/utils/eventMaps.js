import { getAllTrailsEmbed, getKomootEmbed } from "@/utils/trailEmbeds";

function parseGoogleMapsUrl(url) {
  if (!url) return null;
  let m = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+)z/);
  if (m) return { lat: m[1], lng: m[2], zoom: m[3] };
  m = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m) {
    const zm = url.match(/[?&]z=(\d+)/);
    return { lat: m[1], lng: m[2], zoom: zm ? zm[1] : "14" };
  }
  return null;
}

export function parseGoogleMapsPlace(url) {
  if (!url) return null;
  const m = url.match(/\/maps\/place\/([^/@?]+)/);
  if (m) return decodeURIComponent(m[1].replace(/\+/g, " "));
  return null;
}


// Support multiple alternate trail options (e.g. two routes up the same
// mountain) via climb.trailMaps; fall back to the single legacy
// googleMapsUrl/allTrailsUrl/komootUrl fields for climbs created before this
// existed.
export function getTrailMapEntries(climb) {
  if (climb.trailMaps?.length) return climb.trailMaps;
  if (!climb.googleMapsUrl && !climb.allTrailsUrl && !climb.komootUrl) {
    return [];
  }
  return [
    {
      label: "",
      googleMapsUrl: climb.googleMapsUrl,
      allTrailsUrl: climb.allTrailsUrl,
      komootUrl: climb.komootUrl,
    },
  ];
}

export function getTrailEmbeds(trail) {
  return {
    allTrails: getAllTrailsEmbed(trail?.allTrailsUrl),
    komoot: getKomootEmbed(trail?.komootUrl),
  };
}


export function getMapEmbed(googleMapsUrl, fallbackCoords) {
  const placeName = parseGoogleMapsPlace(googleMapsUrl);
  const parsed = parseGoogleMapsUrl(googleMapsUrl);
  const coords = parsed
    ? { lat: Number(parsed.lat), lng: Number(parsed.lng), zoom: parsed.zoom }
    : fallbackCoords || null;
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const embedSrc = placeName
    ? googleMapsApiKey
      ? `https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${encodeURIComponent(placeName)}`
      : `https://maps.google.com/maps?q=${encodeURIComponent(placeName)}&output=embed`
    : coords
      ? googleMapsApiKey
        ? `https://www.google.com/maps/embed/v1/view?key=${googleMapsApiKey}&center=${coords.lat},${coords.lng}&zoom=${coords.zoom}`
        : `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=${coords.zoom}&output=embed`
      : null;
  return { coords, embedSrc, placeName };
}

export function getClimbCoords(climb) {
  if (climb?.mapLat && climb?.mapLng) {
    return {
      lat: Number(climb.mapLat),
      lng: Number(climb.mapLng),
      zoom: climb.mapZoom || "14",
    };
  }

  const parsed = parseGoogleMapsUrl(climb?.googleMapsUrl);
  return parsed
    ? { lat: Number(parsed.lat), lng: Number(parsed.lng), zoom: parsed.zoom }
    : null;
}
