import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarCheck2,
  Eye,
  Link2,
  Mail,
  MessageSquareReply,
  MousePointerClick,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { STALE } from "@/lib/queryClient";

type OutreachSummary = {
  sent: number;
  uniqueLeads: number;
  engagedLeads: number;
  clickedLeads: number;
  responses: number;
  appointments: number;
  engagedRate: number;
  clickRate: number;
  responseRate: number;
  appointmentRate: number;
};

type TemplatePerformance = {
  templateKey: string;
  templateName: string;
  sent: number;
  uniqueLeads: number;
  engagedLeads: number;
  clickedLeads: number;
  responses: number;
  appointments: number;
  optOuts: number;
  bounces: number;
  totalViews: number;
  totalClicks: number;
  engagedRate: number;
  clickRate: number;
  responseRate: number;
  appointmentRate: number;
  ctaBreakdown: Record<string, number>;
};

type RecentDelivery = {
  deliveryId: string;
  leadId: string;
  companyName: string;
  trade: string | null;
  templateKey: string;
  subject: string | null;
  sentAt: string;
  viewCount: number;
  ctaClickCount: number;
  ctaTypes: string[];
  outcome: string | null;
};

type OutreachAnalytics = {
  days: number;
  generatedAt: string;
  summary: OutreachSummary;
  templates: TemplatePerformance[];
  recent: RecentDelivery[];
};

const CTA_LABELS: Record<string, string> = {
  schedule_call: "Schedule a call",
  email_matt: "Email Matt",
  view_results: "View results",
  another_scan: "Run another scan",
};

function MetricCard({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Mail;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="mt-1 text-sm font-medium text-gray-600">{label}</p>
      <p className="mt-1 text-xs text-gray-400">{detail}</p>
    </div>
  );
}

