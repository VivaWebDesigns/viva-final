import { sanitizePostgresJsonString } from "./sanitize";

const PUBLIC_MESSAGES: Record<string, string> = {
  INVALID_URL: "Enter a valid public HTTP or HTTPS URL and try again.",
  UNSAFE_URL: "This address cannot be scanned because it is private, local, or otherwise restricted.",
  RESPONSE_TOO_LARGE: "This page is larger than the scanner's safety limit.",
  TOO_MANY_REDIRECTS: "This page redirects too many times to complete the scan.",
  INVALID_REDIRECT: "This page redirected to an invalid or restricted address.",
  SCAN_TIMEOUT: "The page took too long to scan. Please try again.",
};

export function publicScanError(error: Error & { code?: string }) {
  const code = typeof error.code === "string" && /^[A-Z][A-Z0-9_]+$/.test(error.code)
    ? error.code
    : "SCAN_FAILED";
  return {
    code,
    message: PUBLIC_MESSAGES[code] ?? "The scan could not be completed. Please retry. If this continues, contact support.",
  };
}

export function diagnosticScanError(error: unknown): string {
  let current: unknown = error;
  let deepest: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    deepest = current;
    current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  const candidate = deepest && typeof deepest === "object" ? deepest as { code?: unknown; message?: unknown } : {};
  const code = typeof candidate.code === "string" ? `${candidate.code}: ` : "";
  const message = typeof candidate.message === "string" ? candidate.message : "Unknown scanner error";
  return `${code}${sanitizePostgresJsonString(message).replace(/\s+/g, " ").slice(0, 500)}`;
}
