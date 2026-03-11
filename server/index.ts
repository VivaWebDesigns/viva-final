import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./features/auth/auth";
import { seedDevUsers } from "./features/admin/dev-seed";
import { seedAdminUser } from "./features/admin/prod-seed";
import { seedCrmStatuses } from "./features/crm/seed";
import { seedPipelineStages } from "./features/pipeline/seed";
import { seedOnboardingTemplates } from "./features/onboarding/seed";
import { seedIntegrations } from "./features/integrations/seed";
import { seedDocs } from "./features/docs/seed";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Request correlation ID + structured route logger.
// Logs method / path / status / duration / requestId for every /api call.
// For 4xx/5xx responses, appends the error `message` string only — never the full body.
// The /api/auth/* paths are excluded (handled by better-auth before this middleware).
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  const requestId = Math.random().toString(36).slice(2, 10);
  res.locals.requestId = requestId;

  let errorMessage: string | undefined;
  const originalResJson = res.json.bind(res);
  res.json = function (body: unknown) {
    const status = res.statusCode;
    if (
      status >= 400 &&
      body !== null &&
      typeof body === "object" &&
      "message" in (body as object) &&
      typeof (body as Record<string, unknown>).message === "string"
    ) {
      errorMessage = (body as Record<string, unknown>).message as string;
    }
    return originalResJson(body);
  };

  res.on("finish", () => {
    if (!path.startsWith("/api") || path.startsWith("/api/auth")) return;
    const duration = Date.now() - start;
    const status = res.statusCode;
    let logLine = `${req.method} ${path} ${status} in ${duration}ms [${requestId}]`;
    if (errorMessage) {
      logLine += ` — ${errorMessage}`;
    }
    if (status >= 500) {
      console.error(`[express] ${logLine}`);
    } else {
      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const requestId = (res.locals.requestId as string | undefined) ?? "?";

    // Structured error log: method + path + status + requestId + message only.
    // Full stack trace is printed in non-production environments only (for dev debugging).
    console.error(`[express] error ${req.method} ${req.path} ${status} [${requestId}] — ${message}`);
    if (process.env.NODE_ENV !== "production") {
      console.error(err);
    }

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      seedAdminUser().catch((err) => console.error("[prod-seed] error:", err));
      seedDevUsers().catch((err) => console.error("[dev-seed] error:", err));
      seedPipelineStages().catch((err) => console.error("[seed] pipeline stages error:", err));
      seedCrmStatuses().catch((err) => console.error("[seed] crm statuses error:", err));
      seedOnboardingTemplates().catch((err) => console.error("[seed] onboarding templates error:", err));
      seedIntegrations().catch((err) => console.error("[seed] integrations error:", err));
      seedDocs().catch((err) => console.error("[seed] docs error:", err));
    },
  );
})();
