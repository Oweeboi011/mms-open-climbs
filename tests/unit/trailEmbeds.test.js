import { describe, it, expect } from "vitest";
import {
  normalizeEmbedInput,
  getKomootEmbed,
  getAllTrailsEmbed,
} from "@/utils/trailEmbeds";

const KOMOOT_SNIPPET =
  '<iframe src="https://www.komoot.com/tour/3316356286/embed?share_token=abc123&amp;layout=classic&amp;profile=1" width="100%" height="700" frameborder="0" scrolling="no" allow="fullscreen" allowfullscreen></iframe>';

const ALLTRAILS_SNIPPET =
  '<iframe class="alltrails" src="https://www.alltrails.com/widget/trail/philippines/benguet/mount-pulag?u=m&amp;sh=xyz" width="100%" height="400" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" title="AllTrails: Trail Guides and Maps for Hiking, Camping, and Running"></iframe>';

describe("normalizeEmbedInput", () => {
  it("extracts and decodes the src from a pasted embed snippet", () => {
    expect(normalizeEmbedInput(KOMOOT_SNIPPET)).toBe(
      "https://www.komoot.com/tour/3316356286/embed?share_token=abc123&layout=classic&profile=1",
    );
  });

  it("leaves a plain URL untouched", () => {
    expect(normalizeEmbedInput("https://www.komoot.com/tour/1")).toBe(
      "https://www.komoot.com/tour/1",
    );
  });
});

describe("getKomootEmbed", () => {
  it("builds the embed from a pasted snippet, keeping the share token", () => {
    expect(getKomootEmbed(KOMOOT_SNIPPET)).toEqual({
      embedSrc:
        "https://www.komoot.com/tour/3316356286/embed?share_token=abc123&layout=classic&profile=1",
      pageUrl: "https://www.komoot.com/tour/3316356286?share_token=abc123",
    });
  });

  it("builds the embed from a localized tour link", () => {
    expect(getKomootEmbed("https://www.komoot.com/en-gb/tour/42?ref=wtd")).toEqual({
      embedSrc: "https://www.komoot.com/tour/42/embed?layout=classic&profile=1",
      pageUrl: "https://www.komoot.com/tour/42",
    });
  });

  it.each([
    [""],
    [undefined],
    ["not a url"],
    ["http://www.komoot.com/tour/42"],
    ["https://evil.example/tour/42"],
    ["https://komoot.com.evil.example/tour/42"],
    ["https://www.komoot.com/discover"],
  ])("rejects %s", (input) => {
    expect(getKomootEmbed(input)).toBeNull();
  });
});

describe("getAllTrailsEmbed", () => {
  it("turns a trail page link into the widget embed", () => {
    expect(
      getAllTrailsEmbed("https://www.alltrails.com/trail/philippines/trail-a"),
    ).toEqual({
      embedSrc:
        "https://www.alltrails.com/widget/trail/philippines/trail-a?u=m&width=100%25",
      pageUrl: "https://www.alltrails.com/trail/philippines/trail-a",
    });
  });

  it("uses a pasted embed snippet as-is, keeping its share hash", () => {
    expect(getAllTrailsEmbed(ALLTRAILS_SNIPPET)).toEqual({
      embedSrc:
        "https://www.alltrails.com/widget/trail/philippines/benguet/mount-pulag?u=m&sh=xyz&width=100%25",
      pageUrl: "https://www.alltrails.com/trail/philippines/benguet/mount-pulag",
    });
  });

  it.each([
    [""],
    ["http://www.alltrails.com/trail/philippines/trail-a"],
    ["https://alltrails.com.evil.example/trail/philippines/trail-a"],
    ["https://www.alltrails.com/explore"],
  ])("rejects %s", (input) => {
    expect(getAllTrailsEmbed(input)).toBeNull();
  });
});
