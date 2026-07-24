const MISSING_FIELD_CHECKS = [
  { label: "Elevation", test: (c) => !c.elevation },
  { label: "Trail Class", test: (c) => !c.trailClass },
  { label: "Difficulty", test: (c) => !c.difficulty },
  { label: "Round Trip Distance", test: (c) => !c.roundTripDistance },
  { label: "Jump-off Point", test: (c) => !c.jumpOff },
  { label: "Description", test: (c) => !c.description },
  { label: "Max Participants", test: (c) => !c.maxParticipants },
  {
    label: "Team Leader",
    test: (c) => !c.officers?.some((o) => /^team leader$/i.test(o.role || "")),
  },
  {
    label: "Senior Team Leader",
    test: (c) =>
      !c.officers?.some((o) =>
        /^(senior|sr\.?)\s*team leader$/i.test(o.role || ""),
      ),
  },
  {
    label: "Assistant Team Leader",
    test: (c) =>
      !c.officers?.some((o) =>
        /^(assistant|asst\.?)\s*team leader$/i.test(o.role || ""),
      ),
  },
  {
    label: "Scribe",
    test: (c) => !c.officers?.some((o) => /^scribe$/i.test(o.role || "")),
  },
  { label: "Itinerary", test: (c) => !c.itinerary?.length },
  { label: "Expenses", test: (c) => !c.expenses?.length },
  { label: "Trail Photos", test: (c) => !c.trailImages?.length },
  {
    label: "Trail Map (Google Maps link or coordinates)",
    test: (c) => !c.googleMapsUrl && !(c.mapLat && c.mapLng),
  },
  { label: "GCash Payment QR", test: (c) => !c.gcashQrUrl },
];

export function getMissingFields(climb) {
  return MISSING_FIELD_CHECKS.filter((f) => f.test(climb)).map(
    (f) => f.label,
  );
}
