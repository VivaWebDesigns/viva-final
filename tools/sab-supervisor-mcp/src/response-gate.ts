import type { ReviewResult, ScanReviewResult } from "./types.js";

export type SupervisorResponseGate = {
  review_id: string;
  stopping_verdict: boolean;
  user_visible_response_allowed: boolean;
  must_continue_privately: boolean;
  required_next_action: string;
  valid_only_for_reviewed_state: true;
  fresh_review_required_after_any_further_workflow_action: true;
};

export function checkpointResponseGate(
  reviewId: string,
  verdict: ReviewResult["verdict"],
): SupervisorResponseGate {
  const actions: Record<ReviewResult["verdict"], string> = {
    continue: "continue_unblocked_work_privately",
    correct: "apply_correction_privately_then_review_again",
    reconcile: "reconcile_durable_state_privately_then_review_again",
    approval_required: "present_only_the_exact_approval_request_to_matt",
    user_ruling_required: "present_only_the_exact_policy_ruling_to_matt",
    handoff_ready: "present_the_verified_handoff_package",
    complete: "present_the_verified_full_run_completion",
  };
  const stopping = [
    "approval_required",
    "user_ruling_required",
    "handoff_ready",
    "complete",
  ].includes(verdict);
  return {
    review_id: reviewId,
    stopping_verdict: stopping,
    user_visible_response_allowed: stopping,
    must_continue_privately: !stopping,
    required_next_action: actions[verdict],
    valid_only_for_reviewed_state: true,
    fresh_review_required_after_any_further_workflow_action: true,
  };
}

export function scanResponseGate(
  reviewId: string,
  verdict: ScanReviewResult["verdict"],
): SupervisorResponseGate {
  const actions: Record<ScanReviewResult["verdict"], string> = {
    scan_approved: "execute_exact_authorization_privately_then_checkpoint",
    correct: "correct_scan_plan_privately_then_review_again",
    user_ruling_required: "present_only_the_exact_scan_ruling_to_matt",
  };
  const stopping = verdict === "user_ruling_required";
  return {
    review_id: reviewId,
    stopping_verdict: stopping,
    user_visible_response_allowed: stopping,
    must_continue_privately: !stopping,
    required_next_action: actions[verdict],
    valid_only_for_reviewed_state: true,
    fresh_review_required_after_any_further_workflow_action: true,
  };
}
