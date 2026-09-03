import type { GoogleIntegrationConnection } from "@shared/schema";
import { createGoogleOAuthClient, decryptGoogleToken } from "./googleAuth";

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || "543529736";

function authorizedClient(connection: GoogleIntegrationConnection) {
  const client = createGoogleOAuthClient();
  client.setCredentials({ refresh_token: decryptGoogleToken(connection.encryptedRefreshToken) });
  return client;
}

interface GaValue { value?: string }
interface GaRow { dimensionValues?: GaValue[]; metricValues?: GaValue[] }
interface GaReportResponse {
  rows?: GaRow[];
  rowCount?: number;
  metadata?: { currencyCode?: string; timeZone?: string };
}

export const LANDING_PAGE_DIMENSION_FILTER = {
  andGroup: {
    expressions: [
      {
        notExpression: {
          filter: {
            fieldName: "landingPagePlusQueryString",
            stringFilter: { matchType: "CONTAINS", value: "gtm_debug", caseSensitive: false },
          },
        },
      },
      {
        notExpression: {
          filter: {
            fieldName: "landingPagePlusQueryString",
            stringFilter: { matchType: "FULL_REGEXP", value: "^(\\(not set\\))?$", caseSensitive: false },
          },
        },
      },
    ],
  },
};

export const LANDING_PAGE_METRIC_FILTER = {
  filter: {
    fieldName: "screenPageViews",
    numericFilter: { operation: "GREATER_THAN", value: { int64Value: "0" } },
  },
};

