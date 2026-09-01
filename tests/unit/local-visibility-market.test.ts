import { describe, expect, it } from "vitest";
import { resolveLocalVisibilityMarket } from "@shared/localVisibility";

describe("resolveLocalVisibilityMarket", () => {
  it("uses reverse-geocoded scan geography before the run market", () => {
    expect(resolveLocalVisibilityMarket({
      scanCity: "Monroe",
      scanState: "NC",
      prospectCity: "Waxhaw",
      prospectState: "NC",
      batchCity: "Charlotte",
      batchState: "NC",
    })).toEqual({ city: "Monroe", state: "NC", label: "Monroe, NC" });
  });

  it("uses prospect geography rather than the batch market when scan geography is absent", () => {
    expect(resolveLocalVisibilityMarket({
      scanCity: null,
      scanState: null,
      prospectCity: "Rock Hill",
      prospectState: "SC",
      batchCity: "Charlotte",
      batchState: "NC",
    })).toEqual({ city: "Rock Hill", state: "SC", label: "Rock Hill, SC" });
  });

  it("falls back to the batch market only when prospect geography is unavailable", () => {
    expect(resolveLocalVisibilityMarket({
      batchCity: "Charlotte",
      batchState: "NC",
    })).toEqual({ city: "Charlotte", state: "NC", label: "Charlotte, NC" });
  });

  it("does not combine a partial scan location with a different fallback location", () => {
    expect(resolveLocalVisibilityMarket({
      scanCity: "Monroe",
      scanState: null,
      prospectCity: "Fort Mill",
      prospectState: "SC",
      batchCity: "Charlotte",
      batchState: "NC",
    })).toEqual({ city: "Fort Mill", state: "SC", label: "Fort Mill, SC" });
  });
});
