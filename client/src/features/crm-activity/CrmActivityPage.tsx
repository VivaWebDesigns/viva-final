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
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

interface RepActivity {
  userId: string;
  name: string;
  email: string;
  role: string;
  activeMinutes: number;
  crmMinutes: number;
  pipelineMinutes: number;
  taskMinutes: number;
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
    leadsAssigned: number;
    leadsTouched: number;
    leadTouchRate: number;
    overdueTasks: number;
    pipelineActions: number;
  };
  reps: RepActivity[];
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
  const { data, isLoading } = useQuery<ActivitySummary>({
    queryKey: [`/api/crm-activity/summary?days=${days}`],
    staleTime: STALE.MEDIUM,
  });

  const sortedReps = useMemo(
    () => [...(data?.reps ?? [])].sort((a, b) => b.leadsTouched - a.leadsTouched || b.activeMinutes - a.activeMinutes),
    [data?.reps],
  );

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
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="CRM active time" value={formatMinutes(data.totals.activeMinutes)} icon={Clock} tone="bg-teal-500" />
            <StatCard label="Leads touched" value={data.totals.leadsTouched} icon={Target} tone="bg-cyan-500" />
            <StatCard label="Touch rate" value={`${data.totals.leadTouchRate}%`} icon={TrendingUp} tone="bg-emerald-500" />
            <StatCard label="Pipeline actions" value={data.totals.pipelineActions} icon={BarChart3} tone="bg-indigo-500" />
            <StatCard label="Overdue tasks" value={data.totals.overdueTasks} icon={AlertTriangle} tone={data.totals.overdueTasks > 0 ? "bg-red-500" : "bg-gray-400"} />
          </div>

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
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Rep</th>
                      <th className="px-5 py-3 font-semibold">Active</th>
                      <th className="px-5 py-3 font-semibold">Leads</th>
                      <th className="px-5 py-3 font-semibold">First touch</th>
                      <th className="px-5 py-3 font-semibold">Notes</th>
                      <th className="px-5 py-3 font-semibold">Pipeline</th>
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
                        <td className="px-5 py-4 text-gray-700">{rep.leadNotes}</td>
                        <td className="px-5 py-4 text-gray-700">{rep.pipelineActions}</td>
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