function numberValue(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function runGaReport(
  connection: GoogleIntegrationConnection,
  days: number,
  input: {
    dimensions?: string[];
    metrics: string[];
    dimensionFilter?: unknown;
    metricFilter?: unknown;
    limit?: number;
    orderMetric?: string;
  },
) {
  const client = authorizedClient(connection);
  const response = await client.request<GaReportResponse>({
    url: `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(connection.propertyId || GA4_PROPERTY_ID)}:runReport`,
    method: "POST",
    data: {
      dateRanges: [{ startDate: `${days - 1}daysAgo`, endDate: "today" }],
      dimensions: input.dimensions?.map((name) => ({ name })) ?? [],
      metrics: input.metrics.map((name) => ({ name })),
      ...(input.dimensionFilter ? { dimensionFilter: input.dimensionFilter } : {}),
      ...(input.metricFilter ? { metricFilter: input.metricFilter } : {}),
      ...(input.limit ? { limit: String(input.limit) } : {}),
      ...(input.orderMetric ? {
        orderBys: [{ metric: { metricName: input.orderMetric }, desc: true }],
      } : {}),
      keepEmptyRows: false,
    },
  });
  return response.data;
}

function tableRows(report: GaReportResponse, dimensions: string[], metrics: string[]) {
  return (report.rows ?? []).map((row) => {
    const result: Record<string, string | number> = {};
    dimensions.forEach((name, index) => { result[name] = row.dimensionValues?.[index]?.value ?? "(not set)"; });
    metrics.forEach((name, index) => { result[name] = numberValue(row.metricValues?.[index]?.value); });
    return result;
  });
}

function eventFilter(eventNames: string[]) {
  return {
    filter: {
      fieldName: "eventName",
      inListFilter: { values: eventNames, caseSensitive: true },
    },
  };
}

export async function getGoogleAnalyticsDashboard(
  connection: GoogleIntegrationConnection,
  days: number,
) {
  const [summaryReport, channelReport, pageReport, eventReport, leadTypeReport, trendReport] = await Promise.all([
    runGaReport(connection, days, {
      metrics: ["activeUsers", "sessions", "screenPageViews", "eventCount", "keyEvents"],
    }),
    runGaReport(connection, days, {
      dimensions: ["sessionDefaultChannelGroup"],
      metrics: ["sessions", "activeUsers", "keyEvents"],
      orderMetric: "sessions",
      limit: 10,
    }),
    runGaReport(connection, days, {
      dimensions: ["landingPagePlusQueryString"],
      metrics: ["sessions", "activeUsers", "screenPageViews"],
      dimensionFilter: LANDING_PAGE_DIMENSION_FILTER,
      metricFilter: LANDING_PAGE_METRIC_FILTER,
      orderMetric: "sessions",
      limit: 10,
    }),
    runGaReport(connection, days, {
      dimensions: ["eventName"],
      metrics: ["eventCount", "keyEvents"],
      dimensionFilter: eventFilter(["generate_lead", "form_submit"]),
      orderMetric: "eventCount",
      limit: 20,
    }),
    runGaReport(connection, days, {
      dimensions: ["customEvent:lead_type"],
      metrics: ["eventCount"],
      dimensionFilter: eventFilter(["generate_lead"]),
      orderMetric: "eventCount",
      limit: 10,
    }),
    runGaReport(connection, days, {
      dimensions: ["date"],
      metrics: ["sessions", "activeUsers", "keyEvents"],
      limit: 366,
    }),
  ]);

  const summaryRow = summaryReport.rows?.[0];
  const summaryMetrics = ["activeUsers", "sessions", "screenPageViews", "eventCount", "keyEvents"];
  const summary = Object.fromEntries(summaryMetrics.map((name, index) => [
    name,
    numberValue(summaryRow?.metricValues?.[index]?.value),
  ]));

  const events = tableRows(eventReport, ["eventName"], ["eventCount", "keyEvents"]);
  const eventCount = (eventName: string) => Number(events.find((row) => row.eventName === eventName)?.eventCount ?? 0);

  return {
    propertyId: connection.propertyId || GA4_PROPERTY_ID,
    days,
    summary: {
      ...summary,
      confirmedLeads: eventCount("generate_lead"),
    },
    channels: tableRows(channelReport, ["channel"], ["sessions", "activeUsers", "keyEvents"]),
    landingPages: tableRows(pageReport, ["landingPage"], ["sessions", "activeUsers", "screenPageViews"]),
    events,
    leadTypes: tableRows(leadTypeReport, ["leadType"], ["eventCount"]),
    trend: tableRows(trendReport, ["date"], ["sessions", "activeUsers", "keyEvents"])
      .sort((left, right) => String(left.date).localeCompare(String(right.date))),
    timeZone: summaryReport.metadata?.timeZone ?? null,
    generatedAt: new Date().toISOString(),
  };
}

interface GoogleBusinessAccount {
  name: string;
  accountName?: string;
  type?: string;
}

interface GoogleBusinessLocation {
  name: string;
  title?: string;
  websiteUri?: string;
  storefrontAddress?: { locality?: string; administrativeArea?: string };
}

export interface DiscoveredGoogleLocation {
  accountId: string;
  accountName: string;
  locationId: string;
  title: string;
  websiteUri: string | null;
  locality: string | null;
}

export async function discoverGoogleBusinessLocations(connection: GoogleIntegrationConnection) {
  const client = authorizedClient(connection);
  const accountsResponse = await client.request<{ accounts?: GoogleBusinessAccount[] }>({
    url: "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
  });
  const accounts = accountsResponse.data.accounts ?? [];
  const discovered: DiscoveredGoogleLocation[] = [];

  for (const account of accounts) {
    let pageToken: string | undefined;
    do {
      const response = await client.request<{ locations?: GoogleBusinessLocation[]; nextPageToken?: string }>({
        url: `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
        params: {
          readMask: "name,title,websiteUri,storefrontAddress",
          pageSize: 100,
          ...(pageToken ? { pageToken } : {}),
        },
      });
      for (const location of response.data.locations ?? []) {
        discovered.push({
          accountId: account.name,
          accountName: account.accountName || account.name,
          locationId: location.name,
          title: location.title || location.name,
          websiteUri: location.websiteUri || null,
          locality: [location.storefrontAddress?.locality, location.storefrontAddress?.administrativeArea]
            .filter(Boolean).join(", ") || null,
        });
      }
      pageToken = response.data.nextPageToken;
    } while (pageToken);
  }

  return discovered;
}

const STAR_RATING: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

interface GoogleReviewResponse {
  name: string;
  reviewer?: { displayName?: string };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
}

export async function fetchGoogleBusinessReviews(
  connection: GoogleIntegrationConnection,
  accountId: string,
  locationId: string,
) {
  const client = authorizedClient(connection);
  const accountNumber = accountId.replace(/^accounts\//, "");
  const locationNumber = locationId.replace(/^locations\//, "");
  const reviews: GoogleReviewResponse[] = [];
  let pageToken: string | undefined;

  do {
    const response = await client.request<{ reviews?: GoogleReviewResponse[]; nextPageToken?: string }>({
      url: `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(accountNumber)}/locations/${encodeURIComponent(locationNumber)}/reviews`,
      params: {
        pageSize: 50,
        orderBy: "updateTime desc",
        ...(pageToken ? { pageToken } : {}),
      },
    });
    reviews.push(...(response.data.reviews ?? []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return reviews.map((review) => ({
    googleReviewName: review.name,
    locationId,
    reviewerName: review.reviewer?.displayName || null,
    starRating: STAR_RATING[review.starRating || ""] || 0,
    comment: review.comment || null,
    reviewCreatedAt: new Date(review.createTime || Date.now()),
    reviewUpdatedAt: review.updateTime ? new Date(review.updateTime) : null,
    replyComment: review.reviewReply?.comment || null,
    replyUpdatedAt: review.reviewReply?.updateTime ? new Date(review.reviewReply.updateTime) : null,
  }));
}
