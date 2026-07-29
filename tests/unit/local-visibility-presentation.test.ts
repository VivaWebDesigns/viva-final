import { describe, expect, it } from "vitest";
import {
  getLocalFalconMapPresentation,
  LOCAL_FALCON_AUTOMATED_MAP_ZOOM,
  LOCAL_FALCON_CLOSE_RADIUS_MAP_ZOOM,
  LOCAL_VISIBILITY_DEFAULT_MAP_ZOOM,
} from "../../shared/localVisibility";

describe("Local Falcon map presentation", () => {
  it("applies the approved centered crop to automatically retrieved maps", () => {
    expect(getLocalFalconMapPresentation(true)).toEqual({
      mapZoom: LOCAL_FALCON_AUTOMATED_MAP_ZOOM,
      mapPosition: { x: 0, y: 0 },
    });
    expect(LOCAL_FALCON_AUTOMATED_MAP_ZOOM).toBe(160);
  });

  it("uses a wider crop for automatically retrieved scans at three miles or less", () => {
    expect(getLocalFalconMapPresentation(true, 3)).toEqual({
      mapZoom: LOCAL_FALCON_CLOSE_RADIUS_MAP_ZOOM,
      mapPosition: { x: 0, y: 0 },
    });
    expect(getLocalFalconMapPresentation(true, "2.5")).toEqual({
      mapZoom: LOCAL_FALCON_CLOSE_RADIUS_MAP_ZOOM,
      mapPosition: { x: 0, y: 0 },
    });
    expect(LOCAL_FALCON_CLOSE_RADIUS_MAP_ZOOM).toBe(150);
  });

  it("keeps the tighter crop for automatically retrieved scans above three miles", () => {
    expect(getLocalFalconMapPresentation(true, 5)).toEqual({
      mapZoom: LOCAL_FALCON_AUTOMATED_MAP_ZOOM,
      mapPosition: { x: 0, y: 0 },
    });
  });

  it("does not crop manually prepared fallback images a second time", () => {
    expect(getLocalFalconMapPresentation(false)).toEqual({
      mapZoom: LOCAL_VISIBILITY_DEFAULT_MAP_ZOOM,
      mapPosition: { x: 0, y: 0 },
    });
  });
});
