import "./DetailCell.css";
export default function DetailCell({ label, value }) {
  return (
    <div>
      <div className="detail-cell-label">{label}</div>
      <div className="detail-cell-value">{value || <span className="detail-cell-empty">Not set</span>}</div>
    </div>
  );
}
