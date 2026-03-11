export const CHANNEL_IDS = {
  general: "general",
  sales: "sales",
  onboarding: "onboarding",
  dev: "dev",
} as const;

export type CanonicalChannelId = typeof CHANNEL_IDS[keyof typeof CHANNEL_IDS];

export const CANONICAL_CHANNEL_IDS: CanonicalChannelId[] = Object.values(CHANNEL_IDS);

export const CHANNEL_DEFINITIONS: {
  id: CanonicalChannelId;
  name: string;
  description: string;
}[] = [
  { id: "general",    name: "General",    description: "Team announcements and conversation" },
  { id: "sales",      name: "Sales",      description: "Sales pipeline and prospects" },
  { id: "onboarding", name: "Onboarding", description: "Client onboarding coordination" },
  { id: "dev",        name: "Dev",        description: "Technical and development topics" },
];

const LEGACY_CHANNEL_MAP: Record<string, CanonicalChannelId> = {
  ventas: "sales",
};

export function normalizeChannelId(raw: string): CanonicalChannelId | undefined {
  const lower = raw.trim().toLowerCase();
  if ((CANONICAL_CHANNEL_IDS as readonly string[]).includes(lower)) {
    return lower as CanonicalChannelId;
  }
  return LEGACY_CHANNEL_MAP[lower];
}
