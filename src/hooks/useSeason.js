import { useState } from "react";
import { climbMonthKey, defaultSeason, seasonYears } from "@/utils/climbGrouping";

// Admin lists show one season at a time once climbs span several years, so
// past seasons stop piling up. Opens on the season with the next climb still
// ahead; "all" shows everything.
export default function useSeason(climbs, { startWithAll = false } = {}) {
  const [chosen, setSeason] = useState(null);
  const seasons = seasonYears(climbs);
  const season =
    chosen && (chosen === "all" || seasons.includes(chosen))
      ? chosen
      : seasons.length > 1 && !startWithAll
        ? defaultSeason(climbs, seasons)
        : "all";
  const climbInSeason = (climb) =>
    season === "all" || (!!climb && climbMonthKey(climb).slice(0, 4) === season);
  return { season, seasons, setSeason, climbInSeason };
}
