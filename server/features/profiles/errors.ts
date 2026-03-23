/**
 * Profile Feature — Typed Domain Errors
 * ─────────────────────────────────────────────────────────────────────────────
 * All errors thrown from server/features/profiles/* extend ProfileError.
 * Each subclass carries a canonical HTTP status code so the route handler
 * can resolve the correct response without string-matching on the message.
 *
 * HTTP mapping
 * ─────────────────────────────────────────────────────────────────────────────
 *  ProfileValidationError   400  Bad Request          — caller supplied invalid input
 *  ProfileForbiddenError    403  Forbidden             — caller lacks permission
 *  ProfileNotFoundError     404  Not Found             — entity does not exist in DB
 *  ProfileLinkageError      422  Unprocessable Entity  — entity exists but a required
 *                                                        relationship cannot be resolved
 *                                                        (e.g. lead has no companyId)
 *  ProfileDependencyError   503  Service Unavailable   — upstream DB/service failure
 *  ProfileError (base)      500  Internal Server Error — catch-all for unexpected cases
 *
 * Design constraints
 * ─────────────────────────────────────────────────────────────────────────────
 * - Lightweight: plain class hierarchy, no registry, no factory functions.
 * - Safe: status >= 500 errors never expose their raw message to the client.
 * - Extensible: add a new subclass + statusCode; sendProfileError handles it
 *   automatically.
 */

// ── Base ──────────────────────────────────────────────────────────────────────

export class ProfileError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ── 400 Bad Request ───────────────────────────────────────────────────────────

/**
 * The caller supplied malformed or semantically invalid input.
 * Use for business-rule violations that are the caller's fault and are safe
 * to describe in the response (e.g. "Status must be one of: active, …").
 */
export class ProfileValidationError extends ProfileError {
  constructor(message: string) {
    super(message, 400);
  }
}

// ── 403 Forbidden ─────────────────────────────────────────────────────────────

/**
 * The caller is authenticated but does not have permission to access this
 * profile (e.g. a sales_rep attempting to view a lead assigned to another rep).
 */
export class ProfileForbiddenError extends ProfileError {
  constructor(message = "Access denied") {
    super(message, 403);
  }
}

// ── 404 Not Found ─────────────────────────────────────────────────────────────

/**
 * The requested entity does not exist in the database.
 *
 * @param entity  Human-readable entity name: "Company", "Lead", "Opportunity"
 * @param id      The ID that was looked up (included in the message for logs,
 *                but the client-facing message is intentionally generic)
 */
export class ProfileNotFoundError extends ProfileError {
  readonly entity: string;
  readonly entityId: string;

  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, 404);
    this.entity = entity;
    this.entityId = id;
  }
}

// ── 422 Unprocessable Entity ──────────────────────────────────────────────────

/**
 * The referenced entity exists but a required relationship cannot be resolved,
 * so a unified profile cannot be assembled.
 *
 * Examples:
 *   • Lead has no companyId — profile cannot be constructed
 *   • Opportunity has no companyId and its leadId also points to a company-less lead
 *
 * This is semantically distinct from 404: the primary record was found, but
 * its referential integrity is insufficient to fulfil the request.
 */
export class ProfileLinkageError extends ProfileError {
  constructor(message: string) {
    super(message, 422);
  }
}

// ── 503 Service Unavailable ───────────────────────────────────────────────────

/**
 * An upstream dependency (database, external service) failed in a way that
 * prevents the request from being fulfilled.  The caller may retry later.
 */
export class ProfileDependencyError extends ProfileError {
  constructor(message: string) {
    super(message, 503);
  }
}

// ── Route error handler ───────────────────────────────────────────────────────

import type { Response } from "express";

/**
 * Converts any thrown value into an appropriate HTTP response.
 *
 * Rules:
 * - ProfileError subclasses → use their own statusCode.
 * - statusCode < 500 → client message is the error message (safe to expose).
 * - statusCode >= 500 → client message is generic; real message goes to stderr.
 * - Non-ProfileError → always 500 with generic message + stderr log.
 *
 * Usage:
 *   } catch (err: unknown) {
 *     return sendProfileError(res, err);
 *   }
 */
export function sendProfileError(res: Response, err: unknown): Response {
  if (err instanceof ProfileError) {
    const clientMessage =
      err.statusCode < 500
        ? err.message
        : "Internal server error";

    if (err.statusCode >= 500) {
      console.error(`[profile] ${err.name}:`, err.message, err.stack);
    }

    return res.status(err.statusCode).json({ message: clientMessage });
  }

  console.error("[profile] unexpected error:", err);
  return res.status(500).json({ message: "Internal server error" });
}
