import { useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/queryClient";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Gauge,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  const [days, setDays] = useState("7");
  const [trendMetric, setTrendMetric] = useState<"activeMinutes" | "leadsWorked" | "signIns" | "demosScheduled" | "closedWon">("leadsWorked");
  const { data, isLoading } = useQuery<ActivitySummary>({
    queryKey: [`/api/crm-activity/summary?days=${days}`],
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
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1" data-testid="filter-activity-range">
          {["7", "30", "90"].map((range) => (
            <button
              key={range}
              onClick={() => setDays(range)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                days === range ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
              data-testid={`button-activity-range-${range}`}
            >
              {range}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-lg bg-gray-100" />
          ))}
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
                    <div className="mt-3 space-y-1 text-[11px] text-gray-500">
                      <p>Score: lead work {rep.scoreBreakdown.leadWork}, activity {rep.scoreBreakdown.activity}, first touch {rep.scoreBreakdown.firstTouch}, outcomes {rep.scoreBreakdown.outcomes}</p>
                      {(rep.scoreBreakdown.overduePenalty > 0 || rep.scoreBreakdown.noActivityPenalty > 0) && (
                        <p className="text-red-500">
                          Penalties: overdue -{rep.scoreBreakdown.overduePenalty}, sign-in/no work -{rep.scoreBreakdown.noActivityPenalty}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mb-6 rounded-lg border border-gray-200 bg-white" data-testid="card-activity-trends">
            <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Daily Trend Graph</h2>
                <p className="text-xs text-gray-500">Spot consistency, outcomes, and sign-ins without activity.</p>
              </div>
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
            <div className="grid gap-6 p-5 xl:grid-cols-[1.5fr_1fr]">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip labelFormatter={(value) => formatDateLong(String(value))} formatter={(value) => [value, trendLabel]} />
                    <Line type="monotone" dataKey={trendMetric} stroke="#0D9488" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip labelFormatter={(value) => formatDateLong(String(value))} />
                    <Bar dataKey="signedInNoActivity" name="Signed in, no activity" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-gray-200 bg-white p-5" data-testid="card-untouched-leads">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Untouched Assigned Leads</h2>
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

            <section className="rounded-lg border border-gray-200 bg-white p-5" data-testid="card-stale-opportunities">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Stale Open Opportunities</h2>
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

          <section className="mb-6 rounded-lg border border-gray-200 bg-white" data-testid="card-daily-sign-ins">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Daily Sign-ins</h2>
              <span className="text-xs text-gray-500">{data.totals.signIns} total</span>
            </div>
            {data.dailySignIns.length === 0 ? (
              <div className="p-5">
                <EmptyState>No sign-ins recorded for this range yet.</EmptyState>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.dailySignIns.map((day) => (
                  <div key={day.date} className="grid gap-3 px-5 py-4 md:grid-cols-[160px_1fr]">
                    <p className="text-sm font-medium text-gray-900">{formatDateLong(day.date)}</p>
                    <div className="space-y-2">
                      {day.users.map((entry) => (
                        <div key={entry.userId} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700">{entry.name}</span>
                          <span className="text-gray-300">·</span>
                          <span className="text-gray-500">{entry.times.map(formatTime).join(", ")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white" data-testid="card-rep-activity-table">
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
        </>
      ) : null}
    </div>
  );
}
