import { db } from "../../db";
import {
  marketplacePendingOutreach,
  MARKETPLACE_PENDING_OUTREACH_NON_TERMINAL_STATUSES,
  type MarketplacePendingOutreach,
} from "@shared/schema";
import { and, eq, inArray, isNotNull, isNull, or, ilike, sql, desc, count, type SQL } from "drizzle-orm";

type InsertMarketplacePendingOutreachFull = typeof marketplacePendingOutreach.$inferInsert;

export async function createPendingOutreach(
  data: InsertMarketplacePendingOutreachFull
): Promise<MarketplacePendingOutreach> {
  const [result] = await db
    .insert(marketplacePendingOutreach)
    .values(data)
    .returning();
  return result;
}

export async function getPendingOutreachById(
  id: string
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .select()
    .from(marketplacePendingOutreach)
    .where(eq(marketplacePendingOutreach.id, id));
  return result;
}

export async function updatePendingOutreach(
  id: string,
  data: Partial<Pick<
    MarketplacePendingOutreach,
    | "messageStatus"
    | "outreachMessage"
    | "outreachSentAt"
    | "replyReceivedAt"
    | "extractedPhone"
    | "replyPhoneNormalized"
    | "threadIdentifier"
    | "crmLeadId"
    | "convertedAt"
    | "convertedBy"
    | "city"
    | "state"
    | "tradeGuess"
    | "businessName"
  >>
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .update(marketplacePendingOutreach)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(marketplacePendingOutreach.id, id))
    .returning();
  return result;
}

export async function markPendingOutreachMessageSent(
  id: string,
  updates: {
    outreachSentAt: Date;
    outreachMessage?: string | null;
  }
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .update(marketplacePendingOutreach)
    .set({
      messageStatus:  "awaiting_reply",
      outreachSentAt: updates.outreachSentAt,
      ...(updates.outreachMessage !== undefined && { outreachMessage: updates.outreachMessage }),
      updatedAt: new Date(),
    })
    .where(eq(marketplacePendingOutreach.id, id))
    .returning();
  return result;
}

export async function captureReplyOnPendingOutreach(
  id: string,
  data: {
    lastReplyText:         string | null;
    extractedPhone?:       string | null;
    replyPhoneNormalized?: string | null;
    replyReceivedAt:       Date;
    threadIdentifier?:     string | null;
  }
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .update(marketplacePendingOutreach)
    .set({
      lastReplyText:        data.lastReplyText,
      extractedPhone:       data.extractedPhone       ?? null,
      replyPhoneNormalized: data.replyPhoneNormalized ?? null,
      replyReceivedAt:      data.replyReceivedAt,
      messageStatus:        "reply_received",
      manualReviewReason:   null,
      ...(data.threadIdentifier !== undefined && { threadIdentifier: data.threadIdentifier }),
      updatedAt: new Date(),
    })
    .where(eq(marketplacePendingOutreach.id, id))
    .returning();
  return result;
}

export async function findActivePendingOutreachBySellerUrl(
  normalizedSellerProfileUrl: string
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .select()
    .from(marketplacePendingOutreach)
    .where(
      and(
        eq(marketplacePendingOutreach.sellerProfileUrl, normalizedSellerProfileUrl),
        isNull(marketplacePendingOutreach.deletedAt),
        inArray(
          marketplacePendingOutreach.messageStatus,
          [...MARKETPLACE_PENDING_OUTREACH_NON_TERMINAL_STATUSES]
        )
      )
    )
    .limit(1);
  return result;
}

/**
 * Returns the most recent pending outreach record for the given seller URL,
 * across ALL statuses (including terminal: converted, skipped).
 * Used by the extension lookup route so the popup can resume from the correct stage.
 */
export async function findLatestPendingOutreachBySellerUrl(
  normalizedSellerProfileUrl: string
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .select()
    .from(marketplacePendingOutreach)
    .where(and(
      eq(marketplacePendingOutreach.sellerProfileUrl, normalizedSellerProfileUrl),
      isNull(marketplacePendingOutreach.deletedAt)
    ))
    .orderBy(desc(marketplacePendingOutreach.createdAt))
    .limit(1);
  return result;
}

/**
 * Messenger-context lookup: finds a pending outreach record by seller first name
 * (case-insensitive exact match) and listing title (case-insensitive substring —
 * the stored title must contain the incoming title, handling Messenger truncation).
 *
 * Returns:
 *   - the record    if exactly one match is found
 *   - "ambiguous"   if two or more records match (conservative — do not guess)
 *   - undefined     if no records match
 *
 * Both params must be normalized (trimmed, lowercased) by the caller before passing in.
 */
export async function findPendingOutreachByMessengerClues(
  sellerFirstNameNormalized: string,
  listingTitleNormalized: string
): Promise<MarketplacePendingOutreach | "ambiguous" | undefined> {
  // Title overlap is bidirectional to handle truncation on either side:
  //   • stored ILIKE '%incoming%' — incoming was truncated by Messenger (most common)
  //   • incoming ILIKE '%stored%' — stored title is shorter/abbreviated
  const results = await db
    .select()
    .from(marketplacePendingOutreach)
    .where(
      and(
        isNull(marketplacePendingOutreach.deletedAt),
        ilike(marketplacePendingOutreach.sellerFirstName, sellerFirstNameNormalized),
        or(
          ilike(marketplacePendingOutreach.listingTitleNormalized, `%${listingTitleNormalized}%`),
          sql`${listingTitleNormalized} ilike '%' || ${marketplacePendingOutreach.listingTitleNormalized} || '%'`
        )
      )
    )
    .orderBy(desc(marketplacePendingOutreach.createdAt));

  if (results.length === 0) return undefined;
  if (results.length > 1) return "ambiguous";
  return results[0];
}


