import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { Users, FileText, BookOpen, Puzzle, Phone, Building2, UserCheck, TrendingUp, ArrowRight, DollarSign, Target, UserPlus } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { CrmLead, CrmContact, CrmCompany } from "@shared/schema";
import { useAdminLang } from "@/i18n/LanguageContext";

interface EnrichedLead extends CrmLead {
  contact?: CrmContact | null;
  company?: CrmCompany | null;
}

interface PipelineStats {
  totalOpen: number;
  totalValue: number;
  byStage: { stageId: string; stageName: string; stageSlug: string; count: number; value: number }[];
}

interface Stats {
  users: number;
  contacts: number;
  articles: number;
  categories: number;
  integrations: number;
  leads: number;
  companies: number;
  crmContacts: number;
  opportunities: number;
  pipelineStats: PipelineStats;
  recentLeads: EnrichedLead[];
}

interface OnboardingStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  onHold: number;
  overdue: number;
}

export default function DashboardPage() {
  const { t } = useAdminLang();
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["/api/admin/stats"],
    staleTime: STALE.MEDIUM,
  });
  const { data: onboardingStats } = useQuery<OnboardingStats>({
    queryKey: ["/api/onboarding/stats"],
    staleTime: STALE.MEDIUM,
  });
  const [, setLocation] = useLocation();

  const STAT_CARDS = [
    { key: "leads" as const,         label: t.dashboard.crmLeads,       icon: TrendingUp, color: "bg-teal-500",    href: "/admin/crm" },
    { key: "opportunities" as const,  label: t.dashboard.opportunities,  icon: Target,     color: "bg-cyan-500",    href: "/admin/pipeline" },
    { key: "companies" as const,      label: t.dashboard.companies,      icon: Building2,  color: "bg-indigo-500",  href: "/admin/crm" },
    { key: "crmContacts" as const,    label: t.dashboard.crmContacts,    icon: UserCheck,  color: "bg-emerald-500", href: "/admin/crm" },
    { key: "users" as const,          label: t.dashboard.teamMembers,    icon: Users,      color: "bg-blue-500",    href: "/admin/settings" },
    { key: "contacts" as const,       label: t.dashboard.formSubmissions,icon: Phone,      color: "bg-amber-500",   href: "/admin/crm" },
    { key: "articles" as const,       label: t.dashboard.docArticles,    icon: FileText,   color: "bg-purple-500",  href: "/admin/docs" },
    { key: "integrations" as const,   label: t.dashboard.integrations,   icon: Puzzle,     color: "bg-rose-500",    href: "/admin/settings" },
  ];

  const onboardingRows = [
    { label: t.onboarding.stats.pending,    value: onboardingStats?.pending ?? 0,    color: "text-yellow-600", key: "pending" },
    { label: t.onboarding.stats.inProgress, value: onboardingStats?.inProgress ?? 0, color: "text-blue-600",   key: "in-progress" },
    { label: t.onboarding.stats.completed,  value: onboardingStats?.completed ?? 0,  color: "text-green-600",  key: "completed" },
    { label: t.onboarding.status.on_hold,   value: onboardingStats?.onHold ?? 0,     color: "text-gray-600",   key: "on-hold" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="text-dashboard-title">{t.dashboard.title}</h1>
        <p className="text-gray-500 text-sm mt-1">{t.dashboard.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 xl:grid-cols-8 gap-3 sm:gap-4 mb-8">
        {STAT_CARDS.map((card, i) => {
          const Icon = card.icon;
          const value = stats?.[card.key] ?? 0;
          return (
            <Link key={card.key} href={card.href}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300"
                data-testid={`card-stat-${card.key}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-9 h-9 ${card.color} rounded-lg flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                </div>
                {isLoading ? (
                  <div className="h-7 w-12 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <p className="text-xl font-bold text-gray-900">{value}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">{card.label}</p>
              </motion.div>
            </Link>
          );
        })}
      </div>

      {stats?.pipelineStats && stats.pipelineStats.byStage.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6" data-testid="card-pipeline-overview">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{t.dashboard.pipelineOverview}</h2>
              {stats.pipelineStats.totalValue > 0 && (
                <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                  <DollarSign className="w-3.5 h-3.5" />
                  {stats.pipelineStats.totalValue.toLocaleString()} {t.dashboard.pipelineValue}
                </span>
              )}
            </div>
            <button
              onClick={() => setLocation("/admin/pipeline")}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
              data-testid="link-view-pipeline"
            >
              {t.dashboard.viewAll} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:flex gap-2">
            {stats.pipelineStats.byStage.map((stage) => (
              <div
                key={stage.stageId}
                className="flex-1 rounded-lg border border-gray-100 p-3 text-center min-w-0"
                data-testid={`pipeline-stage-${stage.stageId}`}
              >
                <p className="text-xs text-gray-500 mb-1 truncate">{(t.pipeline.stageNames as Record<string, string>)[stage.stageSlug] || stage.stageName}</p>
                <p className="text-lg font-bold text-gray-900">{stage.count}</p>
                {stage.value > 0 && (
                  <p className="text-xs text-green-600 font-medium">${stage.value.toLocaleString()}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {onboardingStats && onboardingStats.total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6" data-testid="card-onboarding-overview">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{t.dashboard.onboardingOverview}</h2>
              {onboardingStats.overdue > 0 && (
                <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  {onboardingStats.overdue} {t.onboarding.stats.overdue.toLowerCase()}
                </span>
              )}
            </div>
            <button
              onClick={() => setLocation("/admin/onboarding")}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
              data-testid="link-view-onboarding"
            >
              {t.dashboard.viewAll} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {onboardingRows.map((stat) => (
              <div key={stat.key} className="flex-1 rounded-lg border border-gray-100 p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                <p className={`text-lg font-bold ${stat.color}`} data-testid={`stat-onboarding-dash-${stat.key}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{t.dashboard.recentLeads}</h2>
            <button
              onClick={() => setLocation("/admin/crm")}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
              data-testid="link-view-all-leads"
            >
              {t.dashboard.viewAll} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />)}
            </div>
          ) : stats?.recentLeads && stats.recentLeads.length > 0 ? (
            <div className="space-y-2">
              {stats.recentLeads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setLocation(`/admin/crm/leads/${lead.id}`)}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors"
                  data-testid={`link-recent-lead-${lead.id}`}
                >
                  <p className="text-sm font-medium text-gray-900 truncate">{(() => {
                    const cn = lead.contact ? [lead.contact.firstName, lead.contact.lastName].filter(Boolean).join(" ") : null;
                    const co = lead.company?.name;
                    if (co && cn) return `${co} – ${cn}`;
                    if (co) return co;
                    if (cn) return cn;
                    return lead.title;
                  })()}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {lead.sourceLabel && <span className="text-xs text-gray-500">{lead.sourceLabel}</span>}
                    <span className="text-xs text-gray-400">{new Date(lead.createdAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">{t.dashboard.noRecentLeads}</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.dashboard.quickAccess}</h2>
          <div className="space-y-2">
            <button
              onClick={() => setLocation("/admin/crm")}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors flex items-center gap-3"
              data-testid="link-quick-crm"
            >
              <TrendingUp className="w-5 h-5 text-teal-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">{t.nav.crm}</p>
                <p className="text-xs text-gray-500">{t.dashboard.salesPipelineDesc}</p>
              </div>
            </button>
            <button
              onClick={() => setLocation("/admin/pipeline")}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors flex items-center gap-3"
              data-testid="link-quick-pipeline"
            >
              <Target className="w-5 h-5 text-cyan-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">{t.nav.pipeline}</p>
                <p className="text-xs text-gray-500">{t.dashboard.salesPipelineDesc}</p>
              </div>
            </button>
            <button
              onClick={() => setLocation("/admin/onboarding")}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors flex items-center gap-3"
              data-testid="link-quick-onboarding"
            >
              <UserPlus className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">{t.nav.onboarding}</p>
                <p className="text-xs text-gray-500">{t.dashboard.clientOnboardingDesc}</p>
              </div>
            </button>
            <button
              onClick={() => setLocation("/admin/docs")}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors flex items-center gap-3"
              data-testid="link-quick-docs"
            >
              <BookOpen className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">{t.nav.docs}</p>
                <p className="text-xs text-gray-500">{t.dashboard.appDocsDesc}</p>
              </div>
            </button>
            <button
              onClick={() => setLocation("/admin/settings")}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors flex items-center gap-3"
              data-testid="link-quick-integrations"
            >
              <Puzzle className="w-5 h-5 text-rose-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">{t.nav.integrations}</p>
                <p className="text-xs text-gray-500">{t.dashboard.integrationsDesc}</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
