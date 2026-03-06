import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, FileText, BookOpen, Puzzle, Phone } from "lucide-react";

interface Stats {
  users: number;
  contacts: number;
  articles: number;
  categories: number;
  integrations: number;
}

const STAT_CARDS = [
  { key: "users", label: "Team Members", icon: Users, color: "bg-blue-500" },
  { key: "contacts", label: "Leads", icon: Phone, color: "bg-emerald-500" },
  { key: "articles", label: "Doc Articles", icon: FileText, color: "bg-purple-500" },
  { key: "categories", label: "Doc Categories", icon: BookOpen, color: "bg-amber-500" },
  { key: "integrations", label: "Integrations", icon: Puzzle, color: "bg-rose-500" },
] as const;

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["/api/admin/stats"],
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Platform overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {STAT_CARDS.map((card, i) => {
          const Icon = card.icon;
          const value = stats?.[card.key] ?? 0;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl border border-gray-200 p-5"
              data-testid={`card-stat-${card.key}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              )}
              <p className="text-sm text-gray-500 mt-1">{card.label}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <p className="text-gray-500 text-sm">CRM, Sales Pipeline, and Client Onboarding features will be available here in future updates.</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <p className="text-gray-500 text-sm">Activity feed will be populated as platform features are built out.</p>
        </div>
      </div>
    </div>
  );
}
