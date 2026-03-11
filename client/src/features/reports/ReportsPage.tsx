import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  BarChart3, TrendingUp, Target, DollarSign, Users, CheckCircle2,
  Bell, ArrowUpRight, ArrowDownRight, Minus, Calendar, AlertTriangle,
} from "lucide-react";
import { useAdminLang } from "@/i18n/LanguageContext";

interface SourceRow { source: string; sourceLabel: string; count: number; totalValue: number }
interface StatusRow { statusId: string | null; statusName: string | null; statusColor: string | null; count: number }
interface Conversion { total: number; converted: number; rate: number }
interface TrendRow { date: string; count: number }
interface StageBreakdown { stageId: string; stageName: string; color: string; totalCount: number; openCount: number; totalValue: number; openValue: number }
interface PipelineData { byStage: StageBreakdown[]; totalOpen: number; totalValue: number }
interface WonLost { won: { count: number; value: number }; lost: { count: number; value: number }; winRate: number }
interface OnboardingData { total: number; byStatus: { pending: number; in_progress: number; completed: number; on_hold: number }; overdue: number; avgCompletionDays: number; checklist: { total: number; completed: number; rate: number } }
interface NotifTypeRow { type: string; count: number; unread: number }
interface NotifSummary { byType: NotifTypeRow[]; total: number; unread: number }
interface OverviewData {
  leadsBySource: SourceRow[];
  leadsByStatus: StatusRow[];
  conversion: Conversion;
  pipeline: PipelineData;
  wonLost: WonLost;
  onboarding: OnboardingData;
  notifications: NotifSummary;
  overdueLeads: { count: number };
}

