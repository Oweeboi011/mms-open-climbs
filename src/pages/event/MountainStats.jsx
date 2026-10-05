import TrailClassTile from "@/pages/event/TrailClassTile";

export default function MountainStats({ climb }) {
  return (
    <>
      {(climb.elevation ||
        climb.difficulty ||
        climb.distanceToSummit ||
        climb.roundTripDistance ||
        climb.recommendedDays ||
        climb.jumpOff) && (
        <div className="stat-tiles">
          {climb.elevation && (
            <div className="stat-tile">
              <div className="stat-tile-val">{climb.elevation}</div>
              <div className="stat-tile-label">MASL</div>
            </div>
          )}
          {climb.difficulty && (
            <div className="stat-tile">
              <div className="stat-tile-val">{climb.difficulty}</div>
              <div className="stat-tile-label">Difficulty</div>
            </div>
          )}
          {climb.trailClass && <TrailClassTile trailClass={climb.trailClass} />}
          {climb.distanceToSummit && (
            <div className="stat-tile">
              <div className="stat-tile-val">
                {climb.distanceToSummit}
              </div>
              <div className="stat-tile-label">Jump-off to Peak</div>
            </div>
          )}
          {climb.roundTripDistance && (
            <div className="stat-tile">
              <div className="stat-tile-val">
                {climb.roundTripDistance}
              </div>
              <div className="stat-tile-label">Round Trip</div>
            </div>
          )}
          {climb.elevationGain && (
            <div className="stat-tile stat-tile-green">
              <div className="stat-tile-val">{climb.elevationGain}</div>
              <div className="stat-tile-label">Elev. Gain</div>
            </div>
          )}
          {climb.recommendedDays && (
            <div className="stat-tile">
              <div className="stat-tile-val">
                {climb.recommendedDays}
              </div>
              <div className="stat-tile-label">Recommended</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
