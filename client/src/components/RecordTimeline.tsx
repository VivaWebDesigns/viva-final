import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/queryClient";
import { Clock, ArrowRight, User, CheckCircle2, XCircle, Shuffle, GitBranch, Plus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useAdminLang } from "@/i18n/LanguageContext";

interface HistoryEvent {
  id: string;
  entityType: string;
  entityId: string;
  event: string;
  fieldName?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  note?: string | null;
  createdAt: string;
}

const EVENT_ICONS: Record<string, { icon: typeof Clock; color: string }> = {
  created:               { icon: Plus,         color: "text-blue-500" },
  status_changed:        { icon: Shuffle,      color: "text-amber-500" },
  stage_changed:         { icon: GitBranch,    color: "text-teal-500" },
  assigned:              { icon: User,         color: "text-violet-500" },
  converted:             { icon: ArrowRight,   color: "text-teal-600" },
  created_from_lead:     { icon: ArrowRight,   color: "text-teal-600" },
  closed_won:            { icon: CheckCircle2, color: "text-green-600" },
  closed_lost:           { icon: XCircle,      color: "text-red-500" },
  checklist_completed:   { icon: CheckCircle2, color: "text-green-500" },
  checklist_uncompleted: { icon: AlertCircle,  color: "text-amber-500" },
  field_updated:         { icon: Clock,        color: "text-gray-500" },
};

function EventIcon({ event }: { event: string }) {
  const cfg = EVENT_ICONS[event] ?? { icon: Clock, color: "text-gray-400" };
  const Icon = cfg.icon;
  return <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", cfg.color)} />;
}

interface RecordTimelineProps {
  entityType: string;
  entityId: string;
  limit?: number;
  className?: string;
}

export function RecordTimeline({ entityType, entityId, limit = 15, className }: RecordTimelineProps) {
  const { t } = useAdminLang();

  const eventLabel = (event: string): string =>
    (t.timeline.events as Record<string, string>)[event] ?? event.replace(/_/g, " ");

  const { data: events = [], isLoading } = useQuery<HistoryEvent[]>({
    queryKey: ["/api/history", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/history/${entityType}/${entityId}?limit=${limit}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
    staleTime: STALE.MEDIUM,
    enabled: !!entityId,
  });

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={cn("text-xs text-gray-400 text-center py-4", className)}>
        {t.timeline.noHistory}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100 dark:bg-gray-800" aria-hidden />
      <div className="space-y-3">
        {events.map((ev) => {
          const ago = formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true });
          return (
            <div key={ev.id} className="flex items-start gap-3 relative" data-testid={`history-event-${ev.id}`}>
              <div className="w-7 h-7 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center z-10 flex-shrink-0">
                <EventIcon event={ev.event} />
              </div>
              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                    {eventLabel(ev.event)}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{ago}</span>
                </div>
                {ev.note && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ev.note}</p>
                )}
                {!ev.note && ev.fromValue && ev.toValue && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="line-through mr-1">{ev.fromValue}</span>→{" "}
                    <span className="text-gray-700 dark:text-gray-300">{ev.toValue}</span>
                  </p>
                )}
                {ev.actorName && (
                  <p className="text-xs text-gray-400 mt-0.5">{t.timeline.by} {ev.actorName}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
