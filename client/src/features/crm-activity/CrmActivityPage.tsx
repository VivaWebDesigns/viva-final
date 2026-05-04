import { Fragment, lazy, Suspense, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/queryClient";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Gauge,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

const CrmActivityTrendCharts = lazy(() => import("./CrmActivityTrendCharts"));

interface RepActivity {
  userId: string;
  name: string;
  email: string;
  role: string;
  activeMinutes: number;
  crmMinutes: number;
  pipelineMinutes: number;
  taskMinutes: number;
  signIns: number;
  lastSignInAt: string | null;
  activeDays: number;
  signedInNoActivityDays: number;
  leadsAssigned: number;
  leadsTouched: number;
  leadTouchRate: number;
  leadNotes: number;
  pipelineActions: number;
  tasksCreated: number;
  tasksCompleted: number;
  overdueTasks: number;
  followUpCompletionRate: number;
  avgFirstTouchMinutes: number | null;
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
    leadWork: number;
    activity: number;
    firstTouch: number;
    pipelineAndTasks: number;
    followUp: number;
    outcomes: number;
    consistency: number;
    overduePenalty: number;
    noActivityPenalty: number;
  };
}

interface RiskLead {
  id: string;
  title: string;
  createdAt: string;
  assignedName: string | null;
}

interface RiskOpportunity {
  id: string;
  title: string;
  updatedAt: string;
  nextActionDate: string | null;
  assignedName: string | null;
}

interface ActivitySummary {
  range: { from: string; to: string; days: number };
  totals: {
    activeMinutes: number;
    signIns: number;
    activeDays: number;
    signedInNoActivityDays: number;
    leadsAssigned: number;
    leadsTouched: number;
    leadTouchRate: number;
    overdueTasks: number;
    pipelineActions: number;
    tasksCompleted: number;
    demosScheduled: number;
    closedWon: number;
    closedLost: number;
    demoRate: number;
    closeRate: number;
    demoCloseRate: number;
  };
  reps: RepActivity[];
  dailySignIns: Array<{
    date: string;
    users: Array<{
      userId: string;
      name: string;
      times: string[];
    }>;
  }>;
  dailyTrend: Array<{
    date: string;
    activeMinutes: number;
    signIns: number;
    leadsWorked: number;
    pipelineActions: number;
    tasksCompleted: number;
    demosScheduled: number;
    closedWon: number;
    signedInNoActivity: number;
    users: Array<{
      userId: string;
      name: string;
      activeMinutes: number;
      signIns: number;
      leadsWorked: number;
      pipelineActions: number;
      tasksCompleted: number;
      demosScheduled: number;
      closedWon: number;
      firstSignInAt: string | null;
      lastActivityAt: string | null;
      signedInNoActivity: boolean;
    }>;
  }>;
  riskQueues: {
    untouchedLeads: RiskLead[];
    staleOpportunities: RiskOpportunity[];
  };
}

