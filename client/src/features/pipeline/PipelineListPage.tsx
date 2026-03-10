import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DollarSign, Calendar, Search, LayoutGrid, ChevronLeft, ChevronRight, User,
} from "lucide-react";
import type { PipelineStage, PipelineOpportunity } from "@shared/schema";

export default function PipelineListPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (stageFilter) params.set("stageId", stageFilter);
  if (statusFilter) params.set("status", statusFilter);
  params.set("page", String(page));
  params.set("limit", "25");

  const { data: stagesData } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline/stages"],
  });

  const { data, isLoading } = useQuery<{ items: PipelineOpportunity[]; total: number; page: number; limit: number }>({
    queryKey: ["/api/pipeline/opportunities", `?${params.toString()}`],
    staleTime: STALE.FAST,
  });

  const stages = stagesData || [];
  const stageMap = Object.fromEntries(stages.map(s => [s.id, s]));
  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div data-testid="page-pipeline-list">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-pipeline-list-title">Opportunities</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total opportunities</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/pipeline">
            <Button variant="outline" size="sm" data-testid="button-board-view">
              <LayoutGrid className="w-4 h-4 mr-1" />
              Board View
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search opportunities..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
            data-testid="input-search-opportunities"
          />
        </div>
        <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[160px]" data-testid="select-stage-filter">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {stages.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No opportunities found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map(opp => {
            const stage = stageMap[opp.stageId || ""];
            return (
              <Link key={opp.id} href={`/admin/pipeline/opportunities/${opp.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`row-opportunity-${opp.id}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate" data-testid={`text-opp-title-${opp.id}`}>
                        {opp.title}
                      </p>
                      {opp.sourceLeadTitle && opp.sourceLeadTitle !== opp.title && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">From: {opp.sourceLeadTitle}</p>
                      )}
                    </div>

                    {stage && (
                      <Badge
                        variant="outline"
                        className="flex-shrink-0"
                        style={{ borderColor: stage.color, color: stage.color }}
                        data-testid={`badge-stage-${opp.id}`}
                      >
                        {stage.name}
                      </Badge>
                    )}

                    {opp.status !== "open" && (
                      <Badge variant={opp.status === "won" ? "default" : "destructive"} className="flex-shrink-0">
                        {opp.status === "won" ? "Won" : "Lost"}
                      </Badge>
                    )}

                    {opp.value && (
                      <span className="flex items-center gap-1 text-sm font-medium text-green-600 flex-shrink-0" data-testid={`text-opp-value-${opp.id}`}>
                        <DollarSign className="w-3.5 h-3.5" />
                        {parseFloat(opp.value).toLocaleString()}
                      </span>
                    )}

                    {opp.nextActionDate && (
                      <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(opp.nextActionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}

                    {opp.probability !== null && opp.probability !== undefined && opp.probability > 0 && (
                      <span className="text-xs text-gray-400 flex-shrink-0">{opp.probability}%</span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            data-testid="button-next-page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
