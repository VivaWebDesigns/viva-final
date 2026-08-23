import { z } from "zod";
import type { LocalFalconCompetitorBusiness } from "@shared/localVisibility";
import type { LocalFalconPayload } from "./localFalconImport";

const reportKeySchema = z.string().trim().regex(/^[a-f0-9]{12,64}$/i, "Must be a Local Falcon report key");
const nullableAddressPart = z.string().nullable();

const legacyBusinessSchema = z.object({
  rank: z.number().int().positive(),
  place_id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  address_raw: z.string(),
  address: nullableAddressPart,
  city: nullableAddressPart,
  state: nullableAddressPart,
  zip: nullableAddressPart,
  lat: z.number().finite(),
  lng: z.number().finite(),
  arp: z.number().finite().nonnegative(),
  atrp: z.number().finite().nonnegative().nullable(),
  atrp_capped: z.boolean(),
  solv: z.number().finite().nonnegative(),
  reviews: z.number().int().nonnegative(),
  rating: z.number().finite().min(0).max(5),
  is_subject: z.boolean(),
}).strict();

const compactBusinessSchema = z.object({
  rank: z.number().int().positive(),
  place_id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  solv: z.number().finite().nonnegative(),
  found_points: z.number().int().nonnegative(),
  reviews: z.number().int().nonnegative(),
  rating: z.number().finite().min(0).max(5),
  is_subject: z.boolean(),
}).strict();

const metadataSchema = z.object({
  competitor_report_key: reportKeySchema.nullable(),
  subject_place_id: z.string().trim().min(1),
  subject_name: z.string().trim().min(1),
  keyword: z.string().trim().min(1),
  grid_size: z.number().int().positive(),
  radius_miles: z.number().finite().positive(),
  scan_date: z.string().date(),
  subject_rank: z.number().int().positive().nullable(),
  total_businesses: z.number().int().nonnegative().nullable(),
  businesses_ahead_count: z.number().int().nonnegative().nullable(),
  warnings: z.array(z.string()),
});

const legacyReportSchema = metadataSchema.extend({
  businesses: z.array(legacyBusinessSchema),
}).strict().superRefine((report, ctx) => {
  report.businesses.forEach((business, index) => {
    if (business.rank !== index + 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["businesses", index, "rank"],
        message: "Rank must equal the preserved Local Falcon array position",
      });
    }
    if (business.atrp_capped && business.atrp !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["businesses", index, "atrp"],
        message: "Capped ATRP must be null",
      });
    }
  });

  if (report.total_businesses !== null && report.total_businesses !== report.businesses.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["total_businesses"],
      message: "Must equal the full businesses array length",
    });
  }

  const markedSubjects = report.businesses.filter((business) => business.is_subject);
  if (report.subject_rank === null) {
    if (report.businesses_ahead_count !== null || markedSubjects.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subject_rank"],
        message: "Subject fields must be null when the subject is absent",
      });
    }
    return;
  }
  if (report.businesses_ahead_count !== report.subject_rank - 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["businesses_ahead_count"], message: "Must equal subject_rank - 1" });
  }
  const subject = report.businesses[report.subject_rank - 1];
  if (subject?.place_id !== report.subject_place_id || !subject?.is_subject || markedSubjects.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["businesses"],
      message: "The ranked subject must match subject_place_id and be the only marked subject",
    });
  }
});

const compactReportSchema = metadataSchema.extend({
  businesses: z.array(compactBusinessSchema).min(1).max(3),
}).strict().superRefine((report, ctx) => {
  const totalPoints = report.grid_size * report.grid_size;
  report.businesses.forEach((business, index) => {
    if (business.found_points > totalPoints) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["businesses", index, "found_points"],
        message: `Cannot exceed the ${totalPoints} scan points`,
      });
    }
  });
  if (report.subject_rank === null) {
    if (report.businesses_ahead_count !== null || report.businesses.some((business) => business.is_subject)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["subject_rank"], message: "Subject fields must be null when the subject is absent" });
    }
    return;
  }
  if (report.businesses_ahead_count !== report.subject_rank - 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["businesses_ahead_count"], message: "Must equal subject_rank - 1" });
  }
  const expectedRanks = [report.subject_rank - 1, report.subject_rank, report.subject_rank + 1]
    .filter((rank) => rank >= 1 && (report.total_businesses === null || rank <= report.total_businesses));
  const actualRanks = report.businesses.map((business) => business.rank);
  if (actualRanks.length !== expectedRanks.length || actualRanks.some((rank, index) => rank !== expectedRanks[index])) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["businesses"],
      message: "Must contain only the subject and the immediately adjacent businesses in rank order",
    });
  }
  const subjectRows = report.businesses.filter((business) => business.is_subject);
  const subject = report.businesses.find((business) => business.rank === report.subject_rank);
  if (subject?.place_id !== report.subject_place_id || !subject?.is_subject || subjectRows.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["businesses"],
      message: "The ranked subject must match subject_place_id and be the only marked subject",
    });
  }
});

