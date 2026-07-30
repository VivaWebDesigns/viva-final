export const LOCAL_FALCON_LEAD_CLASSIFICATION_VALUES = [
  "sab",
  "location_based",
] as const;

export const LOCAL_FALCON_LEAD_CLASSIFICATIONS = [
  { value: "sab", label: "SAB", tagSlug: "sab", tagColor: "#7C3AED" },
  { value: "location_based", label: "Location Based", tagSlug: "location-based", tagColor: "#0D9488" },
] as const;

export type LocalFalconLeadClassification =
  typeof LOCAL_FALCON_LEAD_CLASSIFICATION_VALUES[number];

export function getLocalFalconLeadClassification(value: LocalFalconLeadClassification) {
  return LOCAL_FALCON_LEAD_CLASSIFICATIONS.find((classification) => classification.value === value)!;
}
