const REPLACEMENT_CHARACTER = "\uFFFD";

export function sanitizePostgresJsonString(value: string): string {
  let sanitized = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0) {
      sanitized += REPLACEMENT_CHARACTER;
      continue;
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        sanitized += value[index] + value[index + 1];
        index += 1;
      } else {
        sanitized += REPLACEMENT_CHARACTER;
      }
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      sanitized += REPLACEMENT_CHARACTER;
      continue;
    }
    sanitized += value[index];
  }
  return sanitized;
}

export function sanitizePostgresJson<T>(value: T): T {
  if (typeof value === "string") return sanitizePostgresJsonString(value) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizePostgresJson(item)) as T;
  if (!value || typeof value !== "object" || value instanceof Date) return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    sanitized[sanitizePostgresJsonString(key)] = sanitizePostgresJson(item);
  }
  return sanitized as T;
}
