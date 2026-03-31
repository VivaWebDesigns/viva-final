export function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

export function isValidUSPhone(raw: string): boolean {
  return normalizePhoneDigits(raw).length === 10;
}

export function toE164Phone(normalized: string): string {
  return `+1${normalized}`;
}

export function formatPhoneDisplay(input: string): string {
  const normalized = normalizePhoneDigits(input);
  if (normalized.length !== 10) return input;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}
