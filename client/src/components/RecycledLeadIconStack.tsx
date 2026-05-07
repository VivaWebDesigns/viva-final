import { Recycle } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecycledLeadIconStackProps {
  count?: number | null;
  className?: string;
  iconClassName?: string;
}

export default function RecycledLeadIconStack({
  count,
  className,
  iconClassName,
}: RecycledLeadIconStackProps) {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  if (safeCount === 0) return null;

  return (
    <span
      className={cn("inline-flex items-center", className)}
      title={`${safeCount} recycled assignment${safeCount === 1 ? "" : "s"}`}
      aria-label={`${safeCount} recycled assignment${safeCount === 1 ? "" : "s"}`}
    >
      {Array.from({ length: safeCount }).map((_, index) => (
        <Recycle
          key={index}
          className={cn(
            "h-3.5 w-3.5 flex-shrink-0 text-amber-600",
            index > 0 && "-ml-1.5",
            iconClassName,
          )}
          style={{ zIndex: safeCount - index }}
        />
      ))}
    </span>
  );
}
