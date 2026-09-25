export default function SeasonSelect({ season, seasons, onChange }) {
  if (seasons.length < 2) return null;
  return (
    <label className="season-select">
      <span className="form-label">Season</span>
      <select
        className="form-select"
        value={season}
        onChange={(e) => onChange(e.target.value)}
      >
        {[...seasons].reverse().map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
        <option value="all">All seasons</option>
      </select>
    </label>
  );
}
