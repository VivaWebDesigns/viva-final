import { PhoneOff, Recycle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecycledLeadIconStackProps {
  count?: number | null;
  recycleCount?: number | null;
  hungUpCount?: number | null;
  className?: string;
  iconClassName?: string;
}

function normalizeCount(value: number | null | undefined) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function renderStack({
  count,
  Icon,
  title,
  className,
}: {
  count: number;
  Icon: LucideIcon;
  title: string;
  className: string;
}) {
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center" title={title} aria-label={title}>
      {Array.from({ length: count }).map((_, index) => (
        <Icon
          key={index}
          className={cn("h-3.5 w-3.5 flex-shrink-0", className, index > 0 && "-ml-1.5")}
          style={{ zIndex: count - index }}
        />
      ))}
    </span>
  );
}

export default function RecycledLeadIconStack({
  count,
  recycleCount,
  hungUpCount,
  className,
  iconClassName,
}: RecycledLeadIconStackProps) {
  const safeRecycleCount = normalizeCount(recycleCount ?? count);
  const safeHungUpCount = normalizeCount(hungUpCount);
  if (safeRecycleCount === 0 && safeHungUpCount === 0) return null;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {renderStack({
        count: safeRecycleCount,
        Icon: Recycle,
        title: `${safeRecycleCount} recycled assignment${safeRecycleCount === 1 ? "" : "s"}`,
        className: cn("text-amber-600", iconClassName),
      })}
      {renderStack({
        count: safeHungUpCount,
        Icon: PhoneOff,
        title: `${safeHungUpCount} hung-up reassignment${safeHungUpCount === 1 ? "" : "s"}`,
        className: cn("text-rose-600", iconClassName),
      })}
    </span>
  );
}
