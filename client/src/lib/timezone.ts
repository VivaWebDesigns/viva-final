export function resolveRepTimezone(
  user?: { timezone?: string | null } | null,
): string {
  if (user?.timezone) return user.timezone;
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
