export const LOCAL_FALCON_AUTOMATED_MAP_ZOOM = 160;
export const LOCAL_VISIBILITY_DEFAULT_MAP_ZOOM = 100;

export const LOCAL_VISIBILITY_CENTERED_MAP_POSITION = {
  x: 0,
  y: 0,
} as const;

export function getLocalFalconMapPresentation(automaticallyRetrieved: boolean) {
  return {
    mapZoom: automaticallyRetrieved
      ? LOCAL_FALCON_AUTOMATED_MAP_ZOOM
      : LOCAL_VISIBILITY_DEFAULT_MAP_ZOOM,
    mapPosition: LOCAL_VISIBILITY_CENTERED_MAP_POSITION,
  };
}
