import { SCALE_FIRST_CONTACT_TAGS, SCALE_FIRST_WORKFLOW } from "@shared/sabCrm";
import { parseLocalFalconPayload } from "../crm/localFalconImport";

const prospectFields = {
  place_id: "non-empty string",
  company_name: "non-empty string",
  address: "literal string \"Service Area Business\"; never include a hidden operating address",
  city: "non-empty string",
  state: "two-letter state code",
  zip: "non-empty string",
  phone: "non-empty string or null",
  owner_name: "non-empty string or null",
  email: "non-empty string or null",
  google_maps_url: "URL",
  has_website: "boolean",
  website_url: "URL or null",
  website_platform: "string or null; optional",
  service_page_count: "integer >= 0",
  website_analysis: "array of 3-6 non-empty strings or null; optional",
  reviews_analysis: "array of 3-6 non-empty strings or null; optional",
  report_key: "12-64 hexadecimal characters",
  report_url: "URL",
  scan_date: "valid date string",
  scan_keyword: "non-empty string matching batch.keyword",
  arp: "number >= 0",
  atrp: "optional number >= 1; CRM retrieves authoritative ATRP from report_key for the all-point report average. ARP remains unchanged for scan selection.",
  solv: "number from 0 through 100",
  rating: "number from 0 through 5",
  review_count: "integer >= 0",
  sales_priority: "integer 1, 2, or 3",
  sales_priority_reason: "non-empty string, maximum 500 characters",
  scan_center: {
    required: false,
    strict: true,
    fields: {
      lat: "number from -90 through 90",
      lng: "number from -180 through 180",
      city: "non-empty string",
      state: "two-letter state code",
      zip: "non-empty string",
    },
  },
  heatmap_file: "optional direct heatmaps/ image path",
  qualification_status: "literal string \"qualified\"",
} as const;

export const SAB_CRM_IMPORT_CONTRACT = {
  contract: "viva_local_falcon_crm_batch_json",
  contract_version: "1.1",
  source_of_truth: "production CRM Local Falcon import parser",
  strict: true,
  writes_data: false,
  top_level: {
    allowed_keys: ["batch", "prospects"],
    batch: {
      strict: true,
      fields: {
        batch_id: "non-empty string",
        market: {
          strict: true,
          fields: {
            city: "non-empty string",
            state: "two-letter state code",
          },
        },
        trade: "non-empty string",
        keyword: "non-empty string",
        export_date: "valid date string",
        scan_spec: {
          strict: true,
          fields: {
            grid_size: "grid such as 7x7",
            radius_miles: "number > 0",
          },
        },
      },
    },
    prospects: {
      type: "array",
      minimum_items: 1,
      maximum_items: 200,
      item: {
        strict: true,
        fields: prospectFields,
      },
    },
  },
  invariants: [
    "No keys outside the listed strict objects are accepted.",
    "Every prospect Place ID must be unique inside the batch.",
    "Every prospect report key must be unique inside the batch.",
    "Every prospect scan_keyword must exactly match batch.keyword.",
    "website_url is required when has_website is true.",
    "website_url must be null when has_website is false.",
    "owner_name may be null; do not invent a name.",
    "Every prospect address must be exactly \"Service Area Business\"; hidden operating addresses must never be exported.",
    "The contract and validator do not import or modify CRM data.",
  ],
} as const;

const scaleFirstProspectFields = {
  place_id: "required exact Google Place ID; non-empty string",
  company_name: "non-empty string",
  address: "literal string \"Service Area Business\"; never include a hidden operating address",
  city: "non-empty string",
  state: "two-letter state code",
  zip: "non-empty string",
  phone: "non-empty string or null",
  owner_name: "non-empty string or null",
  email: "non-empty string or null; required when contact_tag is Email Ready",
  contact_tag: `exactly one of: ${SCALE_FIRST_CONTACT_TAGS.join(", ")}`,
  google_maps_url: "optional URL; when omitted, CRM derives it from the exact Place ID",
  has_website: "boolean",
  website_url: "URL or null",
  website_platform: "string or null; optional",
  report_key: "canonical Local Falcon report key; 12-64 hexadecimal characters",
  report_url: "verified canonical Local Falcon public report URL",
  scan_date: "valid date string",
  scan_keyword: "non-empty string matching batch.keyword",
  scan_spec: {
    required: false,
    strict: true,
    description: "optional canonical-report override; omit to inherit batch.scan_spec",
    fields: {
      grid_size: "grid such as 7x7",
      radius_miles: "number > 0",
    },
  },
  arp: "number >= 0",
  solv: "number from 0 through 100",
  rating: "number from 0 through 5",
  review_count: "integer >= 0",
  scan_center: prospectFields.scan_center,
  heatmap_file: prospectFields.heatmap_file,
  qualification_status: prospectFields.qualification_status,
  atrp: prospectFields.atrp,
} as const;

