import { formatPhoneDisplay, normalizePhoneDigits } from "@shared/phone";

export function usePhoneField() {
  function onPhoneBlur(
    value: string,
    onChange: (val: string) => void,
  ) {
    if (!value) return;
    const normalized = normalizePhoneDigits(value);
    if (normalized.length === 10) {
      onChange(formatPhoneDisplay(normalized));
    }
  }

  function normalizeOnSubmit(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const normalized = normalizePhoneDigits(value);
    return normalized || value;
  }

  return { onPhoneBlur, normalizeOnSubmit };
}
