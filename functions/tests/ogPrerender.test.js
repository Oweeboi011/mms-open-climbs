"use strict";

/**
 * Tests for the /event/** social-preview prerender (functions/src/ogPrerender.js).
 *
 * The interesting logic is pure — meta generation, escaping, truncation, shell
 * splicing, path matching — so it is tested directly. The onRequest wrapper is
 * mocked away at the module level; no Firestore or HTTP is touched.
 *
 * Scenarios covered:
 *  - makeMetaBlock: emits the title, description and OG/Twitter tags
 *  - Escaping: admin-entered titles cannot break out of content="…"
 *  - Hero image: heroImage → trailImages[0] → logo fallback, card type follows
 *  - Description: composed from type/location/elevation/date, truncated
 *  - buildHtml: splices the marked region, passes the shell through unchanged
 *    when the markers are missing
 *  - EVENT_PATH: matches only a single climb id segment
 */

jest.mock("firebase-functions/v2/https", () => ({
  onRequest: jest.fn((_opts, handler) => handler),
}));
jest.mock("firebase-functions/logger", () => ({
  error: jest.fn(),
  info: jest.fn(),
}));
jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(),
}));

const {
  makeMetaBlock,
  buildHtml,
  escapeAttr,
  truncate,
  buildDescription,
  heroImageFor,
  EVENT_PATH,
} = require("../src/ogPrerender");

const ORIGIN = "https://mms-open-climbs.web.app";
const URL = `${ORIGIN}/event/climb-1`;

const CLIMB = {
  title: "Mt. Pulag",
  dateLabel: "Aug 1-3",
  location: "Benguet",
  elevation: 2926,
  type: "major",
  description: "A three-day traverse to the highest peak in Luzon.",
  trailImages: ["https://cdn.example.com/pulag-1.jpg"],
};

/** Pull the value out of the first tag matching `attr="name"`. */
function contentOf(block, attr, name) {
  const re = new RegExp(`${attr}="${name}" content="([^"]*)"`);
  return re.exec(block)?.[1] ?? null;
}

describe("makeMetaBlock", () => {
  it("emits a title, description, canonical and the OG/Twitter block", () => {
    const block = makeMetaBlock(CLIMB, URL, ORIGIN);

    expect(block).toContain(
      "<title>Mt. Pulag — Aug 1-3 | MMS Open Climbs 2026</title>",
    );
    expect(contentOf(block, "property", "og:title")).toBe(
      "Mt. Pulag — Aug 1-3 | MMS Open Climbs 2026",
    );
    expect(contentOf(block, "property", "og:url")).toBe(URL);
    expect(contentOf(block, "property", "og:type")).toBe("article");
    expect(contentOf(block, "property", "og:site_name")).toBe(
      "MMS Open Climbs",
    );
    expect(contentOf(block, "property", "og:description")).toContain(
      "Major Climb · Benguet · 2926 MASL · Aug 1-3",
    );
    expect(block).toContain(`<link rel="canonical" href="${URL}" />`);
  });

  it("falls back to the site title when the climb has no title", () => {
    const block = makeMetaBlock({}, URL, ORIGIN);
    expect(block).toContain("<title>MMS Open Climbs 2026</title>");
  });
});

