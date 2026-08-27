import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ReviewExecutionError, reviewSabCheckpoint } from "./reviewer.js";
import { reviewSabScanPlan } from "./scan-reviewer.js";
import { registerSopForReview } from "./sop-registry.js";
import { proposedScanSchema } from "./types.js";

export function createSupervisorMcpServer(): McpServer {
  const server = new McpServer({
    name: "viva-sab-local-supervisor",
    version: "1.1.0",
  });

  server.registerTool(
    "register_sop_for_review",
    {
      title: "Register private SAB SOP",
      description:
        "Store an immutable content-addressed copy of the exact private SOP text Claude read through its authenticated connector. The returned handle identifies this source, revision, and content and must be reused for reviews.",
      inputSchema: {
        source_url: z.string().url().max(4096),
        document_title_version: z.string().min(1).max(1000),
        drive_revision_id: z.string().min(1).max(1000).optional(),
        exact_document_text: z.string().min(1).max(2_000_000),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const result = await registerSopForReview(input);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        const payload = {
          error: "SOP registration failed",
          code: "sop_registration_failed",
          message: error instanceof Error ? error.message : String(error),
        };
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        };
      }
    },
  );

  server.registerTool(
    "review_sab_checkpoint",
    {
      title: "Review SAB checkpoint",
      description:
        "Read the exact immutable registered SOP and review Claude's latest checkpoint against only that run's durable state and explicit rulings. Returns next-step instructions plus a deterministic response gate; Claude may respond to Matt only when user_visible_response_allowed is true. Paid Local Falcon delegation is handled only by review_sab_scan_plan.",
      inputSchema: {
        registered_sop_handle: z
          .string()
          .regex(/^sop_[a-f0-9]{24}_[a-f0-9]{24}$/),
        claude_message: z.string().min(1).max(60000),
        run_context: z.string().min(1).max(40000),
        user_rulings: z.array(z.string().min(1).max(4000)).max(50).default([]),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const result = await reviewSabCheckpoint(input);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        const payload =
          error instanceof ReviewExecutionError
            ? { error: error.message, ...error.details }
            : {
                error: "Checkpoint review failed",
                code: "review_failed",
                message: error instanceof Error ? error.message : String(error),
              };
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        };
      }
    },
  );

  server.registerTool(
    "review_sab_scan_plan",
    {
      title: "Review and authorize SAB scan plan",
      description:
        "Review an exact proposed Local Falcon scan plan under the registered SOP. Returns a deterministic response gate. A scan_approved result is delegated standing authority to execute only its exact scans and listed save-location prerequisites without repeated user approval and is not a user-visible stopping point.",
      inputSchema: {
        registered_sop_handle: z
          .string()
          .regex(/^sop_[a-f0-9]{24}_[a-f0-9]{24}$/),
        durable_run_state: z.string().min(1).max(40000),
        proposed_scans: z.array(proposedScanSchema).min(1).max(100),
        user_rulings: z.array(z.string().min(1).max(4000)).max(50).default([]),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const result = await reviewSabScanPlan(input);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        const payload =
          error instanceof ReviewExecutionError
            ? { error: error.message, ...error.details }
            : {
                error: "Scan-plan review failed",
                code: "scan_review_failed",
                message: error instanceof Error ? error.message : String(error),
              };
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        };
      }
    },
  );
  return server;
}

export async function runMcpServer(): Promise<void> {
  const server = createSupervisorMcpServer();
  await server.connect(new StdioServerTransport());
}
