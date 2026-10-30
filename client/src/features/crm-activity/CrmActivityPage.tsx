import { Fragment, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/queryClient";
import { CALL_OUTCOMES } from "@shared/callPipeline";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  Gauge,
  Phone,
  PhoneCall,
  PhoneIncoming,
  RotateCcw,
  Target,
  Users,
} from "lucide-react";

interface CallActivity {
  dials: number;
  conversations: number;
  appointments: number;
  contactRate: number;
  appointmentRate: number;
  callBacksDue: number;
  callBacksKept: number;
  unopenedCalls: number;
}

interface RepActivity extends CallActivity {
  outcomes: Record<string, number>;
  dialsByHour: number[];
  firstCallAt: string | null;
  lastCallAt: string | null;
  userId: string;
  name: string;
  email: string;
  role: string;
  activeMinutes: number;
  signIns: number;
  lastSignInAt: string | null;
  activeDays: number;
  leadsAssigned: number;
  leadsTouched: number;
  leadsContacted: number;
  leadNotes: number;
  pipelineActions: number;
  tasksCompleted: number;
  followUpsDue: number;
  followUpsCompleted: number;
  overdueTasks: number;
  demosScheduled: number;
  demosCompleted: number;
  closedWon: number;
  closedLost: number;
  demoRate: number;
  closeRate: number;
  demoCloseRate: number;
  avgTouchesBeforeDemo: number | null;
  productivityScore: number;
  productivityStatus: "excellent" | "strong" | "needs_attention" | "at_risk";
  scoreBreakdown: {
    dials: number;
    conversations: number;
    appointments: number;
    callBacks: number;
    activity: number;
    consistency: number;
  };
}

interface ActivitySummary {
  range: { from: string; to: string; days: number };
  totals: CallActivity & {
    activeMinutes: number;
    signIns: number;
    activeDays: number;
    leadsAssigned: number;
    leadsTouched: number;
    leadsContacted: number;
    leadTouchRate: number;
    overdueTasks: number;
    pipelineActions: number;
    tasksCompleted: number;
    followUpsDue: number;
    followUpsCompleted: number;
    demosScheduled: number;
    closedWon: number;
    closedLost: number;
    demoRate: number;
    closeRate: number;
    demoCloseRate: number;
  };
  reps: RepActivity[];
  targets: { dialsPerWeekday: number; conversationsPerWeekday: number; appointmentsPerWeek: number };
  countFrom: string;
  dailySignIns: Array<{
    date: string;
    users: Array<{
      userId: string;
      name: string;
      times: string[];
    }>;
  }>;
}

