import { describe, it, expect } from "vitest";
import {
  normalizeChannelId,
  CANONICAL_CHANNEL_IDS,
  CHANNEL_IDS,
} from "@shared/channels";

describe("normalizeChannelId", () => {
  it("passes through 'sales' unchanged", () => {
    expect(normalizeChannelId("sales")).toBe("sales");
  });

  it("passes through 'general' unchanged", () => {
    expect(normalizeChannelId("general")).toBe("general");
  });

  it("passes through 'onboarding' unchanged", () => {
    expect(normalizeChannelId("onboarding")).toBe("onboarding");
  });

  it("passes through 'dev' unchanged", () => {
    expect(normalizeChannelId("dev")).toBe("dev");
  });

  it("normalizes 'ventas' to 'sales'", () => {
    expect(normalizeChannelId("ventas")).toBe("sales");
  });

  it("normalizes 'Ventas' (case-insensitive) to 'sales'", () => {
    expect(normalizeChannelId("Ventas")).toBe("sales");
  });

  it("returns undefined for unknown slugs", () => {
    expect(normalizeChannelId("unknown")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(normalizeChannelId("")).toBeUndefined();
  });

  it("trims whitespace before normalizing", () => {
    expect(normalizeChannelId("  sales  ")).toBe("sales");
    expect(normalizeChannelId("  ventas  ")).toBe("sales");
  });

  it("normalizing 'ventas' produces the same canonical ID as 'sales'", () => {
    const fromVentas = normalizeChannelId("ventas");
    const fromSales  = normalizeChannelId("sales");
    expect(fromVentas).toBe(fromSales);
    expect(fromVentas).toBe(CHANNEL_IDS.sales);
  });
});

describe("CANONICAL_CHANNEL_IDS", () => {
  it("contains exactly four channels", () => {
    expect(CANONICAL_CHANNEL_IDS).toHaveLength(4);
  });

  it("includes all expected channels", () => {
    expect(CANONICAL_CHANNEL_IDS).toContain("general");
    expect(CANONICAL_CHANNEL_IDS).toContain("sales");
    expect(CANONICAL_CHANNEL_IDS).toContain("onboarding");
    expect(CANONICAL_CHANNEL_IDS).toContain("dev");
  });

  it("does NOT include legacy 'ventas'", () => {
    expect(CANONICAL_CHANNEL_IDS).not.toContain("ventas");
  });
});
