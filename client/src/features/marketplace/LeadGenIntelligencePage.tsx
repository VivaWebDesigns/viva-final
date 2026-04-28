import { useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/queryClient";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Gauge,
  MessageCircle,
  ShieldAlert,
  Target,
  UserCheck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface LeadGenWorker {
  userId: string;
  name: string;
  email: string;
  role: string;
  reviewed: number;
  contacted: number;
  replies: number;
  converted: number;
  skipped: number;
  duplicateBusiness: number;
  manualReview: number;
  contactRate: number;
  replyRate: number;
  convertRate: number;
  skipRate: number;
  avgCompletedPerDay: number;
  avgQueueToConvertHours: number | null;
  productivityScore: number;
  nameActions: {
    addFirstName: number;
    addSurname: number;
    addBoth: number;
    override: number;
    total: number;
  };
}

interface LeadGenSummary {
  range: { from: string; to: string; days: number };
  windows: {
    completedToday: number;
    completed7d: number;
    completed30d: number;
  };
  totals: {
    reviewed: number;
    contacted: number;
    replies: number;
    converted: number;
    skipped: number;
    duplicateBusiness: number;
    manualReview: number;
    contactRate: number;
    replyRate: number;
    convertRate: number;
    avgCompletedPerDay: number;
    avgQueueToConvertHours: number | null;
    nameActions: LeadGenWorker["nameActions"];
  };
  daily: Array<{
    date: string;
    reviewed: number;
    contacted: number;
    replies: number;
    converted: number;
    skipped: number;
  }>;
  dailyByWorker: Array<{
    date: string;
    userId: string;
    name: string;
    email: string;
    reviewed: number;
    contacted: number;
    replies: number;
    converted: number;
    skipped: number;
    duplicateBusiness: number;
    manualReview: number;
  }>;
  workers: LeadGenWorker[];
  recentNameActions: Array<{
    createdAt: string;
    userId: string | null;
    userName: string;
    action: string;
    sellerName: string | null;
    firstName: string | null;
    lastName: string | null;
    originalNameScore: number | null;
  }>;
}

function formatDateShort(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHours(hours: number | null) {
  if (hours === null) return "No conversions";
  if (hours < 1) return "<1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Number((hours / 24).toFixed(1))}d`;
}

function actionLabel(action: string) {
  if (action === "add_first_name") return "Added first name";
  if (action === "add_surname") return "Added surname";
  if (action === "add_both") return "Added both";
  if (action === "override") return "Override";
  return action.replace(/_/g, " ");
}

function scoreTone(score: number) {
  if (score >= 85) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 70) return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (score >= 55) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

const PIE_COLORS = ["#10B981", "#2563EB", "#F59E0B", "#8B5CF6", "#EF4444", "#14B8A6", "#64748B"];

type RangeMode = "today" | "this_week" | "last_week" | "7" | "30" | "90" | "custom";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${tone}`}>
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

export default function LeadGenIntelligencePage() {
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [rangeMode, setRangeMode] = useState<RangeMode>("today");
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [selectedWorkerId, setSelectedWorkerId] = useState("all");

  const rangeQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (rangeMode === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
      return params.toString();
    }

    if (rangeMode === "this_week" || rangeMode === "last_week") {
      const currentDay = new Date(`${today}T00:00:00`);
      const thisWeekStart = startOfWeek(currentDay);
      const from = rangeMode === "this_week" ? thisWeekStart : addDays(thisWeekStart, -7);
      const to = rangeMode === "this_week" ? currentDay : addDays(thisWeekStart, -1);
      const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
      params.set("days", String(days));
      params.set("from", toDateInputValue(from));
      params.set("to", toDateInputValue(to));
      return params.toString();
    }

    const days = rangeMode === "today" ? 1 : Number(rangeMode);
    const to = new Date(`${today}T00:00:00`);
    const from = addDays(to, -days + 1);
    params.set("days", String(days));
    params.set("from", toDateInputValue(from));
    params.set("to", today);
    return params.toString();
  }, [customFrom, customTo, rangeMode, today]);

  const { data, error, isError, isLoading } = useQuery<LeadGenSummary>({
    queryKey: [`/api/marketplace/lead-gen/summary?${rangeQuery}`],
    staleTime: STALE.MEDIUM,
  });

  const topWorkers = useMemo(
    () => [...(data?.workers ?? [])].sort((a, b) => b.productivityScore - a.productivityScore || b.converted - a.converted),
    [data?.workers],
  );

  const chartData = useMemo(() => {
    if (!data || selectedWorkerId === "all") return data?.daily ?? [];
    return data.dailyByWorker
      .filter((row) => row.userId === selectedWorkerId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data, selectedWorkerId]);

  const dailyWorkerRows = useMemo(() => {
    const rows = data?.dailyByWorker ?? [];
    return selectedWorkerId === "all" ? rows : rows.filter((row) => row.userId === selectedWorkerId);
  }, [data?.dailyByWorker, selectedWorkerId]);

  const conversionShare = useMemo(
    () => topWorkers
      .filter((worker) => worker.converted > 0)
      .map((worker) => ({ name: worker.name, value: worker.converted })),
    [topWorkers],
  );

  const rangeLabel = rangeMode === "today"
    ? "today"
    : rangeMode === "this_week"
      ? "this week"
      : rangeMode === "last_week"
        ? "last week"
    : rangeMode === "custom"
      ? customFrom === customTo ? formatDateShort(customFrom) : `${formatDateShort(customFrom)} - ${formatDateShort(customTo)}`
      : `${rangeMode}d`;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-lead-gen-title">
            Lead Gen Intelligence
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Extension worker output, contact flow, conversions, and Spanish-name review activity.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1" data-testid="filter-lead-gen-range">
            {[
              ["today", "Today"],
              ["this_week", "This week"],
              ["last_week", "Last week"],
              ["7", "7d"],
              ["30", "30d"],
              ["90", "90d"],
              ["custom", "Custom"],
            ].map(([range, label]) => (
              <button
                key={range}
                onClick={() => setRangeMode(range as RangeMode)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  rangeMode === range ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
                data-testid={`button-lead-gen-range-${range}`}
              >
                {label}
              </button>
            ))}
          </div>
          {rangeMode === "custom" && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="rounded-md border border-gray-200 px-2 py-1.5 text-gray-700"
                data-testid="input-lead-gen-from"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="rounded-md border border-gray-200 px-2 py-1.5 text-gray-700"
                data-testid="input-lead-gen-to"
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
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700" data-testid="error-lead-gen-summary">
          <p className="font-semibold">Lead Gen Intelligence could not load.</p>
          <p className="mt-1 text-red-600">
            {error instanceof Error ? error.message : "Refresh the page or try another date range."}
          </p>
        </div>
      ) : data ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label={`Converted ${rangeLabel}`} value={data.totals.converted} icon={CheckCircle2} tone="bg-emerald-500" />
            <StatCard label="Completed 7d" value={data.windows.completed7d} icon={Target} tone="bg-cyan-500" />
            <StatCard label="Completed 30d" value={data.windows.completed30d} icon={BarChart3} tone="bg-indigo-500" />
            <StatCard label="Leads contacted" value={data.totals.contacted} sub={`${data.totals.contactRate}% contact rate`} icon={MessageCircle} tone="bg-teal-500" />
            <StatCard label="Replies" value={data.totals.replies} sub={`${data.totals.replyRate}% reply rate`} icon={UserCheck} tone="bg-slate-500" />
            <StatCard label="Avg queue to complete" value={formatHours(data.totals.avgQueueToConvertHours)} icon={Clock} tone="bg-amber-500" />
          </div>

          <section className="mb-6 rounded-lg border border-gray-200 bg-white" data-testid="card-lead-gen-trend">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Daily Lead Gen Flow</h2>
                <p className="text-xs text-gray-500">Contacted, replies, and converted records by day.</p>
              </div>
              <select
                value={selectedWorkerId}
                onChange={(event) => setSelectedWorkerId(event.target.value)}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                data-testid="select-lead-gen-worker"
              >
                <option value="all">All workers</option>
                {topWorkers.map((worker) => (
                  <option key={worker.userId} value={worker.userId}>{worker.name}</option>
                ))}
              </select>
            </div>
            <div className="h-80 p-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip labelFormatter={(value) => formatDateShort(String(value))} />
                  <Bar dataKey="contacted" name="Contacted" fill="#0D9488" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="replies" name="Replies" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="converted" name="Converted" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="mb-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-lg border border-gray-200 bg-white" data-testid="card-conversion-share">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-base font-semibold text-gray-900">Conversion Share</h2>
                <p className="text-xs text-gray-500">Converted records by worker for {rangeLabel}.</p>
              </div>
              <div className="h-72 p-5">
                {conversionShare.length === 0 ? (
                  <EmptyState>No conversions for this range.</EmptyState>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip formatter={(value) => [`${value} converted`, ""]} />
                      <Pie data={conversionShare} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                        {conversionShare.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend verticalAlign="bottom" iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white" data-testid="card-daily-worker-activity">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-base font-semibold text-gray-900">Daily Worker Activity</h2>
                <p className="text-xs text-gray-500">Per-worker outcomes for the selected date range.</p>
              </div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-5 py-3 font-semibold">Worker</th>
                      <th className="px-5 py-3 font-semibold">Contacted</th>
                      <th className="px-5 py-3 font-semibold">Replies</th>
                      <th className="px-5 py-3 font-semibold">Converted</th>
                      <th className="px-5 py-3 font-semibold">Closed out</th>
                      <th className="px-5 py-3 font-semibold">Manual review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dailyWorkerRows.map((row) => (
                      <tr key={`${row.date}-${row.userId}`} className="hover:bg-gray-50/70">
                        <td className="px-5 py-3 text-gray-700">{formatDateShort(row.date)}</td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900">{row.name}</p>
                          <p className="text-xs text-gray-500">{row.email}</p>
                        </td>
                        <td className="px-5 py-3 text-gray-700">{row.contacted}</td>
                        <td className="px-5 py-3 text-gray-700">{row.replies}</td>
                        <td className="px-5 py-3 font-semibold text-emerald-700">{row.converted}</td>
                        <td className="px-5 py-3 text-gray-700">
                          <p>{row.skipped} skipped</p>
                          <p className="text-xs text-gray-500">{row.duplicateBusiness} duplicates</p>
                        </td>
                        <td className="px-5 py-3 text-gray-700">{row.manualReview}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <section className="rounded-lg border border-gray-200 bg-white" data-testid="card-lead-gen-workers">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h2 className="text-base font-semibold text-gray-900">Worker Scorecards</h2>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Gauge className="h-4 w-4" />
                  {topWorkers.length} workers
                </div>
              </div>
              {topWorkers.length === 0 ? (
                <div className="p-5">
                  <EmptyState>No lead-gen workers found.</EmptyState>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Worker</th>
                        <th className="px-5 py-3 font-semibold">Score</th>
                        <th className="px-5 py-3 font-semibold">Reviewed</th>
                        <th className="px-5 py-3 font-semibold">Contacted</th>
                        <th className="px-5 py-3 font-semibold">Replies</th>
                        <th className="px-5 py-3 font-semibold">Converted</th>
                        <th className="px-5 py-3 font-semibold">Closed out</th>
                        <th className="px-5 py-3 font-semibold">Name actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {topWorkers.map((worker) => (
                        <tr key={worker.userId} className="hover:bg-gray-50/70">
                          <td className="px-5 py-4">
                            <p className="font-medium text-gray-900">{worker.name}</p>
                            <p className="text-xs text-gray-500">{worker.email}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${scoreTone(worker.productivityScore)}`}>
                              {worker.productivityScore}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-gray-700">{worker.reviewed}</td>
                          <td className="px-5 py-4">
                            <p className="font-medium text-gray-900">{worker.contacted}</p>
                            <p className="text-xs text-gray-500">{worker.contactRate}% contact rate</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium text-gray-900">{worker.replies}</p>
                            <p className="text-xs text-gray-500">{worker.replyRate}% of contacted</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium text-gray-900">{worker.converted}</p>
                            <p className="text-xs text-gray-500">{worker.avgCompletedPerDay}/day</p>
                          </td>
                          <td className="px-5 py-4 text-gray-700">
                            <p>{worker.skipped} skipped</p>
                            <p className="text-xs text-gray-500">{worker.duplicateBusiness} duplicates</p>
                          </td>
                          <td className={`px-5 py-4 font-medium ${worker.nameActions.total > 0 ? "text-amber-700" : "text-gray-500"}`}>
                            <p>{worker.nameActions.total}</p>
                            <p className="text-xs font-normal text-gray-500">{worker.nameActions.override} overrides</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-gray-200 bg-white" data-testid="card-name-review">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Spanish Name Review</h2>
                  <p className="text-xs text-gray-500">Audit trail for low-score name overrides and additions.</p>
                </div>
                <ShieldAlert className="h-5 w-5 text-amber-500" />
              </div>
              <div className="grid grid-cols-2 gap-3 border-b border-gray-100 p-5 text-sm">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Total actions</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{data.totals.nameActions.total}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Overrides</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{data.totals.nameActions.override}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">First names</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{data.totals.nameActions.addFirstName}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Surnames/both</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{data.totals.nameActions.addSurname + data.totals.nameActions.addBoth}</p>
                </div>
              </div>
              {data.recentNameActions.length === 0 ? (
                <div className="p-5">
                  <EmptyState>No Spanish-name review actions for this range.</EmptyState>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {data.recentNameActions.map((event) => (
                    <div key={`${event.createdAt}-${event.userId}-${event.action}`} className="px-5 py-4">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-gray-900">{actionLabel(event.action)}</p>
                        <span className="text-xs text-gray-400">{formatDateTime(event.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-600">{event.userName}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {event.sellerName || "Unknown seller"}
                        {event.originalNameScore !== null ? ` · score ${event.originalNameScore}` : ""}
                      </p>
                      {(event.firstName || event.lastName) && (
                        <p className="mt-1 text-xs text-amber-700">
                          {[event.firstName, event.lastName].filter(Boolean).join(" ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="rounded-lg border border-gray-200 bg-white p-5" data-testid="card-lead-gen-risk">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-semibold text-gray-900">Close-Out Breakdown</h2>
            </div>
            <div className="grid gap-4 text-sm md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Converted to CRM</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{data.totals.converted}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Skipped</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{data.totals.skipped}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Duplicate business</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{data.totals.duplicateBusiness}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Manual review status</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{data.totals.manualReview}</p>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
