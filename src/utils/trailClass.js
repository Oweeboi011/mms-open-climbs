// YDS-style 1-6 technical difficulty scale used for climb.trailClass.
export const TRAIL_CLASS_LABELS = {
  1: "Easy walking",
  2: "Simple hiking",
  3: "Scrambling",
  4: "Easy climbing",
  5: "Technical climbing",
  6: "Extreme/technical terrain",
};

export const TRAIL_CLASS_DESCRIPTIONS = {
  1: "Easy walking, flat paths, or smooth strolls with minimal risk.",
  2: "Simple hiking on rugged terrain, dirt paths, or occasional loose rocks where you might use a hand for balance.",
  3: "Scrambling; hands are frequently needed for balance on steep rock or uneven ground.",
  4: "Climbing up easy cliffs or steep slopes with significant drop-offs; ropes are recommended for beginners.",
  5: "Free-hand technical climbing or vertical scaling requiring specific holds and moves.",
  6: "Extremely difficult terrain requiring artificial climbing gear, tools (like ice axes), or specialized equipment.",
};

export const TRAIL_CLASS_VALUES = [1, 2, 3, 4, 5, 6];

// Standard Philippine mountaineering difficulty scale used for
// climb.difficulty, stored as e.g. "4/9". Combines trail condition,
// elevation gain, distance, and water source availability into one
// composite score, independent of Trail Class (technical terrain).
export const DIFFICULTY_LABELS = {
  1: "Very easy",
  2: "Easy",
  3: "Beginner-friendly",
  4: "Moderate",
  5: "Moderately difficult",
  6: "Fairly difficult",
  7: "Difficult",
  8: "Very difficult",
  9: "Most difficult",
};

export const DIFFICULTY_DESCRIPTIONS = {
  1: "Resembles a hill more than a mountain; climbable by first-timers, even children, with basic guidance.",
  2: "Minor elevation gain on generally clear, well-established trails.",
  3: "Suited for beginners; trail and forest cover conditions may vary but nothing technical.",
  4: "Some steep sections and longer distance; may take a full day.",
  5: "Recommended for hikers with some prior experience; may involve a multi-day itinerary.",
  6: "Requires good physical fitness — longer trails with significant elevation gain.",
  7: "Long distances combined with steep, sustained ascents; only for experienced hikers.",
  8: "Extremely technical or remote terrain requiring advanced skill and endurance.",
  9: "Expedition-level climbs under extreme conditions; only for veteran mountaineers.",
};

export const DIFFICULTY_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Trail Class (1-6, technical terrain) and Difficulty (1-9, the standard
// Philippine composite trail/elevation/distance score) are independent
// ratings with different scales — each needs its own thresholds here.
// Shared by ClimbCard's public badge and the admin climbs table.
export function getExperienceLevel(climb) {
  const m =
    climb.difficulty && String(climb.difficulty).match(/(\d+)\s*\/\s*9/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n <= 2) return { label: "Beginner Friendly", color: "#2e7d32" };
    if (n <= 4) return { label: "Moderate", color: "#b8860b" };
    return { label: "Advanced", color: "#c0392b" };
  }
  return { label: "Not Yet Rated", color: "#9e9e9e" };
}
