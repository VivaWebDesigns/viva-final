import { Badge } from "@/components/ui/badge";

interface LeadTag {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

export default function LeadTagBadges({
  tags,
  testIdPrefix,
}: {
  tags?: LeadTag[] | null;
  testIdPrefix: string;
}) {
  if (!tags?.length) return null;

  return (
    <>
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="h-5 px-1.5 text-[10px] font-semibold"
          style={tag.color ? {
            backgroundColor: `${tag.color}14`,
            borderColor: `${tag.color}55`,
            color: tag.color,
          } : undefined}
          data-testid={`${testIdPrefix}-${tag.slug}`}
        >
          {tag.name}
        </Badge>
      ))}
    </>
  );
}
