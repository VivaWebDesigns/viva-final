function formatParts(d: Date, tz: string): Record<string, string> {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
}

export function buildFollowUpMoment(
  dateStr: string,
  timeStr: string,
  tz: string,
): Date | null {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [h, min] = timeStr.split(":").map(Number);

    let utcMs = Date.UTC(y, m - 1, d, h, min, 0);

    for (let pass = 0; pass < 2; pass++) {
      const probe = new Date(utcMs);
      const parts = formatParts(probe, tz);
      const localMs = Date.UTC(
        +parts.year, +parts.month - 1, +parts.day,
        +parts.hour, +parts.minute, +parts.second,
      );
      utcMs += Date.UTC(y, m - 1, d, h, min, 0) - localMs;
    }

    return new Date(utcMs);
  } catch {
    return null;
  }
}

export function getUTCDateString(dueDate: string | Date): string {
  const d = new Date(dueDate);
  const y  = d.getUTCFullYear();
  const m  = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export interface FollowUpDisplay {
  dateLabel:      string;
  leadTimeLabel:  string;
  repTimeLabel:   string | null;
  moment:         Date | null;
}

export function formatFollowUpForDisplay(
  dueDate:          string | Date,
  followUpTime:     string | null | undefined,
  followUpTimezone: string | null | undefined,
  repTimezone:      string,
): FollowUpDisplay {
  const dateLabel = new Date(dueDate).toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "UTC",
  });

  if (!followUpTime || !followUpTimezone) {
    return { dateLabel, leadTimeLabel: "", repTimeLabel: null, moment: null };
  }

  const dateStr = getUTCDateString(dueDate);
  const moment  = buildFollowUpMoment(dateStr, followUpTime, followUpTimezone);

  if (!moment) {
    return { dateLabel, leadTimeLabel: "", repTimeLabel: null, moment: null };
  }

  const leadTime = new Intl.DateTimeFormat("en-US", {
    timeZone: followUpTimezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(moment);

  const tzAbbr = new Intl.DateTimeFormat("en-US", {
    timeZone: followUpTimezone,
    timeZoneName: "short",
  }).formatToParts(moment).find(p => p.type === "timeZoneName")?.value ?? "";

  const leadTimeLabel = tzAbbr ? `${leadTime} ${tzAbbr}` : leadTime;

  const isSameTZ = followUpTimezone === repTimezone;
  let repTimeLabel: string | null = null;
  if (!isSameTZ) {
    repTimeLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: repTimezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(moment);
  }

  return { dateLabel, leadTimeLabel, repTimeLabel, moment };
}
