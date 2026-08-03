// Minimal **bold** / *italic* (or _italic_) inline formatting for plain-text
// fields (climb announcements, release notes) that don't warrant a full rich
// text editor. Returns React nodes, never raw HTML, so it's safe by
// construction — no dangerouslySetInnerHTML/sanitization needed.
const TOKEN_RE = /\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_/g;

export function renderMarkdownLite(text) {
  if (!text) return text;

  const nodes = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const [full, bold, italicStar, italicUnderscore] = match;
    if (bold !== undefined) {
      nodes.push(<strong key={key++}>{bold}</strong>);
    } else {
      nodes.push(<em key={key++}>{italicStar ?? italicUnderscore}</em>);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}