export interface ListPendingOutreachFilters {
  page:       number;
  limit:      number;
  status?:    string;
  search?:    string;
  hasPhone?:  boolean;
  hasCrmLead?: boolean;
  deleted?:   boolean;
}

export interface ListPendingOutreachResult {
  items: MarketplacePendingOutreach[];
  total: number;
  page:  number;
  limit: number;
}

export async function listPendingOutreach(
  filters: ListPendingOutreachFilters
): Promise<ListPendingOutreachResult> {
  const { page, limit, status, search, hasPhone, hasCrmLead, deleted } = filters;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [
    deleted === true
      ? isNotNull(marketplacePendingOutreach.deletedAt)
      : isNull(marketplacePendingOutreach.deletedAt),
  ];

  if (status) {
    conditions.push(eq(marketplacePendingOutreach.messageStatus, status));
  }

  if (search) {
    const term = `%${search}%`;
    conditions.push(
      or(
        ilike(marketplacePendingOutreach.sellerFullName,       term),
        ilike(marketplacePendingOutreach.listingTitleRaw,      term),
        ilike(marketplacePendingOutreach.replyPhoneNormalized, term),
        ilike(marketplacePendingOutreach.extractedPhone,       term)
      )!
    );
  }

  if (hasPhone === true) {
    conditions.push(
      or(
        isNotNull(marketplacePendingOutreach.replyPhoneNormalized),
        isNotNull(marketplacePendingOutreach.extractedPhone)
      )!
    );
  } else if (hasPhone === false) {
    conditions.push(
      and(
        isNull(marketplacePendingOutreach.replyPhoneNormalized),
        isNull(marketplacePendingOutreach.extractedPhone)
      )!
    );
  }

  if (hasCrmLead === true) {
    conditions.push(isNotNull(marketplacePendingOutreach.crmLeadId));
  } else if (hasCrmLead === false) {
    conditions.push(isNull(marketplacePendingOutreach.crmLeadId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ count: count() })
    .from(marketplacePendingOutreach)
    .where(where);

  const items = await db
    .select()
    .from(marketplacePendingOutreach)
    .where(where)
    .orderBy(desc(marketplacePendingOutreach.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    total: Number(totalRow?.count ?? 0),
    page,
    limit,
  };
}

export async function approveManualReview(
  id: string
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .update(marketplacePendingOutreach)
    .set({
      messageStatus:      "reply_received",
      manualReviewReason: null,
      updatedAt:          new Date(),
    })
    .where(eq(marketplacePendingOutreach.id, id))
    .returning();
  return result;
}

export async function rejectManualReview(
  id: string
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .update(marketplacePendingOutreach)
    .set({
      messageStatus:      "skipped",
      manualReviewReason: "Manual review rejected by admin",
      updatedAt:          new Date(),
    })
    .where(eq(marketplacePendingOutreach.id, id))
    .returning();
  return result;
}

export async function getManyPendingOutreachByIds(
  ids: string[]
): Promise<MarketplacePendingOutreach[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(marketplacePendingOutreach)
    .where(inArray(marketplacePendingOutreach.id, ids));
}

export async function bulkSkipPendingOutreach(
  ids: string[]
): Promise<{ updatedIds: string[]; count: number; newStatus: string }> {
  const results = await db
    .update(marketplacePendingOutreach)
    .set({ messageStatus: "skipped", updatedAt: new Date() })
    .where(inArray(marketplacePendingOutreach.id, ids))
    .returning({ id: marketplacePendingOutreach.id });
  const updatedIds = results.map(r => r.id);
  return { updatedIds, count: updatedIds.length, newStatus: "skipped" };
}

export async function bulkApprovePendingOutreach(
  ids: string[]
): Promise<{ updatedIds: string[]; count: number; newStatus: string }> {
  const results = await db
    .update(marketplacePendingOutreach)
    .set({ messageStatus: "reply_received", manualReviewReason: null, updatedAt: new Date() })
    .where(inArray(marketplacePendingOutreach.id, ids))
    .returning({ id: marketplacePendingOutreach.id });
  const updatedIds = results.map(r => r.id);
  return { updatedIds, count: updatedIds.length, newStatus: "reply_received" };
}

export async function markPendingOutreachDuplicateBusiness(
  id: string
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .update(marketplacePendingOutreach)
    .set({ messageStatus: "duplicate_business", updatedAt: new Date() })
    .where(eq(marketplacePendingOutreach.id, id))
    .returning();
  return result;
}

export async function deletePendingOutreach(
  id: string,
  deletedBy?: string | null
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .update(marketplacePendingOutreach)
    .set({
      deletedAt: new Date(),
      deletedBy: deletedBy ?? null,
      updatedAt: new Date(),
    })
    .where(eq(marketplacePendingOutreach.id, id))
    .returning();
  return result;
}

export async function bulkDeletePendingOutreach(
  ids: string[],
  deletedBy?: string | null
): Promise<{ deletedIds: string[]; count: number }> {
  if (ids.length === 0) return { deletedIds: [], count: 0 };
  const results = await db
    .update(marketplacePendingOutreach)
    .set({
      deletedAt: new Date(),
      deletedBy: deletedBy ?? null,
      updatedAt: new Date(),
    })
    .where(inArray(marketplacePendingOutreach.id, ids))
    .returning({ id: marketplacePendingOutreach.id });
  const deletedIds = results.map(r => r.id);
  return { deletedIds, count: deletedIds.length };
}

export async function restorePendingOutreach(
  id: string
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .update(marketplacePendingOutreach)
    .set({
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      updatedAt: new Date(),
    })
    .where(eq(marketplacePendingOutreach.id, id))
    .returning();
  return result;
}

export interface ListMyLeadsFilters {
  statusGroup?: "open" | "converted" | "closed";
  page:         number;
  limit:        number;
}

export interface MyLeadsItem {
  id:              string;
  sellerFullName:  string;
  businessName:    string | null;
  city:            string | null;
  state:           string | null;
  tradeGuess:      string | null;
  messageStatus:   string;
  createdAt:       Date;
  updatedAt:       Date;
  convertedAt:     Date | null;
  listingUrl:      string | null;
  sellerProfileUrl: string;
}

export interface ListMyLeadsResult {
  items: MyLeadsItem[];
  total: number;
  page:  number;
  limit: number;
}

const STATUS_GROUP_MAP: Record<"open" | "converted" | "closed", string[]> = {
  open:      [...MARKETPLACE_PENDING_OUTREACH_NON_TERMINAL_STATUSES],
  converted: ["converted"],
  closed:    ["skipped", "duplicate_business"],
};

export async function listMyLeads(
  userId: string,
  filters: ListMyLeadsFilters
): Promise<ListMyLeadsResult> {
  const { statusGroup, page, limit } = filters;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(marketplacePendingOutreach.createdBy, userId),
    isNull(marketplacePendingOutreach.deletedAt),
  ];

  if (statusGroup) {
    conditions.push(inArray(marketplacePendingOutreach.messageStatus, STATUS_GROUP_MAP[statusGroup]));
  }

  const where = and(...conditions);

  const [totalRow] = await db
    .select({ count: count() })
    .from(marketplacePendingOutreach)
    .where(where);

  const items = await db
    .select({
      id:              marketplacePendingOutreach.id,
      sellerFullName:  marketplacePendingOutreach.sellerFullName,
      businessName:    marketplacePendingOutreach.businessName,
      city:            marketplacePendingOutreach.city,
      state:           marketplacePendingOutreach.state,
      tradeGuess:      marketplacePendingOutreach.tradeGuess,
      messageStatus:   marketplacePendingOutreach.messageStatus,
      createdAt:       marketplacePendingOutreach.createdAt,
      updatedAt:       marketplacePendingOutreach.updatedAt,
      convertedAt:     marketplacePendingOutreach.convertedAt,
      listingUrl:      marketplacePendingOutreach.listingUrl,
      sellerProfileUrl: marketplacePendingOutreach.sellerProfileUrl,
    })
    .from(marketplacePendingOutreach)
    .where(where)
    .orderBy(desc(marketplacePendingOutreach.updatedAt), desc(marketplacePendingOutreach.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    total: Number(totalRow?.count ?? 0),
    page,
    limit,
  };
}

export async function getPendingOutreachSummary(): Promise<Record<string, number>> {
  const rows = await db
    .select({
      status: marketplacePendingOutreach.messageStatus,
      count:  count(),
    })
    .from(marketplacePendingOutreach)
    .where(isNull(marketplacePendingOutreach.deletedAt))
    .groupBy(marketplacePendingOutreach.messageStatus);

  const [deletedRow] = await db
    .select({ count: count() })
    .from(marketplacePendingOutreach)
    .where(isNotNull(marketplacePendingOutreach.deletedAt));

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.status] = Number(row.count);
  }
  result.deleted = Number(deletedRow?.count ?? 0);
  return result;
}

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function nextLocalDay(value: Date) {
  const date = startOfLocalDay(value);
  date.setDate(date.getDate() + 1);
  return date;
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetweenInclusive(from: Date, to: Date) {
  const start = startOfLocalDay(from).getTime();
  const end = startOfLocalDay(to).getTime();
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function makeLeadGenRange(options: { days?: number; from?: string; to?: string } = {}) {
  if (options.from || options.to) {
    const parsedFrom = options.from ? parseDateOnly(options.from) : null;
    const parsedTo = options.to ? parseDateOnly(options.to) : parsedFrom;
    if (parsedFrom && parsedTo) {
      const from = startOfLocalDay(parsedFrom <= parsedTo ? parsedFrom : parsedTo);
      const toDay = startOfLocalDay(parsedFrom <= parsedTo ? parsedTo : parsedFrom);
      const days = Math.min(daysBetweenInclusive(from, toDay), 90);
      const cappedToDay = new Date(from);
      cappedToDay.setDate(cappedToDay.getDate() + days - 1);
      return { from, to: cappedToDay, endExclusive: nextLocalDay(cappedToDay), days };
    }
  }

  const safeDays = Number.isFinite(options.days) && options.days && options.days > 0 ? Math.min(options.days, 90) : 7;
  const to = startOfLocalDay(new Date());
  const from = new Date(to);
  from.setDate(from.getDate() - safeDays + 1);
  return { from, to, endExclusive: nextLocalDay(to), days: safeDays };
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function pct(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

const PRIMARY_COVERAGE_TRADES = [
  { value: "landscaping",        label: "Landscaping" },
  { value: "painting",           label: "Painting" },
  { value: "house_cleaning",     label: "House Cleaning" },
  { value: "tile_installation",  label: "Tile Installation" },
  { value: "deck_building",      label: "Deck Building" },
  { value: "concrete_asphalt",   label: "Concrete / Asphalt" },
  { value: "tree_service",       label: "Tree Service" },
  { value: "flooring",           label: "Flooring" },
  { value: "fence_installation", label: "Fence Installation" },
  { value: "roofing",            label: "Roofing" },
] as const;

const ALL_EXTENSION_TRADES: Record<string, string> = {
  carpentry: "Carpentry",
  concrete_asphalt: "Concrete / Asphalt",
  deck_building: "Deck Building",
  doors: "Doors",
  electrical: "Electrical",
  fence_installation: "Fence Installation",
  flooring: "Flooring",
  general_contractor: "General Contractor",
  handyman: "Handyman",
  house_cleaning: "House Cleaning",
  hvac: "HVAC",
  landscaping: "Landscaping",
  masonry: "Masonry",
  painting: "Painting",
  plumbing: "Plumbing",
  pressure_washing: "Pressure Washing",
  roofing: "Roofing",
  shed_building: "Shed Building",
  shower_glass: "Shower glass",
  siding: "Siding",
  stonework: "Stonework",
  tile_installation: "Tile Installation",
  tree_service: "Tree Service",
  windows: "Windows",
};

const NC_TARGET_MARKETS = [
  {
    id: "nc-charlotte",
    name: "Charlotte",
    state: "NC",
    radiusMiles: 20,
    pin: { x: 36, y: 68 },
    cities: ["Belmont", "Charlotte", "Concord", "Cornelius", "Davidson", "Gastonia", "Harrisburg", "Huntersville", "Indian Trail", "Matthews", "Mint Hill", "Stallings"],
  },
  {
    id: "nc-raleigh",
    name: "Raleigh",
    state: "NC",
    radiusMiles: 20,
    pin: { x: 68, y: 54 },
    cities: ["Apex", "Cary", "Clayton", "Fuquay-Varina", "Garner", "Holly Springs", "Knightdale", "Morrisville", "Raleigh", "Wake Forest"],
  },
  {
    id: "nc-durham",
    name: "Durham",
    state: "NC",
    radiusMiles: 20,
    pin: { x: 62, y: 47 },
    cities: ["Chapel Hill", "Durham", "Pittsboro"],
  },
  {
    id: "nc-greensboro",
    name: "Greensboro",
    state: "NC",
    radiusMiles: 20,
    pin: { x: 50, y: 45 },
    cities: ["Archdale", "Burlington", "Graham", "Greensboro", "High Point", "Thomasville"],
  },
  {
    id: "nc-winston-salem",
    name: "Winston-Salem",
    state: "NC",
    radiusMiles: 20,
    pin: { x: 43, y: 43 },
    cities: ["Kernersville", "Lewisville", "Winston-Salem"],
  },
  {
    id: "nc-fayetteville",
    name: "Fayetteville",
    state: "NC",
    radiusMiles: 20,
    pin: { x: 64, y: 72 },
    cities: ["Fayetteville", "Hope Mills"],
  },
  {
    id: "nc-wilmington",
    name: "Wilmington",
    state: "NC",
    radiusMiles: 20,
    pin: { x: 83, y: 80 },
    cities: ["Wilmington"],
  },
  {
    id: "nc-asheville",
    name: "Asheville",
    state: "NC",
    radiusMiles: 20,
    pin: { x: 18, y: 49 },
    cities: ["Asheville"],
  },
  {
    id: "nc-greenville",
    name: "Greenville",
    state: "NC",
    radiusMiles: 20,
    pin: { x: 82, y: 49 },
    cities: ["Greenville", "Winterville"],
  },
  {
    id: "nc-hickory",
    name: "Hickory",
    state: "NC",
    radiusMiles: 20,
    pin: { x: 32, y: 47 },
    cities: ["Hickory"],
  },
  {
    id: "nc-jacksonville",
    name: "Jacksonville",
    state: "NC",
    radiusMiles: 20,
    pin: { x: 84, y: 69 },
    cities: ["Jacksonville"],
  },
] as const;

type TargetMarket = typeof NC_TARGET_MARKETS[number];

function normalizeCoverageToken(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function marketCityKey(city: string | null | undefined, state: string | null | undefined) {
  return `${normalizeCoverageToken(city)}|${normalizeCoverageToken(state)}`;
}

const NC_MARKET_BY_CITY = new Map<string, TargetMarket>();
for (const market of NC_TARGET_MARKETS) {
  for (const city of market.cities) {
    const key = marketCityKey(city, market.state);
    if (!NC_MARKET_BY_CITY.has(key)) {
      NC_MARKET_BY_CITY.set(key, market);
    }
  }
}

function formatTradeLabel(value: string | null | undefined) {
  if (!value) return "Unknown";
  return ALL_EXTENSION_TRADES[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());
}

type CoverageLeadRow = {
  id: string;
  sellerFullName: string;
  businessName: string | null;
  city: string | null;
  state: string | null;
  trade: string | null;
  convertedAt: Date | null;
  crmLeadId: string | null;
  convertedBy: string | null;
  convertedByName: string | null;
};

type MutableCoverageMarket = {
  id: string;
  name: string;
  state: string;
  radiusMiles: number;
  pin: { x: number; y: number } | null;
  includedCities: string[];
  totalLeads: number;
  dateRange: { from: string | null; to: string | null };
  reps: Map<string, { userId: string | null; name: string; count: number }>;
  trades: Map<string, { value: string; label: string; count: number }>;
  capturedCities: Map<string, { city: string; state: string; count: number }>;
  recentLeads: Array<{
    id: string;
    sellerFullName: string;
    businessName: string | null;
    city: string | null;
    state: string | null;
    trade: string | null;
    tradeLabel: string;
    convertedAt: string | null;
    convertedByName: string | null;
    crmLeadId: string | null;
  }>;
};

function makeMutableCoverageMarket(market: TargetMarket): MutableCoverageMarket {
  return {
    id: market.id,
    name: market.name,
    state: market.state,
    radiusMiles: market.radiusMiles,
    pin: market.pin,
    includedCities: [...market.cities].sort((a, b) => a.localeCompare(b)),
    totalLeads: 0,
    dateRange: { from: null, to: null },
    reps: new Map(),
    trades: new Map(),
    capturedCities: new Map(),
    recentLeads: [],
  };
}

function finalizeCoverageMarket(market: MutableCoverageMarket) {
  const primaryValues = new Set<string>(PRIMARY_COVERAGE_TRADES.map(trade => trade.value));
  const coveredPrimaryValues = new Set(
    [...market.trades.values()]
      .filter(trade => primaryValues.has(trade.value) && trade.count > 0)
      .map(trade => trade.value)
  );
  const missingTrades = PRIMARY_COVERAGE_TRADES
    .filter(trade => !coveredPrimaryValues.has(trade.value))
    .map(trade => ({ value: trade.value, label: trade.label }));

  return {
    id: market.id,
    name: market.name,
    state: market.state,
    radiusMiles: market.radiusMiles,
    pin: market.pin,
    includedCities: market.includedCities,
    totalLeads: market.totalLeads,
    dateRange: market.dateRange,
    coverage: {
      covered: coveredPrimaryValues.size,
      total: PRIMARY_COVERAGE_TRADES.length,
      percent: pct(coveredPrimaryValues.size, PRIMARY_COVERAGE_TRADES.length),
      missingTrades,
    },
    reps: [...market.reps.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    trades: [...market.trades.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    capturedCities: [...market.capturedCities.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city)),
    recentLeads: market.recentLeads
      .sort((a, b) => String(b.convertedAt ?? "").localeCompare(String(a.convertedAt ?? "")))
      .slice(0, 12),
  };
}

function addLeadToCoverageMarket(market: MutableCoverageMarket, row: CoverageLeadRow) {
  market.totalLeads += 1;

  const convertedAtIso = row.convertedAt?.toISOString() ?? null;
  if (convertedAtIso) {
    if (!market.dateRange.from || convertedAtIso < market.dateRange.from) market.dateRange.from = convertedAtIso;
    if (!market.dateRange.to || convertedAtIso > market.dateRange.to) market.dateRange.to = convertedAtIso;
  }

  const repKey = row.convertedBy ?? "__unknown__";
  const rep = market.reps.get(repKey) ?? {
    userId: row.convertedBy,
    name: row.convertedByName ?? "Unknown rep",
    count: 0,
  };
  rep.count += 1;
  market.reps.set(repKey, rep);

  const tradeValue = row.trade ?? "unknown";
  const trade = market.trades.get(tradeValue) ?? {
    value: tradeValue,
    label: formatTradeLabel(row.trade),
    count: 0,
  };
  trade.count += 1;
  market.trades.set(tradeValue, trade);

  const cityLabel = row.city?.trim() || "Unknown city";
  const stateLabel = row.state?.trim().toUpperCase() || "NC";
  const cityKey = marketCityKey(cityLabel, stateLabel);
  const capturedCity = market.capturedCities.get(cityKey) ?? {
    city: cityLabel,
    state: stateLabel,
    count: 0,
  };
  capturedCity.count += 1;
  market.capturedCities.set(cityKey, capturedCity);

  market.recentLeads.push({
    id: row.id,
    sellerFullName: row.sellerFullName,
    businessName: row.businessName,
    city: row.city,
    state: row.state,
    trade: row.trade,
    tradeLabel: formatTradeLabel(row.trade),
    convertedAt: convertedAtIso,
    convertedByName: row.convertedByName,
    crmLeadId: row.crmLeadId,
  });
}

type LeadGenWorkerRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
  reviewed: number;
  contacted: number;
  replies: number;
  converted: number;
  skipped: number;
  duplicateBusiness: number;
  manualReview: number;
  avgQueueToConvertHours: number | null;
};

export async function getLeadCoverageSummary(options: number | { days?: number; from?: string; to?: string } = 30) {
  const range = makeLeadGenRange(typeof options === "number" ? { days: options } : options);

  const rows = await db.execute(sql`
    SELECT
      m.id,
      m.seller_full_name AS "sellerFullName",
      m.business_name AS "businessName",
      m.city,
      m.state,
      m.trade_guess AS "trade",
      m.converted_at AS "convertedAt",
      m.crm_lead_id AS "crmLeadId",
      m.converted_by AS "convertedBy",
      u.name AS "convertedByName"
    FROM marketplace_pending_outreach m
    LEFT JOIN "user" u ON u.id = m.converted_by
    WHERE m.deleted_at IS NULL
      AND m.message_status = 'converted'
      AND m.converted_at >= ${range.from}
      AND m.converted_at < ${range.endExclusive}
      AND upper(coalesce(m.state, '')) = 'NC'
    ORDER BY m.converted_at DESC
  `);

  const markets = new Map<string, MutableCoverageMarket>();
  for (const target of NC_TARGET_MARKETS) {
    markets.set(target.id, makeMutableCoverageMarket(target));
  }

  const outsideMarket: MutableCoverageMarket = {
    id: "outside-target-markets",
    name: "Outside Target Markets",
    state: "NC",
    radiusMiles: 0,
    pin: null,
    includedCities: [],
    totalLeads: 0,
    dateRange: { from: null, to: null },
    reps: new Map(),
    trades: new Map(),
    capturedCities: new Map(),
    recentLeads: [],
  };

  for (const row of rows.rows as CoverageLeadRow[]) {
    const market = NC_MARKET_BY_CITY.get(marketCityKey(row.city, row.state));
    if (market) {
      addLeadToCoverageMarket(markets.get(market.id)!, row);
    } else {
      addLeadToCoverageMarket(outsideMarket, row);
    }
  }

  const marketList = [...markets.values()].map(finalizeCoverageMarket);
  const outside = finalizeCoverageMarket(outsideMarket);
  const totalLeads = marketList.reduce((sum, market) => sum + market.totalLeads, 0) + outside.totalLeads;
  const marketsWithCoverage = marketList.filter(market => market.totalLeads > 0).length;
  const completeMarkets = marketList.filter(market => market.coverage.missingTrades.length === 0).length;
  const averageCoveragePercent = marketList.length > 0
    ? Math.round(marketList.reduce((sum, market) => sum + market.coverage.percent, 0) / marketList.length)
    : 0;

  return {
    range: { from: range.from.toISOString(), to: range.endExclusive.toISOString(), days: range.days },
    targetState: "NC",
    targetTrades: PRIMARY_COVERAGE_TRADES,
    totals: {
      totalLeads,
      targetMarkets: marketList.length,
      marketsWithCoverage,
      completeMarkets,
      outsideTargetLeads: outside.totalLeads,
      averageCoveragePercent,
    },
    markets: marketList,
    outsideTargetMarkets: outside,
  };
}

export async function getLeadGenPerformanceSummary(options: number | { days?: number; from?: string; to?: string } = 7) {
  const range = makeLeadGenRange(typeof options === "number" ? { days: options } : options);
  const todayStart = startOfLocalDay(new Date());
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  const [workerRows, windowRows, dailyRows, dailyWorkerRows, nameActionRows, recentNameActionRows] = await Promise.all([
    db.execute(sql`
      WITH workers AS (
        SELECT id, name, email, role
        FROM "user"
        WHERE role IN ('lead_gen', 'extension_worker')
      )
      SELECT
        w.id AS "userId",
        w.name,
        w.email,
        w.role,
        COUNT(m.id) FILTER (WHERE m.created_by = w.id AND m.created_at >= ${range.from} AND m.created_at < ${range.endExclusive})::int AS "reviewed",
        COUNT(m.id) FILTER (WHERE m.created_by = w.id AND m.outreach_sent_at >= ${range.from} AND m.outreach_sent_at < ${range.endExclusive})::int AS "contacted",
        COUNT(m.id) FILTER (WHERE m.created_by = w.id AND m.reply_received_at >= ${range.from} AND m.reply_received_at < ${range.endExclusive})::int AS "replies",
        COUNT(m.id) FILTER (WHERE COALESCE(m.converted_by, m.created_by) = w.id AND m.message_status = 'converted' AND m.converted_at >= ${range.from} AND m.converted_at < ${range.endExclusive})::int AS "converted",
        COUNT(m.id) FILTER (WHERE m.created_by = w.id AND m.message_status = 'skipped' AND m.updated_at >= ${range.from} AND m.updated_at < ${range.endExclusive})::int AS "skipped",
        COUNT(m.id) FILTER (WHERE m.created_by = w.id AND m.message_status = 'duplicate_business' AND m.updated_at >= ${range.from} AND m.updated_at < ${range.endExclusive})::int AS "duplicateBusiness",
        COUNT(m.id) FILTER (WHERE m.created_by = w.id AND m.message_status = 'manual_review_required' AND m.updated_at >= ${range.from} AND m.updated_at < ${range.endExclusive})::int AS "manualReview",
        ROUND(AVG(EXTRACT(EPOCH FROM (m.converted_at - m.created_at)) / 3600.0)
          FILTER (WHERE COALESCE(m.converted_by, m.created_by) = w.id AND m.message_status = 'converted' AND m.converted_at >= ${range.from} AND m.converted_at < ${range.endExclusive}), 1) AS "avgQueueToConvertHours"
      FROM workers w
      LEFT JOIN marketplace_pending_outreach m
        ON m.deleted_at IS NULL
        AND (
          m.created_by = w.id
          OR COALESCE(m.converted_by, m.created_by) = w.id
        )
      GROUP BY w.id, w.name, w.email, w.role
      ORDER BY "converted" DESC, "contacted" DESC, w.name ASC
    `),
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE message_status = 'converted' AND converted_at >= ${todayStart})::int AS "completedToday",
        COUNT(*) FILTER (WHERE message_status = 'converted' AND converted_at >= ${sevenDaysAgo})::int AS "completed7d",
        COUNT(*) FILTER (WHERE message_status = 'converted' AND converted_at >= ${thirtyDaysAgo})::int AS "completed30d"
      FROM marketplace_pending_outreach m
      INNER JOIN "user" u ON u.id = COALESCE(m.converted_by, m.created_by)
      WHERE u.role IN ('lead_gen', 'extension_worker')
        AND m.deleted_at IS NULL
    `),
    db.execute(sql`
      WITH days AS (
        SELECT generate_series(${range.from}::timestamp::date, (${range.endExclusive}::timestamp::date - interval '1 day')::date, interval '1 day')::date AS day
      )
      SELECT
        d.day::text AS "date",
        COUNT(m.id) FILTER (WHERE DATE(m.created_at) = d.day)::int AS "reviewed",
        COUNT(m.id) FILTER (WHERE DATE(m.outreach_sent_at) = d.day)::int AS "contacted",
        COUNT(m.id) FILTER (WHERE DATE(m.reply_received_at) = d.day)::int AS "replies",
        COUNT(m.id) FILTER (WHERE m.message_status = 'converted' AND DATE(m.converted_at) = d.day AND EXISTS (
          SELECT 1 FROM "user" u
          WHERE u.id = COALESCE(m.converted_by, m.created_by)
            AND u.role IN ('lead_gen', 'extension_worker')
        ))::int AS "converted",
        COUNT(m.id) FILTER (WHERE m.message_status = 'skipped' AND DATE(m.updated_at) = d.day)::int AS "skipped"
      FROM days d
      LEFT JOIN marketplace_pending_outreach m
        ON (
          DATE(m.created_at) = d.day
          OR DATE(m.outreach_sent_at) = d.day
          OR DATE(m.reply_received_at) = d.day
          OR DATE(m.converted_at) = d.day
          OR DATE(m.updated_at) = d.day
        )
        AND m.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM "user" u
          WHERE u.role IN ('lead_gen', 'extension_worker')
            AND (
              u.id = m.created_by
              OR u.id = COALESCE(m.converted_by, m.created_by)
            )
        )
      GROUP BY d.day
      ORDER BY d.day ASC
    `),
    db.execute(sql`
      WITH days AS (
        SELECT generate_series(${range.from}::timestamp::date, (${range.endExclusive}::timestamp::date - interval '1 day')::date, interval '1 day')::date AS day
      ),
      workers AS (
        SELECT id, name, email, role
        FROM "user"
        WHERE role IN ('lead_gen', 'extension_worker')
      )
      SELECT
        d.day::text AS "date",
        w.id AS "userId",
        w.name,
        w.email,
        COUNT(m.id) FILTER (WHERE m.created_by = w.id AND DATE(m.created_at) = d.day)::int AS "reviewed",
        COUNT(m.id) FILTER (WHERE m.created_by = w.id AND DATE(m.outreach_sent_at) = d.day)::int AS "contacted",
        COUNT(m.id) FILTER (WHERE m.created_by = w.id AND DATE(m.reply_received_at) = d.day)::int AS "replies",
        COUNT(m.id) FILTER (WHERE COALESCE(m.converted_by, m.created_by) = w.id AND m.message_status = 'converted' AND DATE(m.converted_at) = d.day)::int AS "converted",
        COUNT(m.id) FILTER (WHERE m.created_by = w.id AND m.message_status = 'skipped' AND DATE(m.updated_at) = d.day)::int AS "skipped",
        COUNT(m.id) FILTER (WHERE m.created_by = w.id AND m.message_status = 'duplicate_business' AND DATE(m.updated_at) = d.day)::int AS "duplicateBusiness",
        COUNT(m.id) FILTER (WHERE m.created_by = w.id AND m.message_status = 'manual_review_required' AND DATE(m.updated_at) = d.day)::int AS "manualReview"
      FROM days d
      CROSS JOIN workers w
      LEFT JOIN marketplace_pending_outreach m
        ON (m.created_by = w.id OR COALESCE(m.converted_by, m.created_by) = w.id)
        AND m.deleted_at IS NULL
        AND (
          DATE(m.created_at) = d.day
          OR DATE(m.outreach_sent_at) = d.day
          OR DATE(m.reply_received_at) = d.day
          OR DATE(m.converted_at) = d.day
          OR DATE(m.updated_at) = d.day
        )
      GROUP BY d.day, w.id, w.name, w.email
      ORDER BY d.day DESC, "converted" DESC, "contacted" DESC, w.name ASC
    `),
    db.execute(sql`
      SELECT
        a.user_id AS "userId",
        COALESCE(a.metadata->>'nameAction', 'unknown') AS "action",
        COUNT(*)::int AS "count"
      FROM audit_logs a
      LEFT JOIN "user" u ON u.id = a.user_id
      WHERE a.entity = 'marketplace_name_review'
        AND a.created_at >= ${range.from}
        AND a.created_at < ${range.endExclusive}
        AND (u.role IN ('lead_gen', 'extension_worker') OR a.user_id IS NULL)
      GROUP BY a.user_id, COALESCE(a.metadata->>'nameAction', 'unknown')
    `),
    db.execute(sql`
      SELECT
        a.created_at AS "createdAt",
        a.user_id AS "userId",
        COALESCE(u.name, 'Unknown') AS "userName",
        COALESCE(a.metadata->>'nameAction', 'unknown') AS "action",
        a.metadata->>'sellerName' AS "sellerName",
        a.metadata->>'sellerProfileUrl' AS "sellerProfileUrl",
        a.metadata->>'firstName' AS "firstName",
        a.metadata->>'lastName' AS "lastName",
        a.metadata->>'originalNameScore' AS "originalNameScore"
      FROM audit_logs a
      LEFT JOIN "user" u ON u.id = a.user_id
      WHERE a.entity = 'marketplace_name_review'
        AND a.created_at >= ${range.from}
        AND a.created_at < ${range.endExclusive}
        AND (u.role IN ('lead_gen', 'extension_worker') OR a.user_id IS NULL)
      ORDER BY a.created_at DESC
      LIMIT 20
    `),
  ]);

  const actionByUser = new Map<string, {
    addFirstName: number;
    addSurname: number;
    addBoth: number;
    override: number;
    total: number;
  }>();

  const actionTotals = {
    addFirstName: 0,
    addSurname: 0,
    addBoth: 0,
    override: 0,
    total: 0,
  };

  for (const row of nameActionRows.rows as Array<{ userId: string | null; action: string; count: number }>) {
    const countValue = toNumber(row.count);
    const key = row.userId ?? "unknown";
    const current = actionByUser.get(key) ?? { addFirstName: 0, addSurname: 0, addBoth: 0, override: 0, total: 0 };
    if (row.action === "add_first_name") current.addFirstName += countValue;
    if (row.action === "add_surname") current.addSurname += countValue;
    if (row.action === "add_both") current.addBoth += countValue;
    if (row.action === "override") current.override += countValue;
    current.total += countValue;
    actionByUser.set(key, current);

    if (row.action === "add_first_name") actionTotals.addFirstName += countValue;
    if (row.action === "add_surname") actionTotals.addSurname += countValue;
    if (row.action === "add_both") actionTotals.addBoth += countValue;
    if (row.action === "override") actionTotals.override += countValue;
    actionTotals.total += countValue;
  }

  const baseWorkers = (workerRows.rows as LeadGenWorkerRow[]).map((row) => ({
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role,
    reviewed: toNumber(row.reviewed),
    contacted: toNumber(row.contacted),
    replies: toNumber(row.replies),
    converted: toNumber(row.converted),
    skipped: toNumber(row.skipped),
    duplicateBusiness: toNumber(row.duplicateBusiness),
    manualReview: toNumber(row.manualReview),
    avgQueueToConvertHours: row.avgQueueToConvertHours === null ? null : toNumber(row.avgQueueToConvertHours),
  }));

  const maxConverted = Math.max(1, ...baseWorkers.map((worker) => worker.converted));
  const maxContacted = Math.max(1, ...baseWorkers.map((worker) => worker.contacted));

  const workers = baseWorkers.map((worker) => {
    const nameActions = actionByUser.get(worker.userId) ?? { addFirstName: 0, addSurname: 0, addBoth: 0, override: 0, total: 0 };
    const closed = worker.converted + worker.skipped + worker.duplicateBusiness;
    const contactRate = pct(worker.contacted, worker.reviewed);
    const replyRate = pct(worker.replies, worker.contacted);
    const convertRate = pct(worker.converted, worker.contacted);
    const skipRate = pct(worker.skipped + worker.duplicateBusiness, Math.max(closed, worker.reviewed));
    const nameActionRate = pct(nameActions.total, Math.max(worker.reviewed, 1));
    const speedScore = worker.avgQueueToConvertHours === null
      ? 50
      : clamp(100 - (worker.avgQueueToConvertHours / 72) * 100);
    const qualityPenalty = clamp(skipRate * 0.35 + nameActionRate * 0.6 + nameActions.override * 4, 0, 30);
    const productivityScore = clamp(Math.round(
      (worker.converted / maxConverted) * 35
      + (worker.contacted / maxContacted) * 25
      + contactRate * 0.15
      + replyRate * 0.10
      + convertRate * 0.10
      + speedScore * 0.05
      - qualityPenalty
    ));

    return {
      ...worker,
      contactRate,
      replyRate,
      convertRate,
      skipRate,
      avgCompletedPerDay: Number((worker.converted / Math.max(range.days, 1)).toFixed(1)),
      nameActions,
      productivityScore,
    };
  });

  const totals = workers.reduce((acc, worker) => ({
    reviewed: acc.reviewed + worker.reviewed,
    contacted: acc.contacted + worker.contacted,
    replies: acc.replies + worker.replies,
    converted: acc.converted + worker.converted,
    skipped: acc.skipped + worker.skipped,
    duplicateBusiness: acc.duplicateBusiness + worker.duplicateBusiness,
    manualReview: acc.manualReview + worker.manualReview,
  }), {
    reviewed: 0,
    contacted: 0,
    replies: 0,
    converted: 0,
    skipped: 0,
    duplicateBusiness: 0,
    manualReview: 0,
  });

  const convertedWithTiming = baseWorkers.filter((worker) => worker.avgQueueToConvertHours !== null);
  const avgQueueToConvertHours = convertedWithTiming.length > 0
    ? Number((convertedWithTiming.reduce((sum, worker) => sum + (worker.avgQueueToConvertHours ?? 0), 0) / convertedWithTiming.length).toFixed(1))
    : null;

  const windowRow = (windowRows.rows[0] ?? {}) as { completedToday?: number; completed7d?: number; completed30d?: number };

  return {
    range: { from: range.from.toISOString(), to: range.endExclusive.toISOString(), days: range.days },
    windows: {
      completedToday: toNumber(windowRow.completedToday),
      completed7d: toNumber(windowRow.completed7d),
      completed30d: toNumber(windowRow.completed30d),
    },
    totals: {
      ...totals,
      contactRate: pct(totals.contacted, totals.reviewed),
      replyRate: pct(totals.replies, totals.contacted),
      convertRate: pct(totals.converted, totals.contacted),
      avgCompletedPerDay: Number((totals.converted / Math.max(range.days, 1)).toFixed(1)),
      avgQueueToConvertHours,
      nameActions: actionTotals,
    },
    daily: (dailyRows.rows as Array<{
      date: string;
      reviewed: number;
      contacted: number;
      replies: number;
      converted: number;
      skipped: number;
    }>).map((row) => ({
      date: String(row.date).slice(0, 10),
      reviewed: toNumber(row.reviewed),
      contacted: toNumber(row.contacted),
      replies: toNumber(row.replies),
      converted: toNumber(row.converted),
      skipped: toNumber(row.skipped),
    })),
    dailyByWorker: (dailyWorkerRows.rows as Array<{
      date: string;
      userId: string;
      name: string;
      email: string;
      reviewed: number;
      contacted: number;
      replies: number;
      converted: number;
      skipped: number;
      duplicateBusiness: number;
      manualReview: number;
    }>).map((row) => ({
      date: String(row.date).slice(0, 10),
      userId: row.userId,
      name: row.name,
      email: row.email,
      reviewed: toNumber(row.reviewed),
      contacted: toNumber(row.contacted),
      replies: toNumber(row.replies),
      converted: toNumber(row.converted),
      skipped: toNumber(row.skipped),
      duplicateBusiness: toNumber(row.duplicateBusiness),
      manualReview: toNumber(row.manualReview),
    })),
    workers: workers.sort((a, b) => b.productivityScore - a.productivityScore || b.converted - a.converted),
    recentNameActions: (recentNameActionRows.rows as Array<{
      createdAt: Date | string;
      userId: string | null;
      userName: string;
      action: string;
      sellerName: string | null;
      sellerProfileUrl: string | null;
      firstName: string | null;
      lastName: string | null;
      originalNameScore: string | null;
    }>).map((row) => ({
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
      userId: row.userId,
      userName: row.userName,
      action: row.action,
      sellerName: row.sellerName,
      sellerProfileUrl: row.sellerProfileUrl,
      firstName: row.firstName,
      lastName: row.lastName,
      originalNameScore: row.originalNameScore ? Number(row.originalNameScore) : null,
    })),
  };
}