type DateMode = "today" | "this_week" | "last_week" | "7" | "30" | "90" | "custom";
type TrendMetric = "activeMinutes" | "leadsWorked" | "signIns" | "demosScheduled" | "closedWon";
type ActivityRangeSelection = { days: string } | { from: string; to: string };

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatDate(value: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateLong(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateShort(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(value: string | null) {
  if (!value) return "No sign-in";
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

function getSignInStatus(missedDays: number, noActivityDays: number) {
  if (missedDays >= 2) return { label: "At risk", className: "border-red-200 bg-red-50 text-red-700" };
  if (missedDays > 0 || noActivityDays > 0) return { label: "Needs review", className: "border-amber-200 bg-amber-50 text-amber-700" };
  return { label: "Good", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
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

function ChartGridFallback() {
  return (
    <>
      <div className="h-72 animate-pulse rounded-lg bg-gray-100" />
      <div className="h-72 animate-pulse rounded-lg bg-gray-100" />
    </>
  );
}

export default function CrmActivityPage() {
  const todayKey = useMemo(() => toLocalDateInput(new Date()), []);
  const [dateMode, setDateMode] = useState<DateMode>("7");
  const [customFrom, setCustomFrom] = useState(todayKey);
  const [customTo, setCustomTo] = useState(todayKey);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("leadsWorked");
  const [trendRepId, setTrendRepId] = useState("all");
  const [expandedSignInRepId, setExpandedSignInRepId] = useState<string | null>(null);
  const [showAllSignInsForRepId, setShowAllSignInsForRepId] = useState<string | null>(null);
  const [showRiskQueues, setShowRiskQueues] = useState(false);

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

  const trendLabel = {
    activeMinutes: "Active minutes",
    leadsWorked: "Leads worked",
    signIns: "Sign-ins",
    demosScheduled: "Demos scheduled",
    closedWon: "Closed won",
  }[trendMetric];

  const trendRepOptions = useMemo(
    () => sortedReps.map((rep) => ({ id: rep.userId, name: rep.name })),
    [sortedReps],
  );
  const selectedTrendRep = trendRepOptions.find((rep) => rep.id === trendRepId);
  const trendData = useMemo(() => {
    if (!data || trendRepId === "all") return data?.dailyTrend ?? [];
    return data.dailyTrend.map((day) => {
      const repDay = day.users.find((userDay) => userDay.userId === trendRepId);
      return {
        ...day,
        activeMinutes: repDay?.activeMinutes ?? 0,
        signIns: repDay?.signIns ?? 0,
        leadsWorked: repDay?.leadsWorked ?? 0,
        pipelineActions: repDay?.pipelineActions ?? 0,
        tasksCompleted: repDay?.tasksCompleted ?? 0,
        demosScheduled: repDay?.demosScheduled ?? 0,
        closedWon: repDay?.closedWon ?? 0,
        signedInNoActivity: repDay?.signedInNoActivity ? 1 : 0,
        users: repDay ? [repDay] : [],
      };
    });
  }, [data, trendRepId]);

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

    const dailyActivityByRep = new Map<string, Map<string, { noActivity: boolean }>>();
    for (const day of data.dailyTrend) {
      for (const entry of day.users) {
        const repDays = dailyActivityByRep.get(entry.userId) ?? new Map<string, { noActivity: boolean }>();
        repDays.set(day.date, { noActivity: entry.signedInNoActivity });
        dailyActivityByRep.set(entry.userId, repDays);
      }
    }

    return sortedReps.map((rep) => {
      const repDays = signInsByRep.get(rep.userId) ?? new Map<string, string[]>();
      const signedInDates = dateKeys.filter((date) => (repDays.get(date)?.length ?? 0) > 0);
      const missedDays = Math.max(dateKeys.length - signedInDates.length, 0);
      const noActivityDays = dateKeys.filter((date) => dailyActivityByRep.get(rep.userId)?.get(date)?.noActivity).length;
      const latestSignIn = signedInDates
        .flatMap((date) => repDays.get(date) ?? [])
        .sort((a, b) => b.localeCompare(a))[0] ?? null;
      const firstSignInMinutes = signedInDates
        .map((date) => {
          const first = [...(repDays.get(date) ?? [])].sort()[0];
          if (!first) return null;
          const parsed = new Date(first);
          return Number.isNaN(parsed.getTime()) ? null : parsed.getHours() * 60 + parsed.getMinutes();
        })
        .filter((value): value is number => value !== null);
      const avgFirstSignInMinutes = firstSignInMinutes.length > 0
        ? Math.round(firstSignInMinutes.reduce((sum, value) => sum + value, 0) / firstSignInMinutes.length)
        : null;
      const dayRows = dateKeys
        .slice()
        .reverse()
        .map((date) => ({ date, times: repDays.get(date) ?? [] }));

      return {
        rep,
        expectedDays: dateKeys.length,
        signedInDays: signedInDates.length,
        missedDays,
        noActivityDays,
        latestSignIn,
        avgFirstSignInMinutes,
        dayRows,
        status: getSignInStatus(missedDays, noActivityDays),
      };
    });
  }, [data, dateKeys, sortedReps]);

  function formatMinutesAsTime(minutes: number | null) {
    if (minutes === null) return "No sign-ins";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const date = new Date();
    date.setHours(hours, mins, 0, 0);
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-crm-activity-title">
            CRM Activity Intelligence
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Admin view of lead handling, follow-up health, and CRM work patterns.
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
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
                  data-testid="input-activity-custom-from"
                />
              </label>
              <span className="text-xs text-gray-400">to</span>
              <input
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
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="CRM active time" value={formatMinutes(data.totals.activeMinutes)} icon={Clock} tone="bg-teal-500" />
            <StatCard label="Sign-ins" value={data.totals.signIns} icon={Users} tone="bg-slate-500" />
            <StatCard label="Leads touched" value={data.totals.leadsTouched} icon={Target} tone="bg-cyan-500" />
            <StatCard label="Demo rate" value={`${data.totals.demoRate}%`} icon={TrendingUp} tone="bg-emerald-500" />
            <StatCard label="Closed won" value={data.totals.closedWon} icon={BarChart3} tone="bg-indigo-500" />
            <StatCard label="Overdue tasks" value={data.totals.overdueTasks} icon={AlertTriangle} tone={data.totals.overdueTasks > 0 ? "bg-red-500" : "bg-gray-400"} />
          </div>

          <section className="mb-6 rounded-lg border border-gray-200 bg-white" data-testid="card-productivity-scores">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Productivity Scores</h2>
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
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <span>Leads worked: <strong className="text-gray-900">{rep.leadsTouched}</strong></span>
                      <span>Demos: <strong className="text-gray-900">{rep.demosScheduled}</strong></span>
                      <span>Closed won: <strong className="text-gray-900">{rep.closedWon}</strong></span>
                      <span>Active days: <strong className="text-gray-900">{rep.activeDays}</strong></span>
                      <span>Demo rate: <strong className="text-gray-900">{rep.demoRate}%</strong></span>
                      <span>Close rate: <strong className="text-gray-900">{rep.closeRate}%</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mb-6 rounded-lg border border-gray-200 bg-white" data-testid="card-rep-activity-table">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Rep Activity</h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Users className="h-4 w-4" />
                {sortedReps.length} reps
              </div>
            </div>
            {sortedReps.length === 0 ? (
              <div className="p-5">
                <EmptyState>No sales rep activity for this range yet.</EmptyState>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1160px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Rep</th>
                      <th className="px-5 py-3 font-semibold">Score</th>
                      <th className="px-5 py-3 font-semibold">Sign-ins</th>
                      <th className="px-5 py-3 font-semibold">Active</th>
                      <th className="px-5 py-3 font-semibold">Leads</th>
                      <th className="px-5 py-3 font-semibold">First touch</th>
                      <th className="px-5 py-3 font-semibold">Demos</th>
                      <th className="px-5 py-3 font-semibold">Closed</th>
                      <th className="px-5 py-3 font-semibold">Follow-up</th>
                      <th className="px-5 py-3 font-semibold">Overdue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedReps.map((rep) => (
                      <tr key={rep.userId} className="hover:bg-gray-50/70">
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900">{rep.name}</p>
                          <p className="text-xs text-gray-500">{rep.email}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getScoreTone(rep.productivityStatus)}`}>
                            {rep.productivityScore} · {getScoreLabel(rep.productivityStatus)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-700">
                          <p>{rep.signIns}</p>
                          <p className="text-xs text-gray-400">Last {formatTime(rep.lastSignInAt)}</p>
                        </td>
                        <td className="px-5 py-4 text-gray-700">
                          <p>{formatMinutes(rep.activeMinutes)}</p>
                          <p className="text-xs text-gray-400">CRM {formatMinutes(rep.crmMinutes)} · pipeline {formatMinutes(rep.pipelineMinutes)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900">{rep.leadsTouched}/{rep.leadsAssigned}</p>
                          <p className="text-xs text-gray-500">{rep.leadTouchRate}% touched</p>
                        </td>
                        <td className="px-5 py-4 text-gray-700">
                          {rep.avgFirstTouchMinutes === null ? "No touches" : formatMinutes(rep.avgFirstTouchMinutes)}
                        </td>
                        <td className="px-5 py-4 text-gray-700">
                          <p>{rep.demosScheduled}</p>
                          <p className="text-xs text-gray-500">{rep.demoRate}% of worked</p>
                        </td>
                        <td className="px-5 py-4 text-gray-700">
                          <p>{rep.closedWon} won</p>
                          <p className="text-xs text-gray-500">{rep.closeRate}% close</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-gray-700">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            {rep.tasksCompleted}/{rep.tasksCreated}
                          </div>
                          <p className="text-xs text-gray-500">{rep.followUpCompletionRate}% complete</p>
                        </td>
                        <td className={`px-5 py-4 font-medium ${rep.overdueTasks > 0 ? "text-red-600" : "text-gray-500"}`}>
                          {rep.overdueTasks}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mb-6 rounded-lg border border-gray-200 bg-white" data-testid="card-activity-trends">
            <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Daily Trend Graph</h2>
                <p className="text-xs text-gray-500">Spot consistency, outcomes, and sign-ins without activity.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={trendRepId}
                  onChange={(event) => setTrendRepId(event.target.value)}
                  className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700"
                  data-testid="select-trend-rep-filter"
                >
                  <option value="all">All reps</option>
                  {trendRepOptions.map((rep) => (
                    <option key={rep.id} value={rep.id}>{rep.name}</option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
                  {([
                    ["leadsWorked", "Leads"],
                    ["activeMinutes", "Active"],
                    ["signIns", "Sign-ins"],
                    ["demosScheduled", "Demos"],
                    ["closedWon", "Won"],
                  ] as const).map(([metric, label]) => (
                    <button
                      key={metric}
                      onClick={() => setTrendMetric(metric)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        trendMetric === metric ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {selectedTrendRep && (
              <p className="border-b border-gray-100 px-5 py-2 text-xs text-gray-500">
                Showing daily trend for {selectedTrendRep.name}.
              </p>
            )}
            <div className="grid gap-6 p-5 xl:grid-cols-[1.5fr_1fr]">
              <Suspense fallback={<ChartGridFallback />}>
                <CrmActivityTrendCharts trendData={trendData} trendMetric={trendMetric} trendLabel={trendLabel} />
              </Suspense>
            </div>
          </section>

          <section className="mb-6 rounded-lg border border-gray-200 bg-white" data-testid="card-daily-sign-ins">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Rep Sign-ins</h2>
                <p className="text-xs text-gray-500">Range summary with exact times available per rep.</p>
              </div>
              <span className="text-xs text-gray-500">{data.totals.signIns} total</span>
            </div>
            {signInSummaries.length === 0 ? (
              <div className="p-5">
                <EmptyState>No sign-ins recorded for this range yet.</EmptyState>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Rep</th>
                      <th className="px-5 py-3 font-semibold">Signed in</th>
                      <th className="px-5 py-3 font-semibold">Missed</th>
                      <th className="px-5 py-3 font-semibold">No activity</th>
                      <th className="px-5 py-3 font-semibold">Avg first sign-in</th>
                      <th className="px-5 py-3 font-semibold">Last sign-in</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
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
                              {summary.signedInDays}/{summary.expectedDays}
                            </td>
                            <td className={`px-5 py-4 font-medium ${summary.missedDays > 0 ? "text-red-600" : "text-gray-600"}`}>
                              {summary.missedDays}
                            </td>
                            <td className={`px-5 py-4 font-medium ${summary.noActivityDays > 0 ? "text-amber-600" : "text-gray-600"}`}>
                              {summary.noActivityDays}
                            </td>
                            <td className="px-5 py-4 text-gray-700">
                              {formatMinutesAsTime(summary.avgFirstSignInMinutes)}
                            </td>
                            <td className="px-5 py-4 text-gray-700">
                              {formatTime(summary.latestSignIn)}
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${summary.status.className}`}>
                                {summary.status.label}
                              </span>
                            </td>
                          </tr>
                          {expanded && (
                            <tr key={`${summary.rep.userId}-details`} className="bg-gray-50/60">
                              <td colSpan={7} className="px-12 py-4">
                                {signInDayRows.length === 0 ? (
                                  <p className="text-sm text-gray-500">No sign-in timestamps in this range.</p>
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
                                        {showAll ? "Show recent sign-ins" : `View all sign-ins (${signInDayRows.length} days)`}
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

          <section className="rounded-lg border border-gray-200 bg-white" data-testid="card-risk-queues">
            <button
              type="button"
              onClick={() => setShowRiskQueues((value) => !value)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              data-testid="button-toggle-risk-queues"
            >
              <div>
                <h2 className="text-base font-semibold text-gray-900">Risk Queues</h2>
                <p className="text-xs text-gray-500">Untouched assigned leads and stale open opportunities.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                  {data.riskQueues.untouchedLeads.length} untouched
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  {data.riskQueues.staleOpportunities.length} stale
                </span>
                {showRiskQueues ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
              </div>
            </button>
            {showRiskQueues && (
              <div className="grid grid-cols-1 gap-6 border-t border-gray-100 p-5 xl:grid-cols-2">
                <section data-testid="card-untouched-leads">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Untouched Assigned Leads</h3>
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                      {data.riskQueues.untouchedLeads.length}
                    </span>
                  </div>
                  {data.riskQueues.untouchedLeads.length === 0 ? (
                    <EmptyState>No assigned leads older than 24 hours are untouched.</EmptyState>
                  ) : (
                    <div className="space-y-2">
                      {data.riskQueues.untouchedLeads.map((lead) => (
                        <Link key={lead.id} href={`/admin/crm/leads/${lead.id}`}>
                          <div className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">{lead.title}</p>
                              <p className="mt-1 text-xs text-gray-500">{lead.assignedName || "Unassigned"} · created {formatDate(lead.createdAt)}</p>
                            </div>
                            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>

                <section data-testid="card-stale-opportunities">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Stale Open Opportunities</h3>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      {data.riskQueues.staleOpportunities.length}
                    </span>
                  </div>
                  {data.riskQueues.staleOpportunities.length === 0 ? (
                    <EmptyState>No open opportunities are stale for this range.</EmptyState>
                  ) : (
                    <div className="space-y-2">
                      {data.riskQueues.staleOpportunities.map((opp) => (
                        <Link key={opp.id} href={`/admin/pipeline/opportunities/${opp.id}`}>
                          <div className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">{opp.title}</p>
                              <p className="mt-1 text-xs text-gray-500">{opp.assignedName || "Unassigned"} · updated {formatDate(opp.updatedAt)}</p>
                            </div>
                            <Clock className="h-4 w-4 flex-shrink-0 text-amber-500" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