export const SCALE_FIRST_SAB_CRM_IMPORT_CONTRACT = {
  contract: "viva_local_falcon_crm_batch_json",
  contract_version: "2.1",
  workflow: SCALE_FIRST_WORKFLOW,
  discriminator: {
    field: "workflow",
    value: SCALE_FIRST_WORKFLOW,
    required: true,
  },
  source_of_truth: "production CRM Local Falcon import parser",
  strict: true,
  writes_data: false,
  top_level: {
    allowed_keys: ["workflow", "batch", "prospects"],
    workflow: `literal string \"${SCALE_FIRST_WORKFLOW}\"`,
    batch: SAB_CRM_IMPORT_CONTRACT.top_level.batch,
    prospects: {
      type: "array",
      minimum_items: 1,
      maximum_items: 200,
      item: {
        strict: true,
        fields: scaleFirstProspectFields,
      },
    },
  },
  omitted_audit_first_fields: [
    "service_page_count",
    "sales_priority",
    "sales_priority_reason",
    "reviews_analysis",
    "website_analysis",
  ],
  invariants: [
    "The workflow discriminator is mandatory; missing Audit-First fields never select Scale-First.",
    "No keys outside the listed strict objects are accepted.",
    "Every prospect Place ID must be unique inside the batch and CRM deduplication uses exact Place-ID equality.",
    "Every prospect report key must be unique inside the batch.",
    "Every prospect scan_keyword must exactly match batch.keyword.",
    "Each prospect inherits batch.scan_spec unless it supplies an explicit scan_spec override.",
    "Every official report must match its prospect's effective scan_spec.",
    "website_url is required when has_website is true.",
    "website_url must be null when has_website is false.",
    "Email Ready requires an email and is eligible for automated email routing.",
    "Needs Email is retained in CRM and excluded from automated email routing.",
    "Every prospect address must be exactly \"Service Area Business\"; hidden operating addresses must never be exported.",
    "The contract and validator do not import or modify CRM data.",
  ],
} as const;

export const SAB_CRM_IMPORT_WORKFLOWS = [
  "audit_first_v1_1",
  SCALE_FIRST_WORKFLOW,
] as const;
export type SabCrmImportWorkflow = typeof SAB_CRM_IMPORT_WORKFLOWS[number];

export function getSabCrmImportContract(workflow: SabCrmImportWorkflow) {
  return workflow === SCALE_FIRST_WORKFLOW
    ? SCALE_FIRST_SAB_CRM_IMPORT_CONTRACT
    : SAB_CRM_IMPORT_CONTRACT;
}

function validationErrors(error: unknown): string[] {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("; ").filter(Boolean);
}

export function validateSabCrmManifest(manifestJson: string) {
  try {
    const payload = parseLocalFalconPayload(manifestJson);
    const scaleFirst = "workflow" in payload;
    return {
      valid: true as const,
      contract: SAB_CRM_IMPORT_CONTRACT.contract,
      ...(scaleFirst ? {
        contract_version: SCALE_FIRST_SAB_CRM_IMPORT_CONTRACT.contract_version,
        workflow: SCALE_FIRST_WORKFLOW,
      } : {}),
      batch_id: payload.batch.batch_id,
      prospect_count: payload.prospects.length,
      unique_place_id_count: new Set(
        payload.prospects.map((prospect) => prospect.place_id),
      ).size,
      unique_report_key_count: new Set(
        payload.prospects.map((prospect) => prospect.report_key),
      ).size,
      errors: [] as string[],
      writes_performed: false,
    };
  } catch (error) {
    const errors = validationErrors(error);
    const returnedErrors = errors.slice(0, 100);
    return {
      valid: false as const,
      contract: SAB_CRM_IMPORT_CONTRACT.contract,
      error_count: errors.length,
      errors: returnedErrors,
      errors_truncated: returnedErrors.length < errors.length,
      writes_performed: false,
    };
  }
}
