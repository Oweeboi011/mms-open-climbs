// A small, safe Markdown subset for text admins type into plain fields
// (climb announcements, release notes, guide copy). Returns React nodes,
// never raw HTML, so it's safe by construction — no
// dangerouslySetInnerHTML/sanitization needed.
//
// Inline (both renderers): **bold**, *italic* / _italic_, [label](url) and
// bare https:// links.
// Blocks (renderMarkdown only): paragraphs, # headings, - / 1. lists,
// --- dividers and | pipe | tables.
//
// No lookbehind in these patterns: older Safari can't parse it, and a regex
// syntax error here would take the whole event page down on those phones.

// Links come first in the alternation so underscores and asterisks inside
// a URL are never read as emphasis. Bold tolerates inner spaces
// ("** Heading **" is common in pasted text); italics must hug their text,
// so "5 * 3 * 2" stays literal.
const INLINE_RE =
  /\[([^\]\n]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"])|\*\*(.+?)\*\*|\*([^\s*](?:[^*\n]*[^\s*])?)\*|_([^\s_](?:[^_\n]*[^\s_])?)_/g;
// Underscore emphasis only at word boundaries, so snake_case names and
// IDs like ChIJfRD_5GNt keep their underscores.
const WORD_CHAR_RE = /[\p{L}\p{N}_]/u;
const SAFE_HREF_RE = /^(https?:\/\/|mailto:|tel:)/i;

function renderInline(text, opts, keyPrefix = "") {
  const nodes = [];
  const re = new RegExp(INLINE_RE.source, "g");
  let last = 0;
  let key = 0;
  let match;

  while ((match = re.exec(text))) {
    const [full, label, href, bareUrl, bold, italicStar, italicUnderscore] =
      match;
    const start = match.index;
    if (
      italicUnderscore !== undefined &&
      (WORD_CHAR_RE.test(text[start - 1] || "") ||
        WORD_CHAR_RE.test(text[start + full.length] || ""))
    ) {
      re.lastIndex = start + 1;
      continue;
    }
    if (start > last) nodes.push(text.slice(last, start));
    const k = `${keyPrefix}i${key++}`;

    if (label !== undefined) {
      const content = renderInline(label, opts, `${k}-`);
      nodes.push(
        opts.links && SAFE_HREF_RE.test(href) ? (
          <a key={k} href={href} target="_blank" rel="noopener noreferrer">
            {content}
          </a>
        ) : (
          <span key={k}>{content}</span>
        ),
      );
    } else if (bareUrl !== undefined) {
      nodes.push(
        opts.links ? (
          <a key={k} href={bareUrl} target="_blank" rel="noopener noreferrer">
            {bareUrl}
          </a>
        ) : (
          bareUrl
        ),
      );
    } else if (bold !== undefined) {
      nodes.push(
        <strong key={k}>{renderInline(bold.trim(), opts, `${k}-`)}</strong>,
      );
    } else {
      nodes.push(
        <em key={k}>
          {renderInline(italicStar ?? italicUnderscore, opts, `${k}-`)}
        </em>,
      );
    }
    last = start + full.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * Inline formatting only, for one-line contexts.
 * Pass `{ links: false }` where the text sits inside a clickable element
 * (e.g. a notification row), so a link isn't nested in a button.
 */
export function renderMarkdownLite(text, options) {
  if (!text) return text;
  return renderInline(text, { links: true, ...options });
}

const HR_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const HEADING_RE = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/;
const BOLD_LINE_RE = /^\s*\*\*([^*]+)\*\*\s*$/;
const UL_RE = /^\s*[-*•]\s+(.*)$/;
const OL_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function isTableStart(lines, i) {
  return (
    TABLE_ROW_RE.test(lines[i]) &&
    i + 1 < lines.length &&
    TABLE_SEP_RE.test(lines[i + 1])
  );
}

function isBlockStart(lines, i) {
  const line = lines[i];
  return (
    HR_RE.test(line) ||
    HEADING_RE.test(line) ||
    UL_RE.test(line) ||
    OL_RE.test(line) ||
    isTableStart(lines, i)
  );
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * Block-level rendering for multi-paragraph text such as announcements.
 * Line breaks inside a paragraph are kept as typed.
 */
export function renderMarkdown(text, options) {
  if (!text) return null;
  const opts = { links: true, ...options };
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = `b${blocks.length}`;

    if (!line.trim()) {
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      blocks.push(<hr key={key} />);
      i++;
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const Tag = heading[1].length === 1 ? "h4" : "h5";
      blocks.push(<Tag key={key}>{renderInline(heading[2], opts)}</Tag>);
      i++;
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && TABLE_ROW_RE.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={key} className="md-table-wrap">
          <table>
            <thead>
              <tr>
                {header.map((cell, c) => (
                  <th key={c}>{renderInline(cell, opts)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {header.map((_, c) => (
                    <td key={c}>{renderInline(row[c] || "", opts)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (UL_RE.test(line) || OL_RE.test(line)) {
      const ordered = !UL_RE.test(line);
      const itemRe = ordered ? OL_RE : UL_RE;
      const items = [];
      let startAt;
      while (i < lines.length && itemRe.test(lines[i])) {
        const m = lines[i].match(itemRe);
        if (ordered && startAt === undefined) startAt = Number(m[1]);
        items.push(ordered ? m[2] : m[1]);
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key} start={ordered && startAt !== 1 ? startAt : undefined}>
          {items.map((item, j) => (
            <li key={j}>{renderInline(item, opts)}</li>
          ))}
        </List>,
      );
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines, i)) {
      para.push(lines[i]);
      i++;
    }

    // A line that is nothing but bold text, standing on its own, is being
    // used as a subheading ("** 🍽️ MEALS **", "**Day 2 (Sept 20)**").
    const boldLine = para.length === 1 && para[0].match(BOLD_LINE_RE);
    if (boldLine) {
      blocks.push(<h5 key={key}>{renderInline(boldLine[1].trim(), opts)}</h5>);
      continue;
    }

    blocks.push(
      <p key={key}>
        {para.flatMap((l, j) =>
          j === 0
            ? renderInline(l, opts, `${j}-`)
            : [<br key={`br${j}`} />, ...renderInline(l, opts, `${j}-`)],
        )}
      </p>,
    );
  }

  return blocks;
}
