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

export type LocalVisibilityReportSummary = {
  id: string;
  leadId: string;
  companyId: string;
  batchId: string;
  businessName: string;
  keyword: string;
  market: string;
  radius: string;
  gridSize: string;
  scanDate: string;
  averagePosition: string;
  reportUrl: string | null;
  hasSnapshot: boolean;
};

export type LocalVisibilityCompetitorGroup = {
  sourceReportId: string;
  competitors: LocalVisibilityReportSummary[];
};

export type LocalVisibilityReportLibrary = {
  ownReports: LocalVisibilityReportSummary[];
  competitorGroups: LocalVisibilityCompetitorGroup[];
};
