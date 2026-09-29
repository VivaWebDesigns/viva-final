import { resolveRepTimezone } from "@/lib/timezone";

export const TASK_PRESET_VALUES = ["1d", "2d", "3d", "5d", "1w", "2w", "1mo", "2mo", "6mo", "1yr", "custom"] as const;
export type TaskPreset = typeof TASK_PRESET_VALUES[number];

export const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 9; h <= 18; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 18 && m > 0) break;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
})();

export function formatTimeSlot(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${mStr} ${suffix}`;
}

function calcAbsoluteUtcMs(dateStr: string, time24: string, timezone: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [h, m] = time24.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, h, m, 0);
  const probe = new Date(naive);
  const localH = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", hour12: false }).format(probe),
    10,
  );
  const localM = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, minute: "2-digit", hour12: false }).format(probe),
    10,
  );
  const offsetMinutes = h * 60 + m - ((localH === 24 ? 0 : localH) * 60 + localM);
  return naive + offsetMinutes * 60_000;
}

function fmtTime(absDate: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(absDate);
}

function fmtTZAbbr(absDate: Date, tz: string): string {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(absDate)
      .find((p) => p.type === "timeZoneName")?.value ?? ""
  );
}

export function formatTaskTimeDisplay(
  dueDate: Date | string,
  followUpTime: string,
  followUpTimezone: string | null | undefined,
): string {
  if (!followUpTimezone) return formatTimeSlot(followUpTime);
  const browserTZ = resolveRepTimezone();
  if (followUpTimezone === browserTZ) return formatTimeSlot(followUpTime);
  const d = new Date(dueDate);
  const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const absDate = new Date(calcAbsoluteUtcMs(dateStr, followUpTime, followUpTimezone));
  const leadTime = fmtTime(absDate, followUpTimezone);
  const leadAbbr = fmtTZAbbr(absDate, followUpTimezone);
  const repTime = fmtTime(absDate, browserTZ);
  return `${leadTime} ${leadAbbr} · ${repTime} your time`;
}

export function todayLocalString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function calcDueDateString(preset: Exclude<TaskPreset, "custom">): string {
  const d = new Date();
  switch (preset) {
    case "1d":  d.setDate(d.getDate() + 1); break;
    case "2d":  d.setDate(d.getDate() + 2); break;
    case "3d":  d.setDate(d.getDate() + 3); break;
    case "5d":  d.setDate(d.getDate() + 5); break;
    case "1w":  d.setDate(d.getDate() + 7); break;
    case "2w":  d.setDate(d.getDate() + 14); break;
    case "1mo": d.setMonth(d.getMonth() + 1); break;
    case "2mo": d.setMonth(d.getMonth() + 2); break;
    case "6mo": d.setMonth(d.getMonth() + 6); break;
    case "1yr": d.setFullYear(d.getFullYear() + 1); break;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
