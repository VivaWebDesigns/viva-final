import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseSalesPriority,
  type SalesPrioritySnapshot,
} from "@shared/salesPriority";

const PRIORITY_STYLES = {
  3: "border-rose-200 bg-rose-50 text-rose-700",
  2: "border-amber-200 bg-amber-50 text-amber-700",
  1: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

const PRIORITY_LABELS = {
  3: "Strong prospect",
  2: "Viable prospect",
  1: "Low-priority prospect",
} as const;

interface SalesPriorityBadgeProps {
  salesPriority?: SalesPrioritySnapshot | null;
  priority?: number | string | null;
  reason?: string | null;
  showLabel?: boolean;
  className?: string;
  testId?: string;
}

export default function SalesPriorityBadge({
  salesPriority,
  priority: rawPriority,
  reason: rawReason,
  showLabel = false,
  className,
  testId,
}: SalesPriorityBadgeProps) {
  const priority = parseSalesPriority(salesPriority?.priority ?? rawPriority);
  if (!priority) return null;

  const reason = salesPriority?.reason ?? rawReason ?? null;
  const label = `Priority ${priority} — ${PRIORITY_LABELS[priority]}`;
  const title = reason ? `${label}: ${reason}` : label;

  return (
    <span
      className={cn(
        "inline-flex h-5 flex-shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold leading-none",
        PRIORITY_STYLES[priority],
        className,
      )}
      title={title}
      aria-label={title}
      data-testid={testId}
    >
      <Target className="h-3 w-3" aria-hidden="true" />
      <span>{showLabel ? `Priority ${priority}` : priority}</span>
    </span>
  );
}