function Rate({ count, rate }: { count: number; rate: number }) {
  return (
    <div>
      <p className="font-semibold text-gray-900">{count}</p>
      <p className="text-xs text-gray-400">{rate}%</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCta(value: string) {
  return CTA_LABELS[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

export default function EmailOutreachAnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useQuery<OutreachAnalytics>({
    queryKey: [`/api/business-analytics/report-outreach?days=${days}`],
    staleTime: STALE.MEDIUM,
  });

  return (
    <div className="space-y-6" data-testid="email-outreach-analytics-page">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Link href="/admin/analytics" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800">
            <ArrowLeft className="h-4 w-4" />
            All analytics
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Email outreach</h1>
          <p className="mt-1 text-sm text-gray-500">See which report-email templates turn into real interest and appointments.</p>
        </div>
        <div className="flex rounded-lg bg-gray-100 p-1">
          {[7, 30, 90, 365].map(value => (
            <button
              type="button"
              key={value}
              onClick={() => setDays(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${days === value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {value === 365 ? "1 year" : `${value} days`}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Email outreach analytics could not be loaded: {(error as Error).message}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Emails sent" value={data.summary.sent} detail={`${data.summary.uniqueLeads} unique leads`} icon={Mail} tone="bg-slate-600" />
            <MetricCard label="Engaged leads" value={data.summary.engagedLeads} detail={`${data.summary.engagedRate}% of leads`} icon={Eye} tone="bg-blue-500" />
            <MetricCard label="CTA clickers" value={data.summary.clickedLeads} detail={`${data.summary.clickRate}% of leads`} icon={MousePointerClick} tone="bg-indigo-500" />
            <MetricCard label="Responses" value={data.summary.responses} detail={`${data.summary.responseRate}% of leads`} icon={MessageSquareReply} tone="bg-cyan-600" />
            <MetricCard label="Appointments" value={data.summary.appointments} detail={`${data.summary.appointmentRate}% of leads`} icon={CalendarCheck2} tone="bg-emerald-600" />
            <MetricCard label="Unique leads" value={data.summary.uniqueLeads} detail={`Last ${data.days} days`} icon={Users} tone="bg-teal-600" />
          </div>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-5">
              <h2 className="font-semibold text-gray-900">Template comparison</h2>
              <p className="mt-1 text-sm text-gray-500">Every edited send stays with the template letter you selected.</p>
            </div>
            {data.templates.length === 0 ? (
              <div className="rounded-lg bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                New sends will appear here after you use Template A.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                      <th className="pb-3 pr-4 font-semibold">Template</th>
                      <th className="pb-3 px-4 font-semibold">Sent</th>
                      <th className="pb-3 px-4 font-semibold">Engaged</th>
                      <th className="pb-3 px-4 font-semibold">Clicked</th>
                      <th className="pb-3 px-4 font-semibold">Responses</th>
                      <th className="pb-3 px-4 font-semibold">Appointments</th>
                      <th className="pb-3 pl-4 font-semibold">Opt-outs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.templates.map(template => (
                      <tr key={template.templateKey} className="border-b border-gray-100 last:border-0">
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 font-bold text-teal-700">
                              {template.templateKey === "Unlabeled" ? "—" : template.templateKey}
                            </span>
                            <div>
                              <p className="font-semibold text-gray-900">{template.templateName}</p>
                              <p className="text-xs text-gray-400">{template.uniqueLeads} unique leads</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-gray-900">{template.sent}</td>
                        <td className="px-4 py-4"><Rate count={template.engagedLeads} rate={template.engagedRate} /></td>
                        <td className="px-4 py-4"><Rate count={template.clickedLeads} rate={template.clickRate} /></td>
                        <td className="px-4 py-4"><Rate count={template.responses} rate={template.responseRate} /></td>
                        <td className="px-4 py-4"><Rate count={template.appointments} rate={template.appointmentRate} /></td>
                        <td className="py-4 pl-4 font-semibold text-gray-900">{template.optOuts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {data.templates.some(template => Object.keys(template.ctaBreakdown).length > 0) && (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-5">
                <h2 className="font-semibold text-gray-900">What people clicked</h2>
                <p className="mt-1 text-sm text-gray-500">CTA clicks from each report page, separated by template.</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {data.templates.filter(template => Object.keys(template.ctaBreakdown).length > 0).map(template => (
                  <div key={template.templateKey} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="mb-3 font-semibold text-gray-900">Template {template.templateKey}</p>
                    <div className="space-y-2">
                      {Object.entries(template.ctaBreakdown).sort((a, b) => b[1] - a[1]).map(([cta, count]) => (
                        <div key={cta} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-gray-600"><Link2 className="h-3.5 w-3.5" />{formatCta(cta)}</span>
                          <span className="font-semibold text-gray-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-5">
              <h2 className="font-semibold text-gray-900">Recent sends</h2>
              <p className="mt-1 text-sm text-gray-500">Open a lead to see its full report activity.</p>
            </div>
            {data.recent.length === 0 ? (
              <div className="rounded-lg bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">No report emails were sent in this date range.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                      <th className="pb-3 pr-4 font-semibold">Lead</th>
                      <th className="pb-3 px-4 font-semibold">Template</th>
                      <th className="pb-3 px-4 font-semibold">Sent</th>
                      <th className="pb-3 px-4 font-semibold">Views</th>
                      <th className="pb-3 px-4 font-semibold">Clicks</th>
                      <th className="pb-3 pl-4 font-semibold">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map(delivery => (
                      <tr key={delivery.deliveryId} className="border-b border-gray-100 last:border-0">
                        <td className="py-4 pr-4">
                          <Link href={`/admin/crm/leads/${delivery.leadId}`} className="font-semibold text-teal-700 hover:text-teal-800 hover:underline">
                            {delivery.companyName}
                          </Link>
                          {delivery.trade && <p className="mt-0.5 text-xs text-gray-400">{delivery.trade}</p>}
                        </td>
                        <td className="px-4 py-4"><span className="rounded-md bg-teal-50 px-2 py-1 font-semibold text-teal-700">{delivery.templateKey}</span></td>
                        <td className="px-4 py-4 text-gray-600">{formatDate(delivery.sentAt)}</td>
                        <td className="px-4 py-4 font-semibold text-gray-900">{delivery.viewCount}</td>
                        <td className="px-4 py-4 font-semibold text-gray-900">{delivery.ctaClickCount}</td>
                        <td className="py-4 pl-4 text-gray-600">{delivery.outcome ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-xs text-gray-400">
            An engaged view means the report stayed open for at least four seconds. Email security scanners can still create some views; CTA clicks and recorded CRM outcomes are stronger signals.
          </p>
        </>
      ) : null}
    </div>
  );
}
