import { z } from "zod";
import type { LocalFalconPayload } from "./localFalconImport";

const reportKeySchema = z.string().trim().regex(/^[a-f0-9]{12,64}$/i, "Must be a Local Falcon report key");
const nullableAddressPart = z.string().nullable();

const competitorBusinessSchema = z.object({
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

const competitorReportSchema = z.object({
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
  businesses: z.array(competitorBusinessSchema),
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

  const subjectIndexes = report.businesses
    .map((business, index) => business.place_id === report.subject_place_id ? index : -1)
    .filter((index) => index >= 0);
  const markedSubjectIndexes = report.businesses
    .map((business, index) => business.is_subject ? index : -1)
    .filter((index) => index >= 0);

  if (report.subject_rank === null) {
    if (report.businesses_ahead_count !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["businesses_ahead_count"],
        message: "Must be null when subject_rank is null",
      });
    }
    if (subjectIndexes.length > 0 || markedSubjectIndexes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subject_rank"],
        message: "Cannot be null when the subject is present in businesses",
      });
    }
    return;
  }

  if (report.subject_rank > report.businesses.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["subject_rank"],
      message: "Cannot exceed the businesses array length",
    });
    return;
  }

  if (report.businesses_ahead_count !== report.subject_rank - 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["businesses_ahead_count"],
      message: "Must equal subject_rank - 1",
    });
  }

  const rankedSubject = report.businesses[report.subject_rank - 1];
  if (rankedSubject?.place_id !== report.subject_place_id || !rankedSubject?.is_subject) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["businesses", report.subject_rank - 1],
      message: "The ranked subject must match subject_place_id and set is_subject to true",
    });
  }
  if (markedSubjectIndexes.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["businesses"],
      message: "Exactly one business must set is_subject when subject_rank is available",
    });
  }
});

const competitorSidecarSchema = z.object({
  version: z.literal(1),
  batch_id: z.string().trim().min(1),
  generated_at: z.string().datetime({ offset: true }),
  ranking_source: z.literal("local_falcon"),
  reports: z.record(reportKeySchema, competitorReportSchema),
}).strict();

export type LocalFalconCompetitorReport = z.infer<typeof competitorReportSchema>;
export type LocalFalconCompetitorSidecar = z.infer<typeof competitorSidecarSchema>;

function zodMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "competitors.json"}: ${issue.message}`)
    .join("; ");
}

function normalizedGridSize(value: string): number | null {
  const match = value.match(/^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i);
  if (!match || match[1] !== match[2]) return null;
  return Number(match[1]);
}

function isoDate(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function parseLocalFalconCompetitorSidecar(
  text: string,
  payload: LocalFalconPayload,
): LocalFalconCompetitorSidecar {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("competitors.json must contain valid JSON");
  }

  const parsed = competitorSidecarSchema.safeParse(raw);
  if (!parsed.success) throw new Error(zodMessage(parsed.error));
  const sidecar = parsed.data;
  if (sidecar.batch_id !== payload.batch.batch_id) {
    throw new Error("competitors.json batch_id must match batch.json");
  }

  const prospectsByReportKey = new Map(
    payload.prospects.map((prospect) => [prospect.report_key, prospect]),
  );
  const gridSize = normalizedGridSize(payload.batch.scan_spec.grid_size);

  for (const prospect of payload.prospects) {
    if (!sidecar.reports[prospect.report_key]) {
      throw new Error(`competitors.json is missing reports.${prospect.report_key} for ${prospect.company_name}`);
    }
  }

  for (const [reportKey, report] of Object.entries(sidecar.reports)) {
    const prospect = prospectsByReportKey.get(reportKey);
    if (!prospect) {
      throw new Error(`competitors.json reports.${reportKey} does not match a prospect report_key in batch.json`);
    }
    if (report.subject_place_id !== prospect.place_id) {
      throw new Error(`competitors.json reports.${reportKey}.subject_place_id must match batch.json`);
    }
    if (report.keyword !== prospect.scan_keyword) {
      throw new Error(`competitors.json reports.${reportKey}.keyword must match batch.json`);
    }
    if (gridSize !== null && report.grid_size !== gridSize) {
      throw new Error(`competitors.json reports.${reportKey}.grid_size must match batch.json`);
    }
    if (Math.abs(report.radius_miles - payload.batch.scan_spec.radius_miles) > 0.0001) {
      throw new Error(`competitors.json reports.${reportKey}.radius_miles must match batch.json`);
    }
    if (report.scan_date !== isoDate(prospect.scan_date)) {
      throw new Error(`competitors.json reports.${reportKey}.scan_date must match batch.json`);
    }
  }

  return sidecar;
}

export function reportsInSidecar(sidecar: LocalFalconCompetitorSidecar | null): number {
  return sidecar ? Object.keys(sidecar.reports).length : 0;
}
