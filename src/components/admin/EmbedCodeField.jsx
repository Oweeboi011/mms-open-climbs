import { getAllTrailsEmbed, getKomootEmbed } from "@/utils/trailEmbeds";

const SITES = {
  alltrails: {
    label: "AllTrails Embed Code",
    placeholder:
      '<iframe class="alltrails" src="https://www.alltrails.com/widget/trail/..." ...></iframe>',
    hint: "On AllTrails: Share → Embed, then paste the code here. A trail link works too.",
    error: "That doesn't look like AllTrails embed code or a trail link.",
    parse: getAllTrailsEmbed,
  },
  komoot: {
    label: "Komoot Embed Code",
    placeholder:
      '<iframe src="https://www.komoot.com/tour/.../embed?..." ...></iframe>',
    hint: "On Komoot: Share → Embed, then paste the code here. A tour link works too.",
    error: "That doesn't look like Komoot embed code or a tour link.",
    parse: getKomootEmbed,
  },
};

// Textarea for a trail site's iframe embed code; flags input that won't embed.
export default function EmbedCodeField({ site, value, onChange }) {
  const { label, placeholder, hint, error, parse } = SITES[site];
  const invalid = Boolean(value?.trim()) && !parse(value);
  return (
    <div className="form-group trail-embed-field">
      <label className="form-label">{label}</label>
      <textarea
        className="form-input embed-code-input"
        rows={3}
        placeholder={placeholder}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalid ? (
        <div className="form-error-msg">{error}</div>
      ) : (
        <div className="form-hint">{hint}</div>
      )}
    </div>
  );
}
