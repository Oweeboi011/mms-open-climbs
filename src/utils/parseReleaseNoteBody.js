// Release note bodies are plain text. Notes generated from git history follow
// a "Heading\n- item\n- item" structure per paragraph block (see
// groupCommitsIntoChangelog in functions/src/index.js); notes written by hand
// are often just free-form paragraphs. This parses either shape so the page
// can render real headings/bullets while still showing plain notes as-is.
export function parseReleaseNoteBody(body) {
  if (!body) return [];

  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").filter((line) => line.trim() !== ""))
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const isBullet = (line) => /^[-*]\s+/.test(line.trim());
      const bulletLines = lines.filter(isBullet);

      if (bulletLines.length === lines.length) {
        return {
          type: "list",
          heading: null,
          items: lines.map((l) => l.trim().replace(/^[-*]\s+/, "")),
        };
      }

      if (!isBullet(lines[0]) && bulletLines.length === lines.length - 1) {
        return {
          type: "list",
          heading: lines[0].trim(),
          items: lines.slice(1).map((l) => l.trim().replace(/^[-*]\s+/, "")),
        };
      }

      return { type: "paragraph", text: lines.join("\n") };
    });
}

const SECTION_STYLE_KEYWORDS = [
  { match: /^new features?$/i, style: "feature" },
  { match: /^fix(es)?$/i, style: "fix" },
  { match: /^performance$/i, style: "performance" },
  { match: /^improvements?$/i, style: "improvement" },
];

export function releaseNoteSectionStyle(heading) {
  if (!heading) return "default";
  const found = SECTION_STYLE_KEYWORDS.find(({ match }) => match.test(heading.trim()));
  return found?.style || "default";
}
