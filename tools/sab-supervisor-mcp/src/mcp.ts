import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ReviewExecutionError, reviewSabCheckpoint } from "./reviewer.js";

export function createSupervisorMcpServer(): McpServer {
  const server = new McpServer({
    name: "viva-sab-local-supervisor",
    version: "1.0.0",
  });

  server.registerTool(
    "review_sab_checkpoint",
    {
      title: "Review SAB checkpoint",
      description:
        "Read the exact supplied SOP and review Claude's latest checkpoint against only that run's durable state and explicit rulings. Returns read-only next-step instructions and never performs SAB work or grants approval.",
      inputSchema: {
        sop_path_or_url: z.string().min(1).max(4096),
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
  return server;
}

export async function runMcpServer(): Promise<void> {
  const server = createSupervisorMcpServer();
  await server.connect(new StdioServerTransport());
}
