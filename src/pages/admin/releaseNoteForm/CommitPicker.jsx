import { useState } from "react";
import { callFunction } from "@/services/callables";
import LoadingSpinner from "@/components/LoadingSpinner";

// "Generate from Git History": lists commits since the last note's checkpoint
// and asks the server for a grouped draft up to the chosen one.
export default function CommitPicker({ sourceCommit, onDraft }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(null);
  const [selectedSha, setSelectedSha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  async function openPicker() {
    setOpen(true);
    setError("");
    setGenerateError("");
    if (options) return;
    setLoading(true);
    try {
      const result = await callFunction("getReleaseNoteCommitOptions");
      const commits = result?.commits || [];
      setOptions({ since: result?.since || null, commits });
      if (commits.length > 0) setSelectedSha(commits[0].sha);
    } catch (err) {
      setError(err?.message || "Failed to load commits.");
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (!selectedSha) return;
    setGenerating(true);
    setGenerateError("");
    try {
      const result = await callFunction("generateReleaseNoteDraft", { until: selectedSha });
      if (!result?.commitCount) {
        setGenerateError("No user-facing commits found in that range.");
        return;
      }
      onDraft(result);
      setOpen(false);
    } catch (err) {
      setGenerateError(err?.message || "Failed to generate draft.");
    } finally {
      setGenerating(false);
    }
  }

  const commits = options?.commits || [];

  return (
    <div className="admin-card">
      <div className="admin-card-title">Generate from Git History</div>
      {!open && (
        <button type="button" className="btn btn-outline btn-sm" onClick={openPicker}>
          Generate from Git History
        </button>
      )}
      {open && loading && <LoadingSpinner />}
      {open && !loading && error && <div className="alert alert-error">{error}</div>}
      {open && !loading && !error && (
        <>
          <p className="form-hint rn-picker-hint">
            {options?.since
              ? `Showing commits after the last release note's checkpoint (${options.since.slice(0, 7)}). Pick how far up to include:`
              : "No prior release note checkpoint found — showing recent commits. Pick how far up to include:"}
          </p>
          <div className="rn-picker-list">
            {commits.map((c) => (
              <label key={c.sha} className="rn-picker-option">
                <input
                  type="radio"
                  name="commitUntil"
                  value={c.sha}
                  checked={selectedSha === c.sha}
                  onChange={() => setSelectedSha(c.sha)}
                />
                <span className="rn-sha">{c.shortSha}</span>
                <span className="rn-picker-subject">{c.subject}</span>
              </label>
            ))}
            {commits.length === 0 && <div className="rn-picker-empty">No commits found.</div>}
          </div>
          {generateError && <div className="alert alert-error">{generateError}</div>}
          <div className="rn-picker-actions">
            <button type="button" className="btn btn-accent btn-sm" disabled={!selectedSha || generating} onClick={generate}>
              {generating ? "Generating…" : "Generate Draft"}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      )}
      {sourceCommit && !open && (
        <p className="form-hint">
          Draft generated up to commit <span className="rn-sha">{sourceCommit.slice(0, 7)}</span>. Review the title and
          body below before saving.
        </p>
      )}
    </div>
  );
}
