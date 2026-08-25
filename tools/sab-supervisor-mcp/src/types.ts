import { z } from "zod";

export const verdictSchema = z.enum([
  "continue",
  "correct",
  "reconcile",
  "approval_required",
  "user_ruling_required",
  "complete",
]);

export const checkpointInputSchema = z.object({
  sop_path_or_url: z.string().trim().min(1).max(4096),
  claude_message: z.string().trim().min(1).max(60000),
  run_context: z.string().trim().min(1).max(40000),
  user_rulings: z.array(z.string().trim().min(1).max(4000)).max(50).default([]),
});

export const reviewResultSchema = z.object({
  verdict: verdictSchema,
  summary: z.string().max(2000),
  problems: z.array(z.string().max(2000)).max(30),
  instructions_for_claude: z.string().max(8000),
  approval_boundary: z.string().max(2000),
  evidence_gaps: z.array(z.string().max(2000)).max(30),
});

export type CheckpointInput = z.infer<typeof checkpointInputSchema>;
export type ReviewResult = z.infer<typeof reviewResultSchema>;

export type CodexExecution = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
  resultText?: string;
};
