import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/queryClient";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, UserPlus, Calendar, Clock, CheckCircle2,
  AlertTriangle, Pause, ArrowRight, Users,
} from "lucide-react";
import type { OnboardingRecord } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: ArrowRight },
  completed: { label: "Completed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
  on_hold: { label: "On Hold", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", icon: Pause },
};

export default function OnboardingListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (statusFilter !== "all") params.set("status", statusFilter);
  params.set("page", String(page));
  params.set("limit", "25");

  const queryString = params.toString();
  const { data, isLoading } = useQuery<{ records: OnboardingRecord[]; total: number }>({
    queryKey: ["/api/onboarding/records?" + queryString],
    staleTime: STALE.MEDIUM,
    refetchOnWindowFocus: true,
  });

  const { data: stats } = useQuery<{
    total: number; pending: number; inProgress: number; completed: number; onHold: number; overdue: number;
  }>({
    queryKey: ["/api/onboarding/stats"],
    staleTime: STALE.MEDIUM,
  });

  const records = data?.records || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 25);
  const now = new Date();

  const isOverdue = (record: OnboardingRecord) =>
    record.dueDate && new Date(record.dueDate) < now && record.status !== "completed";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-onboarding-title">Client Onboarding</h1>
          <p className="text-muted-foreground mt-1">Manage client setup and onboarding workflows</p>
        </div>
        <Link href="/admin/onboarding/new">
          <Button data-testid="button-new-onboarding">
            <Plus className="h-4 w-4 mr-2" />
            New Onboarding
          </Button>
        </Link>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, icon: Users, color: "text-foreground" },
            { label: "Pending", value: stats.pending, icon: Clock, color: "text-yellow-600" },
            { label: "In Progress", value: stats.inProgress, icon: ArrowRight, color: "text-blue-600" },
            { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-green-600" },
            { label: "Overdue", value: stats.overdue, icon: AlertTriangle, color: "text-red-600" },
          ].map((stat) => (
            <Card key={stat.label} className="border">
              <CardContent className="p-3 flex items-center gap-3">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold" data-testid={`stat-onboarding-${stat.label.toLowerCase()}`}>{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10"
            data-testid="input-search-onboarding"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <Card className="border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No onboarding records</h3>
            <p className="text-muted-foreground mb-4">Create your first client onboarding to get started</p>
            <Link href="/admin/onboarding/new">
              <Button data-testid="button-empty-new-onboarding">
                <Plus className="h-4 w-4 mr-2" />
                New Onboarding
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const statusCfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            const overdue = isOverdue(record);

            return (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Link href={`/admin/onboarding/${record.id}`}>
                  <Card
                    className={`border cursor-pointer hover:shadow-md transition-shadow ${overdue ? "border-red-300 dark:border-red-700" : ""}`}
                    data-testid={`card-onboarding-${record.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex-shrink-0">
                            <StatusIcon className={`h-5 w-5 ${overdue ? "text-red-500" : ""}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold truncate" data-testid={`text-client-name-${record.id}`}>
                                {record.clientName}
                              </h3>
                              {overdue && (
                                <Badge variant="destructive" className="text-xs flex-shrink-0" data-testid={`badge-overdue-${record.id}`}>
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Overdue
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <Badge className={`${statusCfg.color} text-xs`}>{statusCfg.label}</Badge>
                              {record.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Due: {new Date(record.dueDate).toLocaleDateString()}
                                </span>
                              )}
                              {record.kickoffDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Kickoff: {new Date(record.kickoffDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            data-testid="button-prev-page"
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-3">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            data-testid="button-next-page"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
