import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DollarSign, Calendar, User, ChevronRight, ChevronLeft,
  LayoutGrid, List, Plus, Building2, GripVertical,
} from "lucide-react";
import type { PipelineStage, PipelineOpportunity } from "@shared/schema";

interface BoardData {
  stages: PipelineStage[];
  board: Record<string, { stage: PipelineStage; opportunities: PipelineOpportunity[] }>;
}

function OpportunityCard({ opp, stages }: { opp: PipelineOpportunity; stages: PipelineStage[] }) {
  const { toast } = useToast();
  const currentStageIdx = stages.findIndex(s => s.id === opp.stageId);

  const moveMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const res = await apiRequest("PUT", `/api/pipeline/opportunities/${opp.id}/stage`, { stageId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const canMoveLeft = currentStageIdx > 0;
  const canMoveRight = currentStageIdx < stages.length - 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card className="mb-2 hover:shadow-md transition-shadow cursor-pointer group" data-testid={`card-opportunity-${opp.id}`}>
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <Link href={`/admin/pipeline/opportunities/${opp.id}`}>
              <span className="text-sm font-medium text-gray-900 hover:text-[#0D9488] transition-colors line-clamp-2" data-testid={`text-opp-title-${opp.id}`}>
                {opp.title}
              </span>
            </Link>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              {canMoveLeft && (
                <button
                  onClick={(e) => { e.stopPropagation(); moveMutation.mutate(stages[currentStageIdx - 1].id); }}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title={`Move to ${stages[currentStageIdx - 1].name}`}
                  data-testid={`button-move-left-${opp.id}`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}
              {canMoveRight && (
                <button
                  onClick={(e) => { e.stopPropagation(); moveMutation.mutate(stages[currentStageIdx + 1].id); }}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title={`Move to ${stages[currentStageIdx + 1].name}`}
                  data-testid={`button-move-right-${opp.id}`}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {opp.sourceLeadTitle && opp.sourceLeadTitle !== opp.title && (
            <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
              <Building2 className="w-3 h-3" />
              <span className="truncate">{opp.sourceLeadTitle}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              {opp.value && (
                <span className="flex items-center gap-1 font-medium text-green-600" data-testid={`text-opp-value-${opp.id}`}>
                  <DollarSign className="w-3 h-3" />
                  {parseFloat(opp.value).toLocaleString()}
                </span>
              )}
              {opp.probability !== null && opp.probability !== undefined && opp.probability > 0 && (
                <span className="text-gray-400">{opp.probability}%</span>
              )}
            </div>
            {opp.nextActionDate && (
              <span className="flex items-center gap-1" data-testid={`text-opp-next-action-${opp.id}`}>
                <Calendar className="w-3 h-3" />
                {new Date(opp.nextActionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>

          {opp.status !== "open" && (
            <Badge variant={opp.status === "won" ? "default" : "destructive"} className="mt-2 text-xs">
              {opp.status === "won" ? "Won" : "Lost"}
            </Badge>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StageColumn({ stage, opportunities, stages }: { stage: PipelineStage; opportunities: PipelineOpportunity[]; stages: PipelineStage[] }) {
  const totalValue = opportunities.reduce((sum, o) => sum + parseFloat(o.value || "0"), 0);

  return (
    <div className="flex-shrink-0 w-[280px] flex flex-col max-h-full" data-testid={`column-stage-${stage.slug}`}>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
          <h3 className="text-sm font-semibold text-gray-700">{stage.name}</h3>
          <Badge variant="secondary" className="text-xs h-5 px-1.5" data-testid={`badge-stage-count-${stage.slug}`}>
            {opportunities.length}
          </Badge>
        </div>
      </div>

      {totalValue > 0 && (
        <div className="text-xs text-gray-400 mb-2 px-1 flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          {totalValue.toLocaleString()}
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-[100px] px-1 pb-2">
        <AnimatePresence mode="popLayout">
          {opportunities.map(opp => (
            <OpportunityCard key={opp.id} opp={opp} stages={stages} />
          ))}
        </AnimatePresence>
        {opportunities.length === 0 && (
          <div className="text-center text-xs text-gray-300 py-8">
            No opportunities
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelineBoardPage() {
  const { data, isLoading } = useQuery<BoardData>({
    queryKey: ["/api/pipeline/opportunities/board"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stages = data?.stages || [];
  const board = data?.board || {};

  return (
    <div className="h-full flex flex-col" data-testid="page-pipeline-board">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-pipeline-title">Sales Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">Track deals through your sales process</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/pipeline/list">
            <Button variant="outline" size="sm" data-testid="button-list-view">
              <List className="w-4 h-4 mr-1" />
              List View
            </Button>
          </Link>
          <Link href="/admin/pipeline/stages">
            <Button variant="outline" size="sm" data-testid="button-manage-stages">
              Manage Stages
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 min-h-[400px] pb-4" style={{ minWidth: stages.length * 296 }}>
          {stages.map(stage => (
            <StageColumn
              key={stage.id}
              stage={stage}
              opportunities={board[stage.id]?.opportunities || []}
              stages={stages}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
