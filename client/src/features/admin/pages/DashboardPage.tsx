import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, FileText, BookOpen, Puzzle, Phone, Building2, UserCheck, TrendingUp, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import type { CrmLead } from "@shared/schema";

interface Stats {
  users: number;
  contacts: number;
  articles: number;
  categories: number;
  integrations: number;
  leads: number;
  companies: number;
  crmContacts: number;
  recentLeads: CrmLead[];
}

const STAT_CARDS = [
  { key: "leads", label: "CRM Leads", icon: TrendingUp, color: "bg-teal-500" },
  { key: "companies", label: "Companies", icon: Building2, color: "bg-indigo-500" },
  { key: "crmContacts", label: "CRM Contacts", icon: UserCheck, color: "bg-emerald-500" },
  { key: "users", label: "Team Members", icon: Users, color: "bg-blue-500" },
  { key: "contacts", label: "Form Submissions", icon: Phone, color: "bg-amber-500" },
  { key: "articles", label: "Doc Articles", icon: FileText, color: "bg-purple-500" },
  { key: "integrations", label: "Integrations", icon: Puzzle, color: "bg-rose-500" },
] as const;

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["/api/admin/stats"],
  });
  const [, setLocation] = useLocation();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Platform overview</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
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