describe("escaping admin-entered text", () => {
  it("cannot break out of a content attribute or inject markup", () => {
    const block = makeMetaBlock(
      { ...CLIMB, title: 'Mt "Pulag" & <script>alert(1)</script>' },
      URL,
      ORIGIN,
    );

    expect(block).not.toContain("<script>");
    expect(block).not.toContain("alert(1)</script>");
    // Every content="…" value must be free of raw quotes and angle brackets.
    for (const [, value] of block.matchAll(/content="([^"]*)"/g)) {
      expect(value).not.toMatch(/[<>]/);
    }
    expect(contentOf(block, "property", "og:title")).toContain("&quot;Pulag");
  });

  it("escapes the five significant characters", () => {
    expect(escapeAttr(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("renders null and undefined as an empty string", () => {
    expect(escapeAttr(null)).toBe("");
    expect(escapeAttr(undefined)).toBe("");
  });
});

describe("hero image", () => {
  it("prefers heroImage over trailImages[0]", () => {
    expect(
      heroImageFor({ heroImage: "hero.jpg", trailImages: ["trail.jpg"] }),
    ).toBe("hero.jpg");
  });

  it("uses the first trail photo when there is no heroImage", () => {
    expect(heroImageFor({ trailImages: ["trail.jpg"] })).toBe("trail.jpg");
  });

  it("returns null when the climb has no imagery at all", () => {
    expect(heroImageFor({})).toBeNull();
  });

  it("uses a large-image card for a real trail photo", () => {
    const block = makeMetaBlock(CLIMB, URL, ORIGIN);
    expect(contentOf(block, "name", "twitter:card")).toBe(
      "summary_large_image",
    );
    expect(contentOf(block, "property", "og:image")).toBe(
      "https://cdn.example.com/pulag-1.jpg",
    );
  });

  it("falls back to the square logo and a small card", () => {
    // A square logo letterboxes badly in a large-image card.
    const block = makeMetaBlock({ title: "Mt. Pulag" }, URL, ORIGIN);
    expect(contentOf(block, "name", "twitter:card")).toBe("summary");
    expect(contentOf(block, "property", "og:image")).toBe(`${ORIGIN}/MMS.png`);
  });
});

describe("description", () => {
  it("composes the lead from type, location, elevation and date", () => {
    expect(buildDescription(CLIMB)).toBe(
      "Major Climb · Benguet · 2926 MASL · Aug 1-3. A three-day traverse to the highest peak in Luzon.",
    );
  });

  it("omits missing pieces rather than leaving empty separators", () => {
    expect(buildDescription({ location: "Rizal" })).toBe("Rizal");
  });

  it("truncates on a word boundary and does not exceed the cap", () => {
    const long = buildDescription({
      ...CLIMB,
      description: "word ".repeat(200),
    });
    expect(long.length).toBeLessThanOrEqual(201); // 200 + the ellipsis
    expect(long.endsWith("…")).toBe(true);
    expect(long).not.toMatch(/\s…$/);
  });

  it("leaves short text alone", () => {
    expect(truncate("short enough")).toBe("short enough");
  });

  it("collapses whitespace so previews stay on one line", () => {
    expect(truncate("a\n\n  b\tc")).toBe("a b c");
  });
});

describe("buildHtml", () => {
  const SHELL = `<head>\n<!--og-->\n<title>old</title>\n<!--/og-->\n<link rel="icon" />\n</head>`;

  it("replaces the marked region and keeps the rest of the shell", () => {
    const out = buildHtml(SHELL, "<title>new</title>");
    expect(out).toContain("<title>new</title>");
    expect(out).not.toContain("<title>old</title>");
    expect(out).not.toContain("<!--og-->");
    expect(out).toContain('<link rel="icon" />');
  });

  it("passes the shell through untouched when the markers are missing", () => {
    // Fails visibly (generic card) rather than emitting duplicate tags.
    const bare = "<head><title>only</title></head>";
    expect(buildHtml(bare, "<title>new</title>")).toBe(bare);
  });

  it("passes the shell through when the markers are out of order", () => {
    const inverted = `<head><!--/og--><!--og--></head>`;
    expect(buildHtml(inverted, "x")).toBe(inverted);
  });
});

describe("EVENT_PATH", () => {
  it("matches a single climb id and captures it", () => {
    expect(EVENT_PATH.exec("/event/abc123")?.[1]).toBe("abc123");
    expect(EVENT_PATH.exec("/event/abc123/")?.[1]).toBe("abc123");
    expect(EVENT_PATH.exec("/event/a_b-C9")?.[1]).toBe("a_b-C9");
  });

  it("rejects anything that is not exactly one id segment", () => {
    expect(EVENT_PATH.test("/event/")).toBe(false);
    expect(EVENT_PATH.test("/event")).toBe(false);
    expect(EVENT_PATH.test("/event/a/b")).toBe(false);
    expect(EVENT_PATH.test("/event/../../etc/passwd")).toBe(false);
    expect(EVENT_PATH.test("/event/abc?x=1")).toBe(false);
    expect(EVENT_PATH.test(`/event/${"a".repeat(65)}`)).toBe(false);
  });
});
