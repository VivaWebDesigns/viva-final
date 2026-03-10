import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { Users, FileText, BookOpen, Puzzle, Phone, Building2, UserCheck, TrendingUp, ArrowRight, DollarSign, Target, UserPlus } from "lucide-react";
import { useLocation } from "wouter";
import type { CrmLead } from "@shared/schema";

interface PipelineStats {
  totalOpen: number;
  totalValue: number;
  byStage: { stageId: string; stageName: string; count: number; value: number }[];
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
  recentLeads: CrmLead[];
}

const STAT_CARDS = [
  { key: "leads", label: "CRM Leads", icon: TrendingUp, color: "bg-teal-500" },
  { key: "opportunities", label: "Opportunities", icon: Target, color: "bg-cyan-500" },
  { key: "companies", label: "Companies", icon: Building2, color: "bg-indigo-500" },
  { key: "crmContacts", label: "CRM Contacts", icon: UserCheck, color: "bg-emerald-500" },
  { key: "users", label: "Team Members", icon: Users, color: "bg-blue-500" },
  { key: "contacts", label: "Form Submissions", icon: Phone, color: "bg-amber-500" },
  { key: "articles", label: "Doc Articles", icon: FileText, color: "bg-purple-500" },
  { key: "integrations", label: "Integrations", icon: Puzzle, color: "bg-rose-500" },
] as const;

interface OnboardingStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  onHold: number;
  overdue: number;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["/api/admin/stats"],
    staleTime: STALE.MEDIUM,
  });
  const { data: onboardingStats } = useQuery<OnboardingStats>({
    queryKey: ["/api/onboarding/stats"],
    staleTime: STALE.MEDIUM,
  });
  const [, setLocation] = useLocation();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Platform overview</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
        {STAT_CARDS.map((card, i) => {
          const Icon = card.icon;
          const value = stats?.[card.key] ?? 0;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl border border-gray-200 p-4"
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
          );
        })}
      </div>

      {stats?.pipelineStats && stats.pipelineStats.byStage.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6" data-testid="card-pipeline-overview">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Pipeline Overview</h2>
              {stats.pipelineStats.totalValue > 0 && (
                <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                  <DollarSign className="w-3.5 h-3.5" />
                  {stats.pipelineStats.totalValue.toLocaleString()} total value
                </span>
              )}
            </div>
            <button
              onClick={() => setLocation("/admin/pipeline")}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
              data-testid="link-view-pipeline"
            >
              View pipeline <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-2">
            {stats.pipelineStats.byStage.map((stage) => (
              <div
                key={stage.stageId}
                className="flex-1 rounded-lg border border-gray-100 p-3 text-center"
                data-testid={`pipeline-stage-${stage.stageId}`}
              >
                <p className="text-xs text-gray-500 mb-1 truncate">{stage.stageName}</p>
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
              <h2 className="text-lg font-semibold text-gray-900">Active Onboardings</h2>
              {onboardingStats.overdue > 0 && (
                <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  {onboardingStats.overdue} overdue
                </span>
              )}
            </div>
            <button
              onClick={() => setLocation("/admin/onboarding")}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
              data-testid="link-view-onboarding"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-3">
            {[
              { label: "Pending", value: onboardingStats.pending, color: "text-yellow-600" },
              { label: "In Progress", value: onboardingStats.inProgress, color: "text-blue-600" },
              { label: "Completed", value: onboardingStats.completed, color: "text-green-600" },
              { label: "On Hold", value: onboardingStats.onHold, color: "text-gray-600" },
            ].map((stat) => (
              <div key={stat.label} className="flex-1 rounded-lg border border-gray-100 p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                <p className={`text-lg font-bold ${stat.color}`} data-testid={`stat-onboarding-dash-${stat.label.toLowerCase().replace(" ", "-")}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Leads</h2>
            <button
              onClick={() => setLocation("/admin/crm")}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
              data-testid="link-view-all-leads"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
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
                  <p className="text-sm font-medium text-gray-900 truncate">{lead.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {lead.sourceLabel && <span className="text-xs text-gray-500">{lead.sourceLabel}</span>}
                    <span className="text-xs text-gray-400">{new Date(lead.createdAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No leads yet. Leads will appear here as they come in from the contact form or are created manually.</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <button
              onClick={() => setLocation("/admin/crm")}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors flex items-center gap-3"
              data-testid="link-quick-crm"
            >
              <TrendingUp className="w-5 h-5 text-teal-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">View CRM</p>
                <p className="text-xs text-gray-500">Manage leads, contacts, and companies</p>
              </div>
            </button>
            <button
              onClick={() => setLocation("/admin/pipeline")}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors flex items-center gap-3"
              data-testid="link-quick-pipeline"
            >
              <Target className="w-5 h-5 text-cyan-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">Sales Pipeline</p>
                <p className="text-xs text-gray-500">Track deals through pipeline stages</p>
              </div>
            </button>
            <button
              onClick={() => setLocation("/admin/onboarding")}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors flex items-center gap-3"
              data-testid="link-quick-onboarding"
            >
              <UserPlus className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">Client Onboarding</p>
                <p className="text-xs text-gray-500">Manage client setup and checklists</p>
              </div>
            </button>
            <button
              onClick={() => setLocation("/admin/docs")}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors flex items-center gap-3"
              data-testid="link-quick-docs"
            >
              <BookOpen className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">App Docs</p>
                <p className="text-xs text-gray-500">Internal documentation library</p>
              </div>
            </button>
            <button
              onClick={() => setLocation("/admin/integrations")}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors flex items-center gap-3"
              data-testid="link-quick-integrations"
            >
              <Puzzle className="w-5 h-5 text-rose-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">Integrations</p>
                <p className="text-xs text-gray-500">Configure third-party services</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