function StatCard({ label, value, icon: Icon, color, sub, testId }: {
  label: string; value: string | number; icon: any; color: string; sub?: string; testId: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-200 p-5"
      data-testid={testId}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

function HorizontalBar({ label, value, max, color, extra }: {
  label: string; value: number; max: number; color?: string; extra?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-28 truncate" title={label}>{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div
          className={`h-full rounded-full ${color || "bg-teal-500"}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-gray-900 w-10 text-right">{value}</span>
      {extra && <span className="text-xs text-gray-400 w-20 text-right">{extra}</span>}
    </div>
  );
}

function SectionCard({ title, children, testId }: { title: string; children: React.ReactNode; testId: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid={testId}>
      <h3 className="text-base font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Skeleton({ h = "h-48" }: { h?: string }) {
  return <div className={`${h} bg-gray-50 rounded-xl animate-pulse`} />;
}

export default function ReportsPage() {
  const { t } = useAdminLang();
  const [rangeDays, setRangeDays] = useState<string>("30");
  const qp = rangeDays ? `?days=${rangeDays}` : "";

  const DATE_RANGES = [
    { label: t.reports.dateRanges["7"],  value: "7" },
    { label: t.reports.dateRanges["30"], value: "30" },
    { label: t.reports.dateRanges["90"], value: "90" },
    { label: t.reports.dateRanges[""],   value: "" },
  ] as const;

  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: [`/api/reports/overview${qp}`],
    staleTime: STALE.SLOW,
  });

  const trendDays = rangeDays || "365";
  const { data: trend, isLoading: trendLoading } = useQuery<TrendRow[]>({
    queryKey: [`/api/reports/leads-trend?days=${trendDays}`],
    staleTime: STALE.SLOW,
  });

  const maxSource = data ? Math.max(...data.leadsBySource.map((r) => r.count), 1) : 1;
  const maxStatus = data ? Math.max(...data.leadsByStatus.map((r) => r.count), 1) : 1;
  const maxStage = data ? Math.max(...data.pipeline.byStage.map((s) => s.totalValue), 1) : 1;
  const trendMax = trend ? Math.max(...trend.map((tr) => tr.count), 1) : 1;

  const onboardingRows = data ? [
    { label: t.reports.onboardingStatuses.pending,     value: data.onboarding.byStatus.pending,     color: "text-yellow-600", key: "pending" },
    { label: t.reports.onboardingStatuses.in_progress, value: data.onboarding.byStatus.in_progress, color: "text-blue-600",   key: "in-progress" },
    { label: t.reports.onboardingStatuses.completed,   value: data.onboarding.byStatus.completed,   color: "text-green-600",  key: "completed" },
    { label: t.reports.onboardingStatuses.on_hold,     value: data.onboarding.byStatus.on_hold,     color: "text-gray-600",   key: "on-hold" },
  ] : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-reports-title">{t.reports.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{t.reports.subtitle}</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1" data-testid="filter-date-range">
          {DATE_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRangeDays(r.value)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                rangeDays === r.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              data-testid={`btn-range-${r.value || "all"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} h="h-28" />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard
            label={t.reports.totalLeads}
            value={data.conversion.total}
            icon={TrendingUp}
            color="bg-teal-500"
            sub={`${data.conversion.converted} converted`}
            testId="card-report-total-leads"
          />
          <StatCard
            label={t.reports.conversionRate}
            value={`${data.conversion.rate}%`}
            icon={Target}
            color="bg-cyan-500"
            sub={`${data.conversion.converted} of ${data.conversion.total}`}
            testId="card-report-conversion"
          />
          <StatCard
            label={t.reports.pipelineValue}
            value={`$${data.pipeline.totalValue.toLocaleString()}`}
            icon={DollarSign}
            color="bg-green-500"
            sub={`${data.pipeline.totalOpen} ${t.reports.openDeals}`}
            testId="card-report-pipeline-value"
          />
          <StatCard
            label={t.reports.winRate}
            value={`${data.wonLost.winRate}%`}
            icon={data.wonLost.winRate >= 50 ? ArrowUpRight : data.wonLost.winRate > 0 ? ArrowDownRight : Minus}
            color={data.wonLost.winRate >= 50 ? "bg-green-500" : data.wonLost.winRate > 0 ? "bg-amber-500" : "bg-gray-400"}
            sub={`${data.wonLost.won.count} ${t.reports.won.toLowerCase()} / ${data.wonLost.lost.count} ${t.reports.lost.toLowerCase()}`}
            testId="card-report-win-rate"
          />
          <StatCard
            label={t.reports.overdueLeads}
            value={data.overdueLeads?.count ?? 0}
            icon={AlertTriangle}
            color={(data.overdueLeads?.count ?? 0) > 0 ? "bg-red-500" : "bg-gray-400"}
            sub={t.reports.followUpRequired}
            testId="card-report-overdue-leads"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {isLoading ? (
          <>
            <Skeleton />
            <Skeleton />
          </>
        ) : data ? (
          <>
            <SectionCard title={t.reports.leadsBySource} testId="card-leads-by-source">
              {data.leadsBySource.length === 0 ? (
                <p className="text-sm text-gray-400">{t.common.noData}</p>
              ) : (
                <div className="space-y-3">
                  {data.leadsBySource
                    .sort((a, b) => b.count - a.count)
                    .map((row) => (
                      <HorizontalBar
                        key={row.source}
                        label={row.sourceLabel}
                        value={row.count}
                        max={maxSource}
                        extra={row.totalValue > 0 ? `$${row.totalValue.toLocaleString()}` : undefined}
                      />
                    ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title={t.reports.leadsByStatus} testId="card-leads-by-status">
              {data.leadsByStatus.length === 0 ? (
                <p className="text-sm text-gray-400">{t.common.noData}</p>
              ) : (
                <div className="space-y-3">
                  {data.leadsByStatus
                    .sort((a, b) => b.count - a.count)
                    .map((row) => (
                      <HorizontalBar
                        key={row.statusId || "null"}
                        label={row.statusName || t.common.unassigned}
                        value={row.count}
                        max={maxStatus}
                        color={row.statusColor ? undefined : "bg-gray-400"}
                      />
                    ))}
                </div>
              )}
            </SectionCard>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {isLoading ? (
          <>
            <Skeleton />
            <Skeleton />
          </>
        ) : data ? (
          <>
            <SectionCard title={t.reports.pipelineByStage} testId="card-pipeline-by-stage">
              {data.pipeline.byStage.length === 0 ? (
                <p className="text-sm text-gray-400">{t.common.noData}</p>
              ) : (
                <div className="space-y-3">
                  {data.pipeline.byStage.map((stage) => (
                    <HorizontalBar
                      key={stage.stageId}
                      label={stage.stageName}
                      value={stage.totalValue}
                      max={maxStage}
                      color="bg-indigo-500"
                      extra={`${stage.totalCount} deals`}
                    />
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title={t.reports.wonVsLost} testId="card-won-lost">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="rounded-lg border border-green-100 bg-green-50 p-4 text-center" data-testid="stat-won">
                  <p className="text-2xl font-bold text-green-700">{data.wonLost.won.count}</p>
                  <p className="text-sm text-green-600">{t.reports.won}</p>
                  {data.wonLost.won.value > 0 && (
                    <p className="text-xs text-green-500 mt-1">${data.wonLost.won.value.toLocaleString()}</p>
                  )}
                </div>
                <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-center" data-testid="stat-lost">
                  <p className="text-2xl font-bold text-red-700">{data.wonLost.lost.count}</p>
                  <p className="text-sm text-red-600">{t.reports.lost}</p>
                  {data.wonLost.lost.value > 0 && (
                    <p className="text-xs text-red-500 mt-1">${data.wonLost.lost.value.toLocaleString()}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-gray-500">{t.reports.winRate}:</span>
                <span className={`text-lg font-bold ${data.wonLost.winRate >= 50 ? "text-green-600" : "text-amber-600"}`}>
                  {data.wonLost.winRate}%
                </span>
              </div>
            </SectionCard>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {isLoading ? (
          <>
            <Skeleton />
            <Skeleton />
          </>
        ) : data ? (
          <>
            <SectionCard title={t.reports.onboardingOverview} testId="card-onboarding-overview">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {onboardingRows.map((s) => (
                  <div key={s.key} className="rounded-lg border border-gray-100 p-3 text-center" data-testid={`stat-onboarding-${s.key}`}>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-3">
                <div className="flex items-center gap-4">
                  {data.onboarding.overdue > 0 && (
                    <span className="text-red-600 font-medium">{data.onboarding.overdue} {t.onboarding.stats.overdue.toLowerCase()}</span>
                  )}
                  <span className="text-gray-500">
                    Checklist: {data.onboarding.checklist.completed}/{data.onboarding.checklist.total} ({data.onboarding.checklist.rate}%)
                  </span>
                </div>
                {data.onboarding.avgCompletionDays > 0 && (
                  <span className="text-gray-500">Avg: {data.onboarding.avgCompletionDays}d to complete</span>
                )}
              </div>
            </SectionCard>

            <SectionCard title={t.reports.notificationSummary} testId="card-notification-summary">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{data.notifications.total} {t.common.total.toLowerCase()}</span>
                </div>
                {data.notifications.unread > 0 && (
                  <span className="text-sm font-medium text-amber-600">{data.notifications.unread} {t.reports.unread}</span>
                )}
              </div>
              {data.notifications.byType.length === 0 ? (
                <p className="text-sm text-gray-400">{t.common.noData}</p>
              ) : (
                <div className="space-y-2">
                  {data.notifications.byType
                    .sort((a, b) => b.count - a.count)
                    .map((row) => (
                      <div key={row.type} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          {(t.reports.notifTypes as Record<string, string>)[row.type] || row.type}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-900 font-medium">{row.count}</span>
                          {row.unread > 0 && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{row.unread} {t.reports.unread}</span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </SectionCard>
          </>
        ) : null}
      </div>

      <SectionCard title="Lead Activity Trend" testId="card-leads-trend">
        {trendLoading ? (
          <Skeleton h="h-32" />
        ) : trend && trend.length > 0 ? (
          <div>
            <div className="flex items-end gap-1 h-32" data-testid="chart-leads-trend">
              {trend.map((tr) => {
                const pct = trendMax > 0 ? (tr.count / trendMax) * 100 : 0;
                return (
                  <div
                    key={tr.date}
                    className="flex-1 group relative flex flex-col justify-end"
                  >
                    <div
                      className="bg-teal-500 rounded-t hover:bg-teal-600 transition-colors min-h-[2px]"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {tr.date}: {tr.count}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>{trend[0]?.date}</span>
              <span>{trend[trend.length - 1]?.date}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">{t.common.noData}</p>
        )}
      </SectionCard>
    </div>
  );
}
