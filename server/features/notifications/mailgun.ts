/**
 * Mailgun Email Service
 *
 * Wraps Mailgun API v3 with:
 *   - 10-second call timeout (AbortController)
 *   - Structured error classification (permanent / transient / rate_limit / config)
 *   - Structured log output per call
 *   - Provider snapshot recording for admin diagnostics
 *
 * When MAILGUN_API_KEY or MAILGUN_DOMAIN are not set, sends are skipped
 * gracefully (returns status="skipped") — email is optional/advisory.
 */

import {
  withTimeout,
  classifyProviderError,
  logProviderEvent,
  severityForErrorClass,
  warnIfThresholdReached,
} from "../../lib/provider-resilience";
import { recordSuccess, recordFailure } from "../../lib/provider-snapshot";

const PROVIDER = "mailgun";
const OPERATION = "send_email";
const TIMEOUT_MS = 10_000;

interface MailgunConfig {
  apiKey: string;
  domain: string;
  fromEmail: string;
  fromName: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
  errorClass?: string;
}

function getConfig(): MailgunConfig | null {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) return null;
  return {
    apiKey,
    domain,
    fromEmail: process.env.MAILGUN_FROM_EMAIL || `noreply@${domain}`,
    fromName: process.env.MAILGUN_FROM_NAME || "Viva Web Designs",
  };
}

export function isConfigured(): boolean {
  return getConfig() !== null;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options?: { replyTo?: string; tags?: string[]; correlationId?: string },
): Promise<SendResult> {
  const ctx = {
    provider: PROVIDER,
    operation: OPERATION,
    correlationId: options?.correlationId,
  };

  const config = getConfig();
  if (!config) {
    logProviderEvent(ctx, "skipped", { severity: "info", message: "MAILGUN_API_KEY/MAILGUN_DOMAIN not set" });
    return { success: true, status: "skipped" };
  }

  try {
    const result = await withTimeout(
      async (signal) => {
        const formData = new URLSearchParams();
        formData.append("from", `${config.fromName} <${config.fromEmail}>`);
        formData.append("to", to);
        formData.append("subject", subject);
        formData.append("html", html);
        if (options?.replyTo) formData.append("h:Reply-To", options.replyTo);
        if (options?.tags) options.tags.forEach((tag) => formData.append("o:tag", tag));

        const response = await fetch(
          `https://api.mailgun.net/v3/${config.domain}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString("base64")}`,
            },
            body: formData,
            signal,
          },
        );

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "(unreadable)");
          const errorClass = classifyProviderError(response.status, errorBody);
          const severity = severityForErrorClass(errorClass);

          logProviderEvent(ctx, "failure", {
            errorClass,
            severity,
            message: `HTTP ${response.status}: ${errorBody.slice(0, 200)}`,
          });

          const snapshot = recordFailure(PROVIDER, OPERATION, `HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
          return {
            success: false,
            status: "failed" as const,
            error: `HTTP ${response.status}: ${errorBody}`,
            errorClass,
          };
        }

        const data = await response.json() as { id?: string };

        logProviderEvent(ctx, "success", { severity: "info", message: `messageId=${data.id}` });
        recordSuccess(PROVIDER, OPERATION);

        return {
          success: true,
          status: "sent" as const,
          messageId: data.id,
        };
      },
      TIMEOUT_MS,
      ctx,
    );

    return result;
  } catch (err: any) {
    const isTimeout = err?.message?.startsWith("PROVIDER_TIMEOUT");
    const errorClass = isTimeout ? "transient" : classifyProviderError(undefined, err.message);
    const severity = severityForErrorClass(errorClass);

    if (!isTimeout) {
      logProviderEvent(ctx, "failure", { errorClass, severity, message: err.message });
    }

    const state = recordFailure(PROVIDER, OPERATION, err.message);
    // Threshold warning is handled inside recordFailure + warnIfThresholdReached
    const snap = { consecutiveFailures: 0 }; // snapshot is internal
    // Emit threshold warning through resilience module
    const { getSnapshot } = await import("../../lib/provider-snapshot");
    const current = getSnapshot(PROVIDER, OPERATION);
    if (current) warnIfThresholdReached(current.consecutiveFailures, ctx);

    return {
      success: false,
      status: "failed",
      error: err.message,
      errorClass,
    };
  }
}
