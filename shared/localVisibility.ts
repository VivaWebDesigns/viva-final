export const LOCAL_FALCON_AUTOMATED_MAP_ZOOM = 160;
export const LOCAL_FALCON_CLOSE_RADIUS_MAP_ZOOM = 140;
export const LOCAL_VISIBILITY_DEFAULT_MAP_ZOOM = 100;
const SERVICE_AREA_BUSINESS_LABEL = "Service Area Business";

export const LOCAL_VISIBILITY_CENTERED_MAP_POSITION = {
  x: 0,
  y: 0,
} as const;

export function getLocalFalconMapPresentation(
  automaticallyRetrieved: boolean,
  radiusMiles?: string | number | null,
) {
  const parsedRadius = Number(radiusMiles);
  const usesCloseRadiusFraming = automaticallyRetrieved
    && Number.isFinite(parsedRadius)
    && parsedRadius <= 3;
  return {
    mapZoom: automaticallyRetrieved
      ? usesCloseRadiusFraming
        ? LOCAL_FALCON_CLOSE_RADIUS_MAP_ZOOM
        : LOCAL_FALCON_AUTOMATED_MAP_ZOOM
      : LOCAL_VISIBILITY_DEFAULT_MAP_ZOOM,
    mapPosition: LOCAL_VISIBILITY_CENTERED_MAP_POSITION,
  };
}

export function formatLocalVisibilityReportAddress({
  address,
  city,
  state,
  zip,
}: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string {
  const normalizedAddress = address?.trim() ?? "";
  if (normalizedAddress.toLowerCase() === SERVICE_AREA_BUSINESS_LABEL.toLowerCase()) {
    return SERVICE_AREA_BUSINESS_LABEL;
  }

  return [normalizedAddress, city?.trim(), state?.trim(), zip?.trim()]
    .filter(Boolean)
    .join(", ")
    .replace(/, ([A-Z]{2}), /, ", $1 ");
}

export function formatLocalVisibilityAveragePosition(value: string | number | null | undefined): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text === "20+") return text;
  const numeric = Number(text);
  return Number.isFinite(numeric) && numeric >= 20 ? "20+" : text;
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

export type LocalFalconCompetitorBusiness = {
  rank: number;
  place_id: string;
  name: string;
  solv: number;
  found_points: number | null;
  reviews: number;
  rating: number;
  is_subject: boolean;
};

export type LocalVisibilityGoogleMapsComparisonRow = {
  rank: number | null;
  name: string;
  rating: number;
  reviewCount: number;
  topThreeVisibility: number | null;
  foundPoints: number | null;
  totalPoints: number | null;
  isSubject: boolean;
  relationship: "above" | "subject" | "below" | "returned";
};

export type LocalVisibilityGoogleMapsComparison = {
  subjectRank: number | null;
  totalBusinesses: number | null;
  businessesAheadCount: number | null;
  rows: LocalVisibilityGoogleMapsComparisonRow[];
};

export function buildGoogleMapsVisibilityComparison({
  subjectRank,
  totalBusinesses,
  businessesAheadCount,
  businesses,
  gridSize,
  subject,
}: {
  subjectRank: number | null;
  totalBusinesses: number | null;
  businessesAheadCount: number | null;
  businesses: LocalFalconCompetitorBusiness[];
  gridSize: number | null;
  subject: { name: string; rating: number; reviewCount: number };
}): LocalVisibilityGoogleMapsComparison | null {
  if (businesses.length === 0 && subjectRank === null) return null;

  const subjectIndexFromRank = subjectRank === null ? -1 : subjectRank - 1;
  const subjectIndex = businesses[subjectIndexFromRank]?.is_subject
    ? subjectIndexFromRank
    : businesses.findIndex((business) => business.is_subject);

  if (subjectIndex >= 0) {
    const start = Math.min(
      Math.max(0, subjectIndex - 1),
      Math.max(0, businesses.length - 3),
    );
    const rows = businesses.slice(start, start + 3).map((business, offset) => {
      const index = start + offset;
      return {
        rank: business.rank,
        name: business.name,
        rating: business.rating,
        reviewCount: business.reviews,
        topThreeVisibility: business.solv,
        foundPoints: business.found_points,
        totalPoints: gridSize ? gridSize * gridSize : null,
        isSubject: index === subjectIndex,
        relationship: index < subjectIndex
          ? "above" as const
          : index > subjectIndex
            ? "below" as const
            : "subject" as const,
      };
    });
    return {
      subjectRank: subjectRank ?? businesses[subjectIndex].rank,
      totalBusinesses: totalBusinesses ?? businesses.length,
      businessesAheadCount: businessesAheadCount ?? businesses[subjectIndex].rank - 1,
      rows,
    };
  }

  const returnedRows = businesses.slice(0, 2).map((business) => ({
    rank: business.rank,
    name: business.name,
    rating: business.rating,
    reviewCount: business.reviews,
    topThreeVisibility: business.solv,
    foundPoints: business.found_points,
    totalPoints: gridSize ? gridSize * gridSize : null,
    isSubject: false,
    relationship: "returned" as const,
  }));
  return {
    subjectRank: null,
    totalBusinesses: totalBusinesses ?? businesses.length,
    businessesAheadCount: null,
    rows: [
      ...returnedRows,
      {
        rank: null,
        name: subject.name,
        rating: subject.rating,
        reviewCount: subject.reviewCount,
        topThreeVisibility: 0,
        foundPoints: 0,
        totalPoints: gridSize ? gridSize * gridSize : null,
        isSubject: true,
        relationship: "subject",
      },
    ],
  };
}

export type LocalVisibilityCompetitorBusiness = LocalFalconCompetitorBusiness & {
  sendableReport: LocalVisibilityReportSummary | null;
};

export type LocalVisibilityCompetitorGroup = {
  sourceReportId: string;
  subjectRank: number | null;
  totalBusinesses: number | null;
  businessesAheadCount: number | null;
  warnings: string[];
  dataSource: "local_falcon" | "batch_fallback" | "unavailable";
  competitors: LocalVisibilityCompetitorBusiness[];
};

export type LocalVisibilityReportLibrary = {
  ownReports: LocalVisibilityReportSummary[];
  competitorGroups: LocalVisibilityCompetitorGroup[];
};
