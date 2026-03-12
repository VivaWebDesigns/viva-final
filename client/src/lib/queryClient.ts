import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Named freshness tiers for per-query staleTime overrides.
// The global default (STALE.FAST = 1 min) provides a safe fallback for all
// operational/admin views. Stale data risk is bounded to one polling interval
// even when a mutation invalidation is missed. Queries on truly static config
// domains (stages, statuses, tags, templates) that are only mutated by explicit
// admin actions should declare staleTime: STALE.NEVER explicitly at the call site.
export const STALE = {
  NEVER:    Infinity,   // static config: stages, statuses, tags, templates
  SLOW:   5 * 60_000,   // 5 min  — reports, aggregated analytics
  MEDIUM: 2 * 60_000,   // 2 min  — dashboard/onboarding overview stats
  FAST:       60_000,   // 1 min  — CRM lists, pipeline, clients (global default)
  REALTIME:   30_000,   // 30 s   — notifications, unread counts
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: STALE.FAST,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
