export const SCALE_FIRST_WORKFLOW = "scale_first_v2" as const;
export const SCALE_FIRST_CONTACT_TAGS = ["Email Ready", "Needs Email"] as const;
export const SAB_ADDRESS_LABEL = "Service Area Business" as const;

export type ScaleFirstContactTag = typeof SCALE_FIRST_CONTACT_TAGS[number];