const sidecarBase = {
  batch_id: z.string().trim().min(1),
  generated_at: z.string().datetime({ offset: true }),
  ranking_source: z.literal("local_falcon"),
};

const sidecarInputSchema = z.discriminatedUnion("version", [
  z.object({ version: z.literal(1), ...sidecarBase, reports: z.record(reportKeySchema, legacyReportSchema) }).strict(),
  z.object({ version: z.literal(2), ...sidecarBase, reports: z.record(reportKeySchema, compactReportSchema) }).strict(),
]);

export type LocalFalconCompetitorReport = z.infer<typeof metadataSchema> & {
  businesses: LocalFalconCompetitorBusiness[];
};

export type LocalFalconCompetitorSidecar = {
  version: 2;
  batch_id: string;
  generated_at: string;
  ranking_source: "local_falcon";
  reports: Record<string, LocalFalconCompetitorReport>;
};

function zodMessage(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "competitors.json"}: ${issue.message}`).join("; ");
}

function normalizedGridSize(value: string): number | null {
  const match = value.match(/^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i);
  if (!match || match[1] !== match[2]) return null;
  return Number(match[1]);
}

function isoDate(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

function selectAdjacentBusinesses(
  businesses: z.infer<typeof legacyBusinessSchema>[],
  subjectRank: number | null,
): LocalFalconCompetitorBusiness[] {
  const selected = subjectRank === null
    ? businesses.slice(0, 2)
    : businesses.filter((business) => Math.abs(business.rank - subjectRank) <= 1);
  return selected.map((business) => ({
    rank: business.rank,
    place_id: business.place_id,
    name: business.name,
    solv: business.solv,
    found_points: null,
    reviews: business.reviews,
    rating: business.rating,
    is_subject: business.is_subject,
  }));
}

function normalizeSidecar(input: z.infer<typeof sidecarInputSchema>): LocalFalconCompetitorSidecar {
  const reports = Object.fromEntries(Object.entries(input.reports).map(([reportKey, report]) => [
    reportKey,
    {
      ...report,
      businesses: input.version === 1
        ? selectAdjacentBusinesses(report.businesses, report.subject_rank)
        : report.businesses,
    },
  ]));
  return { version: 2, batch_id: input.batch_id, generated_at: input.generated_at, ranking_source: input.ranking_source, reports };
}

export function parseLocalFalconCompetitorSidecar(text: string, payload: LocalFalconPayload): LocalFalconCompetitorSidecar {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("competitors.json must contain valid JSON");
  }
  const parsed = sidecarInputSchema.safeParse(raw);
  if (!parsed.success) throw new Error(zodMessage(parsed.error));
  const sidecar = normalizeSidecar(parsed.data);
  if (sidecar.batch_id !== payload.batch.batch_id) throw new Error("competitors.json batch_id must match batch.json");

  const prospectsByReportKey = new Map(payload.prospects.map((prospect) => [prospect.report_key, prospect]));
  const gridSize = normalizedGridSize(payload.batch.scan_spec.grid_size);
  for (const prospect of payload.prospects) {
    if (!sidecar.reports[prospect.report_key]) {
      throw new Error(`competitors.json is missing reports.${prospect.report_key} for ${prospect.company_name}`);
    }
  }
  for (const [reportKey, report] of Object.entries(sidecar.reports)) {
    const prospect = prospectsByReportKey.get(reportKey);
    if (!prospect) throw new Error(`competitors.json reports.${reportKey} does not match a prospect report_key in batch.json`);
    if (report.subject_place_id !== prospect.place_id) throw new Error(`competitors.json reports.${reportKey}.subject_place_id must match batch.json`);
    if (report.keyword !== prospect.scan_keyword) throw new Error(`competitors.json reports.${reportKey}.keyword must match batch.json`);
    if (gridSize !== null && report.grid_size !== gridSize) throw new Error(`competitors.json reports.${reportKey}.grid_size must match batch.json`);
    if (Math.abs(report.radius_miles - payload.batch.scan_spec.radius_miles) > 0.0001) {
      throw new Error(`competitors.json reports.${reportKey}.radius_miles must match batch.json`);
    }
    if (report.scan_date !== isoDate(prospect.scan_date)) throw new Error(`competitors.json reports.${reportKey}.scan_date must match batch.json`);
  }
  return sidecar;
}

export function reportsInSidecar(sidecar: LocalFalconCompetitorSidecar | null): number {
  return sidecar ? Object.keys(sidecar.reports).length : 0;
}