type DateMode = "today" | "this_week" | "last_week" | "7" | "30" | "90" | "custom";
type ActivityRangeSelection = { days: string } | { from: string; to: string };

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatDateLong(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Same order and colors as the call dialog's choices: not reached, reached, then dead ends.
const OUTCOME_BAR = [
  { outcome: CALL_OUTCOMES.noVoicemail, label: "No answer", color: "bg-slate-300" },
  { outcome: CALL_OUTCOMES.leftVoicemail, label: "Voicemail", color: "bg-sky-300" },
  { outcome: CALL_OUTCOMES.callBack, label: "Call back", color: "bg-indigo-400" },
  { outcome: CALL_OUTCOMES.appointmentSet, label: "Appointment", color: "bg-emerald-500" },
  { outcome: CALL_OUTCOMES.notInterested, label: "Not interested", color: "bg-amber-400" },
  { outcome: CALL_OUTCOMES.wrongNumber, label: "Wrong number", color: "bg-red-400" },
];

function OutcomeBar({ rep }: { rep: RepActivity }) {
  if (rep.dials === 0) return <p className="text-xs text-gray-400">No calls logged.</p>;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100" data-testid={`bar-outcomes-${rep.userId}`}>
        {OUTCOME_BAR.map(({ outcome, color }) => {
          const n = rep.outcomes[outcome] ?? 0;
          return n > 0 ? <div key={outcome} className={color} style={{ width: `${(n / rep.dials) * 100}%` }} title={`${outcome}: ${n}`} /> : null;
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
        {OUTCOME_BAR.map(({ outcome, label, color }) => (
          <span key={outcome} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${color}`} />
            {label} {rep.outcomes[outcome] ?? 0}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatHour(hour: number) {
  return `${hour % 12 || 12}${hour < 12 ? "a" : "p"}`;
}

/** Dials per hour (Eastern), 8am–7pm plus any hour outside that with calls. */
function PaceChart({ rep }: { rep: RepActivity }) {
  if (rep.dials === 0) return null;
  const hours = rep.dialsByHour
    .map((count, hour) => ({ hour, count }))
    .filter(({ hour, count }) => (hour >= 8 && hour <= 19) || count > 0);
  const max = Math.max(...hours.map(({ count }) => count), 1);
  return (
    <div className="flex items-end gap-0.5" data-testid={`chart-pace-${rep.userId}`}>
      {hours.map(({ hour, count }) => (
        <div key={hour} className="flex flex-1 flex-col items-center gap-0.5" title={`${formatHour(hour)}: ${count} calls`}>
          <div className="flex h-10 w-full items-end">
            <div className="w-full rounded-sm bg-teal-500" style={{ height: `${(count / max) * 100}%` }} />
          </div>
          <span className="text-[9px] text-gray-400">{formatHour(hour)}</span>
        </div>
      ))}
    </div>
  );
}

function formatTime(value: string | null) {
  if (!value) return "None";
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function toLocalDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function dateKeysBetween(from: string, to: string) {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return dates;

  while (cursor <= end) {
    dates.push(toLocalDateInput(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getDateRange(mode: DateMode, customFrom: string, customTo: string): ActivityRangeSelection {
  const today = new Date();
  const todayKey = toLocalDateInput(today);

  if (mode === "today") return { from: todayKey, to: todayKey };
  if (mode === "this_week") {
    return { from: toLocalDateInput(startOfWeek(today)), to: todayKey };
  }
  if (mode === "last_week") {
    const end = startOfWeek(today);
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { from: toLocalDateInput(start), to: toLocalDateInput(end) };
  }
  if (mode === "custom") {
    const from = customFrom || customTo || todayKey;
    const to = customTo || customFrom || todayKey;
    return from <= to ? { from, to } : { from: to, to: from };
  }

  return { days: mode };
}

function getScoreTone(status: RepActivity["productivityStatus"]) {
  if (status === "excellent") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "strong") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (status === "needs_attention") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function getScoreLabel(status: RepActivity["productivityStatus"]) {
  if (status === "excellent") return "Excellent";
  if (status === "strong") return "Strong";
  if (status === "needs_attention") return "Needs attention";
  return "At risk";
}

function StatCard({ label, value, icon: Icon, tone }: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
      {children}
    </div>
  );
}

export default function CrmActivityPage() {
  const todayKey = useMemo(() => toLocalDateInput(new Date()), []);
  const [dateMode, setDateMode] = useState<DateMode>("today");
  const [customFrom, setCustomFrom] = useState(todayKey);
  const [customTo, setCustomTo] = useState(todayKey);
  const [expandedSignInRepId, setExpandedSignInRepId] = useState<string | null>(null);
  const [showAllSignInsForRepId, setShowAllSignInsForRepId] = useState<string | null>(null);

  const activityRange = useMemo(
    () => getDateRange(dateMode, customFrom, customTo),
    [dateMode, customFrom, customTo],
  );
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if ("days" in activityRange) {
      params.set("days", activityRange.days);
    } else {
      params.set("from", activityRange.from);
      params.set("to", activityRange.to);
    }
    return params.toString();
  }, [activityRange]);

  const { data, error, isError, isLoading } = useQuery<ActivitySummary>({
    queryKey: [`/api/crm-activity/summary?${queryString}`],
    staleTime: STALE.MEDIUM,
  });

  const sortedReps = useMemo(
    () => [...(data?.reps ?? [])].sort((a, b) => b.productivityScore - a.productivityScore || b.leadsTouched - a.leadsTouched),
    [data?.reps],
  );

  const dateKeys = useMemo(() => {
    if (!data) return [];
    return dateKeysBetween(data.range.from.slice(0, 10), data.range.to.slice(0, 10));
  }, [data]);

  const signInSummaries = useMemo(() => {
    if (!data) return [];
    const signInsByRep = new Map<string, Map<string, string[]>>();
    for (const day of data.dailySignIns) {
      for (const entry of day.users) {
        const repDays = signInsByRep.get(entry.userId) ?? new Map<string, string[]>();
        repDays.set(day.date, entry.times);
        signInsByRep.set(entry.userId, repDays);
      }
    }

    return sortedReps.map((rep) => {
      const repDays = signInsByRep.get(rep.userId) ?? new Map<string, string[]>();
      const signInTimes = dateKeys
        .flatMap((date) => repDays.get(date) ?? [])
        .sort();
      const dayRows = dateKeys
        .slice()
        .reverse()
        .map((date) => ({ date, times: repDays.get(date) ?? [] }));

      return {
        rep,
        signInCount: signInTimes.length,
        firstSignIn: signInTimes[0] ?? null,
        latestSignIn: signInTimes.at(-1) ?? null,
        dayRows,
      };
    });
  }, [data, dateKeys, sortedReps]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-crm-activity-title">
            CRM Activity Intelligence
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Admin view of setter calling, call-back follow-through, and CRM work patterns.
          </p>
        </div>
        <div className="flex flex-col gap-2" data-testid="filter-activity-range">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 p-1">
            {([
              ["today", "Today"],
              ["this_week", "This week"],
              ["last_week", "Last week"],
              ["7", "7d"],
              ["30", "30d"],
              ["90", "90d"],
              ["custom", "Custom"],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setDateMode(mode)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  dateMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
                data-testid={`button-activity-range-${mode}`}
              >
                {label}
              </button>
            ))}
          </div>
          {dateMode === "custom" && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <CalendarDays className="h-3.5 w-3.5" />
                <input aria-label="Start date"
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
                  data-testid="input-activity-custom-from"
                />
              </label>
              <span className="text-xs text-gray-400">to</span>
              <input aria-label="End date"
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
                data-testid="input-activity-custom-to"
              />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700" data-testid="error-crm-activity-summary">
          <p className="font-semibold">CRM Activity Intelligence could not load.</p>
          <p className="mt-1 text-red-600">
            {error instanceof Error ? error.message : "Refresh the page or try another date range."}
          </p>
        </div>
      ) : data ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
            <StatCard label="Dials" value={data.totals.dials} icon={Phone} tone="bg-teal-500" />
            <StatCard label="Conversations" value={`${data.totals.conversations} · ${data.totals.contactRate}%`} icon={PhoneIncoming} tone="bg-indigo-500" />
            <StatCard label="Appointments" value={`${data.totals.appointments} · ${data.totals.appointmentRate}%`} icon={Target} tone="bg-emerald-500" />
            <StatCard label="Call-backs on time" value={`${data.totals.callBacksKept}/${data.totals.callBacksDue}`} icon={RotateCcw} tone="bg-violet-500" />
            <StatCard label="CRM active time" value={formatMinutes(data.totals.activeMinutes)} icon={Clock} tone="bg-cyan-500" />
            <StatCard label="First CRM opens" value={data.totals.signIns} icon={Users} tone="bg-slate-500" />
            <StatCard label="Calls w/o lead open" value={data.totals.unopenedCalls} icon={AlertTriangle} tone={data.totals.unopenedCalls > 0 ? "bg-amber-500" : "bg-slate-400"} />
          </div>

          <section className="mb-6 rounded-lg border border-gray-200 bg-white" data-testid="card-productivity-scores">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Productivity Scores</h2>
                <p className="text-xs text-gray-500">
                  Targets: {data.targets.dialsPerWeekday} dials and {data.targets.conversationsPerWeekday} conversations a weekday, {data.targets.appointmentsPerWeek} appointments a week.
                  Calls are counted from logged call tasks, starting{" "}
                  {new Date(data.countFrom).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Gauge className="h-4 w-4" />
                Score out of 100
              </div>
            </div>
            {sortedReps.length === 0 ? (
              <div className="p-5">
                <EmptyState>No score data for this range yet.</EmptyState>
              </div>
            ) : (
              <div className="grid gap-4 p-5 lg:grid-cols-2 xl:grid-cols-3">
                {sortedReps.map((rep) => (
                  <div key={rep.userId} className="rounded-lg border border-gray-200 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">{rep.name}</p>
                        <p className="text-xs text-gray-500">{rep.role.replace("_", " ")}</p>
                      </div>
                      <div className={`rounded-lg border px-3 py-2 text-right ${getScoreTone(rep.productivityStatus)}`}>
                        <p className="text-2xl font-bold leading-none">{rep.productivityScore}</p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide">{getScoreLabel(rep.productivityStatus)}</p>
                      </div>
                    </div>
                    <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-gray-50 py-2">
                        <p className="text-lg font-bold text-gray-900">{rep.dials}</p>
                        <p className="text-[11px] text-gray-500">Dials</p>
                      </div>
                      <div className="rounded-md bg-gray-50 py-2">
                        <p className="text-lg font-bold text-gray-900">{rep.conversations}</p>
                        <p className="text-[11px] text-gray-500">Conversations · {rep.contactRate}%</p>
                      </div>
                      <div className="rounded-md bg-gray-50 py-2">
                        <p className="text-lg font-bold text-gray-900">{rep.appointments}</p>
                        <p className="text-[11px] text-gray-500">Appointments · {rep.appointmentRate}%</p>
                      </div>
                    </div>
                    <div className="mb-3">
                      <OutcomeBar rep={rep} />
                    </div>
                    <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <span>Call-backs on time: <strong className="text-gray-900">{rep.callBacksKept}/{rep.callBacksDue}</strong></span>
                      <span>Active: <strong className="text-gray-900">{formatMinutes(rep.activeMinutes)}</strong></span>
                      <span>First call: <strong className="text-gray-900">{formatTime(rep.firstCallAt)}</strong></span>
                      <span>Last call: <strong className="text-gray-900">{formatTime(rep.lastCallAt)}</strong></span>
                      <span>Active days: <strong className="text-gray-900">{rep.activeDays}</strong></span>
                      <span className={rep.unopenedCalls > 0 ? "text-amber-700" : undefined}>
                        Calls w/o lead open: <strong className={rep.unopenedCalls > 0 ? "text-amber-800" : "text-gray-900"}>{rep.unopenedCalls}</strong>
                      </span>
                    </div>
                    <PaceChart rep={rep} />
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-gray-400">
                      <PhoneCall className="h-3 w-3" />
                      Score: dials {rep.scoreBreakdown.dials} · conversations {rep.scoreBreakdown.conversations} · appointments {rep.scoreBreakdown.appointments} · call-backs {rep.scoreBreakdown.callBacks}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mb-6 rounded-lg border border-gray-200 bg-white" data-testid="card-daily-sign-ins">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">First CRM Opens</h2>
                <p className="text-xs text-gray-500">The first time each day a rep opened the CRM in a browser, not a login.</p>
              </div>
              <span className="text-xs text-gray-500">{data.totals.signIns} total</span>
            </div>
            {signInSummaries.length === 0 ? (
              <div className="p-5">
                <EmptyState>No CRM opens recorded for this range yet.</EmptyState>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Rep</th>
                      <th className="px-5 py-3 font-semibold">First opens</th>
                      <th className="px-5 py-3 font-semibold">Earliest</th>
                      <th className="px-5 py-3 font-semibold">Latest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {signInSummaries.map((summary) => {
                      const expanded = expandedSignInRepId === summary.rep.userId;
                      const showAll = showAllSignInsForRepId === summary.rep.userId;
                      const signInDayRows = summary.dayRows.filter((day) => day.times.length > 0);
                      const visibleDayRows = showAll ? signInDayRows : signInDayRows.slice(0, 3);
                      return (
                        <Fragment key={summary.rep.userId}>
                          <tr key={summary.rep.userId} className="hover:bg-gray-50/70">
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedSignInRepId(expanded ? null : summary.rep.userId);
                                  if (expanded) setShowAllSignInsForRepId(null);
                                }}
                                className="flex items-center gap-2 text-left"
                                data-testid={`button-expand-signins-${summary.rep.userId}`}
                              >
                                {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                                <span>
                                  <span className="block font-medium text-gray-900">{summary.rep.name}</span>
                                  <span className="block text-xs text-gray-500">{summary.rep.email}</span>
                                </span>
                              </button>
                            </td>
                            <td className="px-5 py-4 font-medium text-gray-900">
                              {summary.signInCount}
                            </td>
                            <td className="px-5 py-4 text-gray-700">
                              {formatTime(summary.firstSignIn)}
                            </td>
                            <td className="px-5 py-4 text-gray-700">
                              {formatTime(summary.latestSignIn)}
                            </td>
                          </tr>
                          {expanded && (
                            <tr key={`${summary.rep.userId}-details`} className="bg-gray-50/60">
                              <td colSpan={4} className="px-12 py-4">
                                {signInDayRows.length === 0 ? (
                                  <p className="text-sm text-gray-500">No CRM opens in this range.</p>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                      {visibleDayRows.map((day) => (
                                        <div key={day.date} className="rounded-md border border-gray-200 bg-white p-3">
                                          <p className="text-xs font-semibold text-gray-900">{formatDateLong(day.date)}</p>
                                          <p className="mt-1 text-sm text-gray-600">{day.times.map(formatTime).join(", ")}</p>
                                        </div>
                                      ))}
                                    </div>
                                    {signInDayRows.length > 3 && (
                                      <button
                                        type="button"
                                        onClick={() => setShowAllSignInsForRepId(showAll ? null : summary.rep.userId)}
                                        className="text-sm font-medium text-teal-700 hover:text-teal-800"
                                      >
                                        {showAll ? "Show recent days" : `View all days (${signInDayRows.length})`}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </>
      ) : null}
    </div>
  );
}
