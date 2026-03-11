import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient, STALE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, List, GripVertical, Phone, Building2, MapPin, CheckCircle2 } from "lucide-react";
import type { PipelineStage, PipelineOpportunity } from "@shared/schema";
import QuickTaskModal from "@/components/QuickTaskModal";
import { useAdminLang } from "@/i18n/LanguageContext";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";

type ContactSnap = { id: string; firstName: string; lastName: string | null; phone: string | null };
type CompanySnap = { id: string; name: string; city: string | null; industry: string | null };

interface BoardData {
  stages: PipelineStage[];
  board: Record<string, { stage: PipelineStage; opportunities: PipelineOpportunity[] }>;
  contactMap: Record<string, ContactSnap>;
  companyMap: Record<string, CompanySnap>;
}

const PKG_COLORS: Record<string, string> = {
  empieza: "bg-blue-100 text-blue-700",
  crece:   "bg-violet-100 text-violet-700",
  domina:  "bg-amber-100 text-amber-700",
};

function CardDisplay({
  opp,
  isDragging = false,
  dragHandleProps,
  contactMap,
  companyMap,
  onTaskClick,
}: {
  opp: PipelineOpportunity;
  isDragging?: boolean;
  dragHandleProps?: {
    listeners: Record<string, any> | undefined;
    attributes: Record<string, any> | undefined;
  };
  contactMap: Record<string, ContactSnap>;
  companyMap: Record<string, CompanySnap>;
  onTaskClick?: (opp: PipelineOpportunity) => void;
}) {
  const { t } = useAdminLang();
  const contact = opp.contactId ? contactMap[opp.contactId] : null;
  const company = opp.companyId ? companyMap[opp.companyId] : null;
  const contactName = contact ? `${contact.firstName}${contact.lastName ? " " + contact.lastName : ""}` : null;
  const pkg = (opp as any).websitePackage as string | null;

  return (
    <Card
      className={`hover:shadow-md transition-all group ${
        isDragging
          ? "shadow-2xl ring-2 ring-[#0D9488] rotate-1 scale-[1.03] opacity-95 cursor-grabbing"
          : "cursor-default"
      }`}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2 mb-1.5">
          <button
            className="mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors touch-none select-none"
            data-testid={`drag-handle-${opp.id}`}
            {...(dragHandleProps?.listeners || {})}
            {...(dragHandleProps?.attributes || {})}
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <Link href={`/admin/pipeline/opportunities/${opp.id}`}>
              <span
                className="text-sm font-semibold text-gray-900 hover:text-[#0D9488] transition-colors line-clamp-1 block"
                data-testid={`text-opp-title-${opp.id}`}
              >
                {contactName || opp.title}
              </span>
            </Link>

            {company && (
              <span className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <Building2 className="w-3 h-3 flex-shrink-0" />
                <span className="truncate" data-testid={`text-opp-company-${opp.id}`}>{company.name}</span>
              </span>
            )}
          </div>
        </div>

        <div className="ml-6 space-y-1">
          {contact?.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-1 text-xs text-[#0D9488] hover:underline"
              data-testid={`link-phone-${opp.id}`}
            >
              <Phone className="w-3 h-3 flex-shrink-0" />
              {contact.phone}
            </a>
          )}

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400">
            {company?.industry && (
              <span data-testid={`text-opp-industry-${opp.id}`}>{company.industry}</span>
            )}
            {company?.city && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                <span data-testid={`text-opp-city-${opp.id}`}>{company.city}</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-2">
              {opp.value && parseFloat(opp.value) > 0 && (
                <span
                  className="flex items-center gap-0.5 text-xs font-semibold text-green-600"
                  data-testid={`text-opp-value-${opp.id}`}
                >
                  <DollarSign className="w-3 h-3" />
                  {parseFloat(opp.value).toLocaleString()}
                </span>
              )}
              {pkg && (
                <span
                  className={`text-[10px] font-semibold rounded px-1 py-0.5 uppercase tracking-wide ${PKG_COLORS[pkg] ?? "bg-gray-100 text-gray-600"}`}
                  data-testid={`badge-pkg-${opp.id}`}
                >
                  {pkg}
                </span>
              )}
            </div>

            {!isDragging && onTaskClick && (
              <button
                className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-[#0D9488] transition-colors opacity-0 group-hover:opacity-100"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTaskClick(opp); }}
                data-testid={`button-add-task-${opp.id}`}
                title={t.pipeline.addFollowUpTask}
              >
                <CheckCircle2 className="w-3 h-3" />
                {t.pipeline.noteTypes.task}
              </button>
            )}
          </div>
        </div>

        {opp.status !== "open" && (
          <Badge
            variant={opp.status === "won" ? "default" : "destructive"}
            className="mt-2 text-xs ml-6"
          >
            {opp.status === "won" ? t.pipeline.closeWon.split("—")[1]?.trim() || "Won" : t.pipeline.closeLost.split("—")[1]?.trim() || "Lost"}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function DraggableCard({
  opp,
  contactMap,
  companyMap,
  onTaskClick,
}: {
  opp: PipelineOpportunity;
  contactMap: Record<string, ContactSnap>;
  companyMap: Record<string, CompanySnap>;
  onTaskClick: (opp: PipelineOpportunity) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: opp.id,
    data: { opp },
  });

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        className="mb-2 h-[116px] rounded-lg border-2 border-dashed border-[#0D9488]/25 bg-[#0D9488]/5"
        data-testid={`card-opportunity-${opp.id}`}
      />
    );
  }

  return (
    <div ref={setNodeRef} className="mb-2" data-testid={`card-opportunity-${opp.id}`}>
      <CardDisplay
        opp={opp}
        dragHandleProps={{ listeners, attributes }}
        contactMap={contactMap}
        companyMap={companyMap}
        onTaskClick={onTaskClick}
      />
    </div>
  );
}

function StageColumn({
  stage,
  opportunities,
  isOver,
  contactMap,
  companyMap,
  onTaskClick,
}: {
  stage: PipelineStage;
  opportunities: PipelineOpportunity[];
  isOver: boolean;
  contactMap: Record<string, ContactSnap>;
  companyMap: Record<string, CompanySnap>;
  onTaskClick: (opp: PipelineOpportunity) => void;
}) {
  const { t } = useAdminLang();
  const { setNodeRef } = useDroppable({ id: stage.id, data: { stage } });
  const totalValue = opportunities.reduce((sum, o) => sum + parseFloat(o.value || "0"), 0);

  return (
    <div
      className="flex-shrink-0 w-[272px] flex flex-col max-h-full"
      data-testid={`column-stage-${stage.slug}`}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
          <h3 className="text-sm font-semibold text-gray-700">{(t.pipeline.stageNames as Record<string, string>)[stage.slug] || stage.name}</h3>
          <Badge
            variant="secondary"
            className="text-xs h-5 px-1.5"
            data-testid={`badge-stage-count-${stage.slug}`}
          >
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

      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto min-h-[120px] px-1 pb-2 rounded-xl transition-all duration-150 ${
          isOver
            ? "bg-[#0D9488]/8 ring-2 ring-[#0D9488]/30 ring-inset"
            : "bg-transparent"
        }`}
      >
        {opportunities.map((opp) => (
          <DraggableCard
            key={opp.id}
            opp={opp}
            contactMap={contactMap}
            companyMap={companyMap}
            onTaskClick={onTaskClick}
          />
        ))}

        {opportunities.length === 0 && (
          <div
            className={`flex items-center justify-center h-24 rounded-lg border-2 border-dashed transition-all duration-150 ${
              isOver
                ? "border-[#0D9488]/50 bg-[#0D9488]/5 text-[#0D9488]"
                : "border-gray-200 text-gray-300"
            }`}
          >
            <span className="text-xs font-medium">
              {isOver ? t.pipeline.dropHere : t.pipeline.noOpportunities}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelineBoardPage() {
  const { toast } = useToast();
  const { t } = useAdminLang();
  const [activeOpp, setActiveOpp] = useState<PipelineOpportunity | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [taskOpp, setTaskOpp] = useState<PipelineOpportunity | null>(null);

  const { data, isLoading } = useQuery<BoardData>({
    queryKey: ["/api/pipeline/opportunities/board"],
    staleTime: STALE.FAST,
    refetchOnWindowFocus: true,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ oppId, stageId }: { oppId: string; stageId: string }) => {
      const res = await apiRequest("PUT", `/api/pipeline/opportunities/${oppId}/stage`, { stageId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      toast({ title: "Move failed", description: err.message, variant: "destructive" });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveOpp((event.active.data.current?.opp as PipelineOpportunity) ?? null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveOpp(null);
      setOverId(null);

      const { active, over } = event;
      if (!over) return;

      const oppId = String(active.id);
      const targetStageId = String(over.id);
      const opp = active.data.current?.opp as PipelineOpportunity | undefined;
      if (!opp || opp.stageId === targetStageId) return;

      const targetStage = data?.stages.find((s) => s.id === targetStageId);
      if (!targetStage) return;

      queryClient.setQueryData<BoardData>(
        ["/api/pipeline/opportunities/board"],
        (old) => {
          if (!old) return old;
          const newBoard = { ...old.board };

          if (opp.stageId && newBoard[opp.stageId]) {
            newBoard[opp.stageId] = {
              ...newBoard[opp.stageId],
              opportunities: newBoard[opp.stageId].opportunities.filter((o) => o.id !== oppId),
            };
          }

          const updatedOpp: PipelineOpportunity = {
            ...opp,
            stageId: targetStageId,
            status: targetStage.isClosed
              ? targetStage.slug === "closed-won"
                ? "won"
                : "lost"
              : "open",
          };

          if (newBoard[targetStageId]) {
            newBoard[targetStageId] = {
              ...newBoard[targetStageId],
              opportunities: [updatedOpp, ...newBoard[targetStageId].opportunities],
            };
          }

          return { ...old, board: newBoard };
        }
      );

      moveMutation.mutate({ oppId, stageId: targetStageId });
    },
    [data, moveMutation]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stages = data?.stages || [];
  const board = data?.board || {};
  const contactMap = data?.contactMap || {};
  const companyMap = data?.companyMap || {};

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="h-full flex flex-col" data-testid="page-pipeline-board">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="text-pipeline-title">
                {t.pipeline.title}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {t.pipeline.helperText}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/pipeline/list">
                <Button variant="outline" size="sm" data-testid="button-list-view">
                  <List className="w-4 h-4 mr-1" />
                  {t.pipeline.listView}
                </Button>
              </Link>
              <Link href="/admin/pipeline/stages">
                <Button variant="outline" size="sm" data-testid="button-manage-stages">
                  {t.pipeline.manageStages}
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <div
              className="flex gap-4 min-h-[400px] pb-4"
              style={{ minWidth: stages.length * 288 }}
            >
              {stages.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  opportunities={board[stage.id]?.opportunities || []}
                  isOver={overId === stage.id}
                  contactMap={contactMap}
                  companyMap={companyMap}
                  onTaskClick={(opp) => setTaskOpp(opp)}
                />
              ))}
            </div>
          </div>
        </div>

        <DragOverlay
          dropAnimation={{
            duration: 180,
            easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
          }}
        >
          {activeOpp ? (
            <div className="w-[256px]">
              <CardDisplay
                opp={activeOpp}
                isDragging
                contactMap={contactMap}
                companyMap={companyMap}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <QuickTaskModal
        open={!!taskOpp}
        onClose={() => setTaskOpp(null)}
        opportunityId={taskOpp?.id}
        contactId={taskOpp?.contactId}
        defaultTitle={taskOpp ? `Follow up with ${taskOpp.title}` : ""}
      />
    </>
  );
}
