export const SCALE_FIRST_WORKFLOW = "scale_first_v2" as const;
export const SCALE_FIRST_CONTACT_TAGS = ["Email Ready", "Needs Email"] as const;
export const SAB_ADDRESS_LABEL = "Service Area Business" as const;

export type ScaleFirstContactTag = typeof SCALE_FIRST_CONTACT_TAGS[number];

export const NO_VISIBILITY_OUTCOME = "no_visibility_core_found" as const;
export const CRM_ONLY_LOCAL_FALCON_SOURCE = "local_falcon_crm_only" as const;
export interface SabMarketReference {
  kind: "market_reference_only";
  source: "auxiliary_scan_reverse_geocode";
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  zip: string;
  auxiliary_report_key: string;
  auxiliary_report_url: string;
}
