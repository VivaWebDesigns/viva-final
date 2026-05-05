import { http, HttpResponse } from "msw";

const EMPTY_LEADS     = { leads: [], total: 0, page: 1, pageSize: 20 };
const EMPTY_RECORDS   = { records: [], total: 0, page: 1, pageSize: 20 };
const EMPTY_ARTICLES  = { articles: [], total: 0, page: 1, pageSize: 20 };
const EMPTY_CLIENTS   = { clients: [], total: 0 };
const EMPTY_BOARD     = { stages: [], board: {}, contactMap: {}, companyMap: {} };
const CHAT_CHANNELS   = [
  { id: "general",    name: "General",    description: "Team announcements and conversation", unreadCount: 0 },
  { id: "sales",      name: "Sales",      description: "Sales pipeline and prospects", unreadCount: 0 },
  { id: "onboarding", name: "Onboarding", description: "Client onboarding coordination", unreadCount: 0 },
  { id: "dev",        name: "Dev",        description: "Technical and development topics", unreadCount: 0 },
];

const ADMIN_STATS = {
  users: 0, contacts: 0, articles: 0, categories: 0, integrations: 0, leads: 0,
};

const PIPELINE_STATS = { totalOpen: 0, totalValue: 0, byStage: [] };

const OVERVIEW = {
  leads:         { bySource: [], byStatus: [], conversion: { total: 0, converted: 0, rate: 0 }, trend: [] },
  pipeline:      { byStage: [], totalOpen: 0, totalValue: 0 },
  onboarding:    { total: 0, byStatus: { pending: 0, in_progress: 0, completed: 0, on_hold: 0 }, overdue: 0, avgCompletionDays: 0, checklist: { total: 0, completed: 0, rate: 0 } },
  notifications: { byType: [], total: 0, unread: 0 },
  wonLost:       { won: { count: 0, value: 0 }, lost: { count: 0, value: 0 }, winRate: 0 },
};

function pickResponse(pathname: string): unknown {
  if (pathname.includes("/crm/leads"))               return EMPTY_LEADS;
  if (pathname.includes("/crm/statuses"))            return [];
  if (pathname.includes("/crm/tags"))                return [];
  if (pathname.includes("/pipeline/board"))          return EMPTY_BOARD;
  if (pathname.includes("/pipeline/stages"))         return [];
  if (pathname.includes("/pipeline/stats"))          return PIPELINE_STATS;
  if (pathname.includes("/onboarding"))              return EMPTY_RECORDS;
  if (pathname.includes("/notifications/unread-count")) return { count: 0 };
  if (pathname.includes("/notifications"))           return { notifications: [], total: 0 };
  if (pathname.includes("/reports/overview"))        return OVERVIEW;
  if (pathname.includes("/docs/categories"))         return [];
  if (pathname.includes("/docs/articles"))           return EMPTY_ARTICLES;
  if (pathname.includes("/clients"))                 return EMPTY_CLIENTS;
  if (pathname.includes("/admin/users"))             return [];
  if (pathname.includes("/admin/stats"))             return ADMIN_STATS;
  if (pathname.includes("/chat/unread-count"))        return { count: 0 };
  if (pathname.includes("/chat/users"))               return [];
  if (pathname.includes("/chat/channels"))            return CHAT_CHANNELS;
  if (pathname.includes("/chat/messages"))            return [];
  if (pathname.includes("/chat/dm"))                  return [];
  if (pathname.includes("/chat/pinned"))              return [];
  if (pathname.includes("/tasks/due-today"))         return [];
  if (pathname.includes("/tasks"))                   return [];
  return {};
}

export const handlers = [
  http.get("/api/*", ({ request }) => {
    const { pathname } = new URL(request.url);
    return HttpResponse.json(pickResponse(pathname));
  }),
];
