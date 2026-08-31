import { z } from "zod";

/** Only non-address evidence belongs in persistent state. The candidate itself
 * is an ephemeral input to the geocoder, never part of this schema. */
export const sabAddressCorroborationSchema = z.object({
  source_report_key: z.string().regex(/^[a-f0-9]{12,64}$/i),
  evidence_hash: z.string().regex(/^[a-f0-9]{64}$/i),
  status: z.enum(["no_candidate", "accepted", "rejected", "incomplete", "technical_failure"]),
  evidence_references: z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
  source_type: z.string().trim().min(1).max(200),
  identity_method: z.string().trim().min(1).max(500),
  fit_rationale: z.string().trim().min(1).max(2000),
  research_complete: z.boolean(),
  candidate_coordinates: z.object({latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180)}).strict().optional(),
  geocoder: z.object({location_type:z.string().nullable(),partial_match:z.boolean()}).strict().optional(),
  distances_miles: z.object({weighted_centroid:z.number().finite().nonnegative(),nearest_ranked_cell:z.number().finite().nonnegative(),best_rank_cluster_centroid:z.number().finite().nonnegative()}).strict().optional(),
}).strict().superRefine((value, context) => {
  if (value.status === "no_candidate" && (!value.research_complete || value.candidate_coordinates || value.geocoder || value.distances_miles)) {
    context.addIssue({code:z.ZodIssueCode.custom,message:"No-candidate evidence requires completed research and no invented geocoded candidate"});
  }
  if (["accepted", "rejected"].includes(value.status) && (!value.candidate_coordinates || !value.geocoder || value.geocoder.partial_match || !value.distances_miles)) {
    context.addIssue({code:z.ZodIssueCode.custom,message:"A geographic-fit disposition requires complete server-evaluated coordinates, precision and distances"});
  }
});

export type SabAddressCorroboration = z.infer<typeof sabAddressCorroborationSchema>;

export function corroborationAllowsAuxiliary(value: SabAddressCorroboration | undefined, reportKey: string, hash: string) {
  return value?.source_report_key === reportKey && value.evidence_hash === hash &&
    (value.status === "rejected" || (value.status === "no_candidate" && value.research_complete));
}
