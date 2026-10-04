import { Link } from "react-router-dom";

export default function ClimbLoadError({ error }) {
  return (
    <main className="daysheet-page">
      <p className="alert alert-error">{error || "Climb not found."}</p>
      <Link to="/admin/climbs">Back to climbs</Link>
    </main>
  );
}
