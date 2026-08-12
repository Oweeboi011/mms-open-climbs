// Static reference content for the "New to Mountaineering?" intro modal on
// the landing page. Plain data (not markdown) so it renders with no
// sanitization concerns — see src/components/MountaineeringGuideModal.jsx.
// `icon` values must match a name in src/components/Icon.jsx.
export const MOUNTAINEERING_CHECKLIST = {
  id: "checklist",
  icon: "fileCheck",
  title: "Before You Join Your First Climb",
  items: [
    "Create your free MMS Open Climbs account.",
    "Browse the schedule and pick a climb that matches your experience — check its Difficulty and Trail Class first.",
    "Register, and complete the registration form / medical certificate if the climb requires one.",
    "Pay your climb fee via GCash and upload your payment proof.",
    'Prepare your gear — check the climb\'s "Things to Bring" list on the event page.',
    "Attend the pre-climb meeting — it's mandatory, no exceptions.",
    "Print and bring your signed waiver on climb day.",
    "Skim Leave No Trace below so you know the trail etiquette before you go.",
  ],
};

export const MOUNTAINEERING_GUIDE_SECTIONS = [
  {
    id: "difficulty",
    icon: "gauge",
    title: "Difficulty Levels",
    critical: true,
    paragraphs: [
      'MMS climbs use the standard **Philippine mountaineering difficulty scale**: a single score from **1/9** (easiest) to **9/9** (most difficult), combining trail condition, elevation gain, distance, water source availability, and terrain into one number. You\'ll see it on the event page as e.g. "5/9".',
    ],
    bullets: [
      "**1/9 — Very easy** (Beginner Friendly): resembles a hill more than a mountain; climbable by first-timers, even children, with basic guidance.",
      "**2/9 — Easy** (Beginner Friendly): minor elevation gain on generally clear, well-established trails.",
      "**3/9 — Fairly Moderate** (Moderate): trail and forest cover conditions may vary but nothing technical.",
      "**4/9 — Moderate** (Moderate): some steep sections and longer distance; may take a full day.",
      "**5/9 — Moderately Difficult** (Moderate): recommended for hikers with some prior experience; may involve a multi-day itinerary.",
      "**6/9 — Fairly Difficult** (Advanced): requires good physical fitness — longer trails with significant elevation gain.",
      "**7/9 — Difficult** (Advanced): long distances combined with steep, sustained ascents; only for experienced hikers.",
      "**8/9 — Very Difficult** (Advanced): extremely technical or remote terrain requiring advanced skill and endurance.",
      "**9/9 — Most Difficult** (Advanced): expedition-level climbs under extreme conditions; only for veteran mountaineers.",
    ],
    footnote:
      "The Beginner Friendly / Moderate / Advanced tag next to each score is the same badge shown on climb cards (1-3 Beginner Friendly, 4-5 Moderate, 6-9 Advanced). A climb's Trail Class (below) is a separate 1-6 scale for technical terrain — check both before you register.",
  },
  {
    id: "commitment",
    icon: "clock",
    title: "Commitment Rating",
    paragraphs: [
      "Commitment measures how much time, logistics, and exposure to risk a climb demands — separate from how physically hard it is. A short scramble can be low-difficulty but high-commitment if retreat is hard once you're on it.",
    ],
    bullets: [
      "**Low commitment** — a few hours, easy to turn back at any point, close to civilization.",
      "**Moderate commitment** — a full day or overnight, defined jump-off and exit points.",
      "**High commitment** — multi-day expedition, remote jump-off, limited bailout options once underway.",
    ],
    footnote:
      "Higher commitment climbs need more preparation: extra food and water buffer, backup gear, and an itinerary your emergency contact actually has a copy of.",
  },
  {
    id: "climb-type",
    icon: "backpack",
    title: "Climb Type",
    critical: true,
    paragraphs: [
      "MMS classifies each event as Minor, Major, or Special — this drives who it's suited for and what to prepare.",
    ],
    bullets: [
      "**Minor Climb** — beginner-friendly, typically a single day or overnight, good entry point for new members.",
      "**Major Climb** — longer, more demanding climbs for members with prior hiking/climbing experience.",
      "**Special Climb** — one-off or expedition-style events: traverses, technical routes, or out-of-the-ordinary destinations.",
    ],
  },
  {
    id: "trail-class",
    icon: "route",
    title: "Trail Class System",
    critical: true,
    paragraphs: [
      "Trail Class is a 1–6 scale describing the technical terrain you'll actually be moving through, independent of distance or elevation:",
    ],
    bullets: [
      "**Class 1** (Beginner Friendly) — Easy walking, flat paths, or smooth strolls with minimal risk.",
      "**Class 2** (Beginner Friendly) — Simple hiking on rugged terrain, dirt paths, or occasional loose rocks where you might use a hand for balance.",
      "**Class 3** (Moderate) — Scrambling; hands are frequently needed for balance on steep rock or uneven ground.",
      "**Class 4** (Moderate) — Climbing up easy cliffs or steep slopes with significant drop-offs; ropes are recommended for beginners.",
      "**Class 5** (Advanced) — Free-hand technical climbing or vertical scaling requiring specific holds and moves.",
      "**Class 6** (Advanced) — Extremely difficult terrain requiring artificial climbing gear, tools (like ice axes), or specialized equipment.",
    ],
    footnote:
      "This Beginner Friendly / Moderate / Advanced tag is the same badge shown on climb cards.",
  },
  {
    id: "foreign",
    icon: "globe",
    title: "A Note on Foreign Mountaineering",
    paragraphs: [
      "The ratings above are the convention MMS and most Philippine mountaineering clubs use. Climbing abroad, you'll run into different, formalized systems — the Yosemite Decimal System (YDS) in the US, the UIAA scale in Europe, or French/Alpine grades for multi-day routes. These aren't directly interchangeable with local Trail Class numbers.",
      "If a member is planning a climb outside the Philippines, don't assume local experience translates 1:1. Research the local rating system, permit requirements, and whether a certified local guide is mandatory — many foreign peaks require one regardless of your home experience level.",
    ],
  },
  {
    id: "lnt",
    icon: "leaf",
    title: "Leave No Trace",
    paragraphs: [
      "Leave No Trace (LNT) is the standard outdoor ethics framework every MMS climber is expected to follow, built around seven principles:",
    ],
    bullets: [
      "Plan ahead and prepare.",
      "Travel and camp on durable surfaces.",
      "Dispose of waste properly — pack it in, pack it out.",
      "Leave what you find; don't take plants, rocks, or artifacts.",
      "Minimize campfire impact.",
      "Respect wildlife — observe from a distance, never feed animals.",
      "Be considerate of other visitors and other groups on the trail.",
    ],
  },
  {
    id: "itinerary",
    icon: "map",
    title: "Why a Solid Itinerary Matters",
    critical: true,
    paragraphs: [
      "An itinerary isn't paperwork — it's **your team's safety net**. It tells rescuers where to look if something goes wrong, gives your emergency contact a timeline to worry about you against, and forces the team to think through water sources, campsites, and cutoff times before you're already on the mountain.",
      "A vague plan ('we'll figure it out on the trail') is how search-and-rescue timelines slip from hours to days. Every MMS climb publishes a detailed itinerary for exactly this reason — **read it, and make sure someone off the mountain has a copy too.**",
    ],
  },
  {
    id: "prehike",
    icon: "megaphone",
    title: "Pre-Climb Meetings Are Mandatory",
    critical: true,
    paragraphs: [
      "MMS holds a pre-climb meeting before every scheduled climb, and **attendance is required for every registered participant — no exceptions.** This is where the team reviews the itinerary, safety protocols, gear checklist, group assignments, and the latest weather outlook together.",
      "If you can't make the scheduled pre-climb meeting, **reach out to your climb officer before the event** — missing it without coordinating first can affect your slot.",
    ],
  },
];
