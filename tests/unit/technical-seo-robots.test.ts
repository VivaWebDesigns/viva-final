import { describe, expect, it } from "vitest";
import { evaluateRobots } from "../../server/features/technical-seo/robots";

describe("technical SEO robots evaluation", () => {
  it("prefers the Googlebot group over wildcard rules", () => {
    const text = "User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nDisallow: /private\nAllow: /private/public\n";
    expect(evaluateRobots(text, "https://example.com/ordinary").allowed).toBe(true);
    expect(evaluateRobots(text, "https://example.com/private/page").allowed).toBe(false);
    expect(evaluateRobots(text, "https://example.com/private/public/page").allowed).toBe(true);
  });

  it("uses the longest matching rule and lets allow win an equal tie", () => {
    const text = "User-agent: Googlebot\nDisallow: /catalog\nAllow: /catalog/item\n";
    expect(evaluateRobots(text, "https://example.com/catalog/item/1").allowed).toBe(true);
  });

  it("supports wildcard and end-anchor matching", () => {
    const text = "User-agent: *\nDisallow: /*?preview=true$\n";
    expect(evaluateRobots(text, "https://example.com/page?preview=true").allowed).toBe(false);
    expect(evaluateRobots(text, "https://example.com/page?preview=true&x=1").allowed).toBe(true);
  });
});
