import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Eye,
  Globe2,
  Link2,
  MessageSquareText,
  MousePointerClick,
  RefreshCw,
  Star,
  Target,
  Users,
} from "lucide-react";
import { apiRequest, STALE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@features/auth/useAuth";

type GoogleConnection = {
  provider: string;
  connected: boolean;
  accountEmail: string | null;
  externalAccountId: string | null;
  propertyId: string | null;
  locationId: string | null;
  locationTitle: string | null;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
};

type IntegrationStatus = {
  config: { oauthClientConfigured: boolean; encryptionConfigured: boolean };
  analytics: GoogleConnection | null;
  businessProfile: GoogleConnection | null;
};

type GaDashboard = {
  propertyId: string;
  days: number;
  summary: {
    activeUsers: number;
    sessions: number;
    screenPageViews: number;
    eventCount: number;
    keyEvents: number;
    confirmedLeads: number;
    reportViews: number;
    reportCtaClicks: number;
  };
  channels: Array<{ channel: string; sessions: number; activeUsers: number; keyEvents: number }>;
  landingPages: Array<{ landingPage: string; sessions: number; activeUsers: number; screenPageViews: number }>;
  events: Array<{ eventName: string; eventCount: number; keyEvents: number }>;
  leadTypes: Array<{ leadType: string; eventCount: number }>;
  reportCtas: Array<{ ctaType: string; eventCount: number }>;
  trend: Array<{ date: string; sessions: number; activeUsers: number; keyEvents: number }>;
  generatedAt: string;
};

type BusinessLocation = {
  accountId: string;
  accountName: string;
  locationId: string;
  title: string;
  websiteUri: string | null;
  locality: string | null;
};

type ReviewsData = {
  location: { id: string; title: string | null };
  summary: {
    total: number;
    averageRating: number;
    unreplied: number;
    ratingDistribution: Array<{ rating: number; count: number }>;
  };
  reviews: Array<{
    id: string;
    reviewerName: string | null;
    starRating: number;
    comment: string | null;
    reviewCreatedAt: string;
    replyComment: string | null;
  }>;
  lastSyncedAt: string | null;
  syncError: string | null;
};

function MetricCard({ label, value, icon: Icon, tone, detail }: {
  label: string;
  value: string | number;
  icon: typeof Users;
  tone: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm font-medium text-gray-600">{label}</p>
      {detail && <p className="mt-1 text-xs text-gray-400">{detail}</p>}
    </div>
  );
}

function Panel({ title, subtitle, children, action }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">{children}</div>;
}

function ConnectionCard({ title, description, connection, onConnect, disabled, icon: Icon }: {
  title: string;
  description: string;
  connection: GoogleConnection | null;
  onConnect: () => void;
  disabled: boolean;
  icon: typeof Globe2;
}) {
  const connected = !!connection;
  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center">
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${connected ? "bg-emerald-50" : "bg-gray-100"}`}>
          <Icon className={`h-5 w-5 ${connected ? "text-emerald-600" : "text-gray-500"}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {connected && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          </div>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
          {connection?.accountEmail && <p className="mt-2 text-xs text-gray-400">Connected as {connection.accountEmail}</p>}
          {connection?.lastError && <p className="mt-2 max-w-2xl text-xs text-amber-700">{connection.lastError}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={onConnect}
        disabled={disabled}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0"
      >
        <Link2 className="h-4 w-4" />
        {connected ? "Reconnect" : "Connect"}
      </button>
    </div>
  );
}

function formatGaDate(value: string) {
  if (!/^\d{8}$/.test(value)) return value;
  return `${value.slice(4, 6)}/${value.slice(6, 8)}`;
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AnalyticsPage() {
  const { toast } = useToast();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const [selectedLocation, setSelectedLocation] = useState("");

  const { data: status, isLoading: statusLoading } = useQuery<IntegrationStatus>({
    queryKey: ["/api/business-analytics/status"],
    staleTime: STALE.MEDIUM,
  });

  const analyticsConnected = !!status?.analytics;
  const businessConnected = !!status?.businessProfile;

  const { data: gaData, isLoading: gaLoading, error: gaError } = useQuery<GaDashboard>({
    queryKey: [`/api/business-analytics/ga4?days=${days}`],
    enabled: analyticsConnected,
    staleTime: STALE.SLOW,
  });

  const { data: locationsData, error: locationsError } = useQuery<{ locations: BusinessLocation[] }>({
    queryKey: ["/api/business-analytics/business/locations"],
    enabled: businessConnected,
    staleTime: STALE.SLOW,
  });

  const { data: reviewsData, isLoading: reviewsLoading, error: reviewsError } = useQuery<ReviewsData>({
    queryKey: ["/api/business-analytics/business/reviews"],
    enabled: businessConnected && !!status?.businessProfile?.locationId,
    staleTime: STALE.SLOW,
  });

  const connectMutation = useMutation({
    mutationFn: async (provider: "analytics" | "business_profile") => {
      const response = await fetch(`/api/business-analytics/oauth/start/${provider}`, { credentials: "include" });
      if (!response.ok) throw new Error((await response.json()).message || "Could not start Google connection");
      return response.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error: Error) => toast({ title: "Google connection failed", description: error.message, variant: "destructive" }),
  });

  const locationMutation = useMutation({
    mutationFn: async (location: BusinessLocation) => {
      const response = await apiRequest("POST", "/api/business-analytics/business/location", {
        accountId: location.accountId,
        locationId: location.locationId,
      });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/business-analytics/status"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/business-analytics/business/reviews"] });
      toast({ title: "Business Profile location selected" });
    },
    onError: (error: Error) => toast({ title: "Location selection failed", description: error.message, variant: "destructive" }),
  });

  const syncMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/business-analytics/business/sync")).json(),
    onSuccess: async (result: { synced: number }) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/business-analytics/business/reviews"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/business-analytics/status"] });
      toast({ title: "Google reviews refreshed", description: `${result.synced} reviews synchronized.` });
    },
    onError: (error: Error) => toast({ title: "Review sync failed", description: error.message, variant: "destructive" }),
  });

  const locations = locationsData?.locations ?? [];
  const trendMax = useMemo(() => Math.max(...(gaData?.trend.map((point) => point.sessions) ?? [1]), 1), [gaData]);
  const channelMax = useMemo(() => Math.max(...(gaData?.channels.map((row) => row.sessions) ?? [1]), 1), [gaData]);
  const configReady = !!status?.config.oauthClientConfigured && !!status?.config.encryptionConfigured;
  const canConnect = role === "admin" && configReady && !connectMutation.isPending;

  const handleLocationChange = (value: string) => {
    setSelectedLocation(value);
    const location = locations.find((item) => `${item.accountId}|${item.locationId}` === value);
    if (location) locationMutation.mutate(location);
  };

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Website performance, confirmed leads, scan-report engagement and Google reviews.</p>
        </div>
        <div className="flex rounded-lg bg-gray-100 p-1">
          {[7, 30, 90].map((value) => (
            <button
              key={value}
              onClick={() => setDays(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${days === value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {value} days
            </button>
          ))}
        </div>
      </header>

      {!statusLoading && !configReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Google Cloud credentials are not configured on the server yet. The dashboard is ready and will activate after Cloud setup is completed.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ConnectionCard
          title="Google Analytics 4"
          description="Traffic, acquisition, landing pages, leads and report engagement."
          connection={status?.analytics ?? null}
          onConnect={() => connectMutation.mutate("analytics")}
          disabled={!canConnect}
          icon={BarChart3}
        />
        <ConnectionCard
          title="Google Business Profile"
          description="Live review totals, ratings, review text and reply coverage."
          connection={status?.businessProfile ?? null}
          onConnect={() => connectMutation.mutate("business_profile")}
          disabled={!canConnect}
          icon={Globe2}
        />
      </div>

      {analyticsConnected ? (
        gaLoading ? (
          <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
        ) : gaError ? (
          <EmptyState>Google Analytics could not be loaded: {(gaError as Error).message}</EmptyState>
        ) : gaData ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-8">
              <MetricCard label="Active users" value={gaData.summary.activeUsers.toLocaleString()} icon={Users} tone="bg-blue-500" />
              <MetricCard label="Sessions" value={gaData.summary.sessions.toLocaleString()} icon={Activity} tone="bg-indigo-500" />
              <MetricCard label="Page views" value={gaData.summary.screenPageViews.toLocaleString()} icon={Eye} tone="bg-cyan-500" />
              <MetricCard label="Key events" value={gaData.summary.keyEvents.toLocaleString()} icon={Target} tone="bg-emerald-500" />
              <MetricCard label="Confirmed leads" value={gaData.summary.confirmedLeads.toLocaleString()} icon={CheckCircle2} tone="bg-teal-500" />
              <MetricCard label="Report views" value={gaData.summary.reportViews.toLocaleString()} icon={Globe2} tone="bg-violet-500" />
              <MetricCard label="Report CTA clicks" value={gaData.summary.reportCtaClicks.toLocaleString()} icon={MousePointerClick} tone="bg-fuchsia-500" />
              <MetricCard label="Events" value={gaData.summary.eventCount.toLocaleString()} icon={BarChart3} tone="bg-slate-500" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Panel title="Traffic trend" subtitle={`Sessions during the last ${days} days`}>
                {gaData.trend.length ? (
                  <div>
                    <div className="flex h-44 items-end gap-1">
                      {gaData.trend.map((point) => (
                        <div key={point.date} className="group relative flex h-full flex-1 items-end">
                          <div
                            className="w-full min-w-[3px] rounded-t bg-teal-500 transition-colors hover:bg-teal-600"
                            style={{ height: `${Math.max((point.sessions / trendMax) * 100, 2)}%` }}
                          />
                          <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                            {formatGaDate(point.date)}: {point.sessions} sessions
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-gray-400">
                      <span>{formatGaDate(String(gaData.trend[0]?.date))}</span>
                      <span>{formatGaDate(String(gaData.trend.at(-1)?.date))}</span>
                    </div>
                  </div>
                ) : <EmptyState>No traffic data is available for this range.</EmptyState>}
              </Panel>

              <Panel title="Traffic acquisition" subtitle="Sessions by default channel group">
                {gaData.channels.length ? (
                  <div className="space-y-3">
                    {gaData.channels.map((row) => (
                      <div key={row.channel} className="grid grid-cols-[130px_1fr_52px] items-center gap-3 text-sm">
                        <span className="truncate text-gray-600" title={row.channel}>{row.channel}</span>
                        <div className="h-5 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max((row.sessions / channelMax) * 100, 2)}%` }} />
                        </div>
                        <span className="text-right font-semibold text-gray-900">{row.sessions}</span>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState>No acquisition data is available.</EmptyState>}
              </Panel>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Panel title="Confirmed leads" subtitle="GA4 generate_lead events by lead type">
                {gaData.leadTypes.length ? (
                  <div className="grid grid-cols-2 gap-3">
                    {gaData.leadTypes.map((row) => (
                      <div key={row.leadType} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                        <p className="text-2xl font-bold text-gray-900">{row.eventCount}</p>
                        <p className="mt-1 text-sm text-gray-500">{formatLabel(row.leadType)}</p>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState>Lead-type reporting will populate after new confirmed leads arrive.</EmptyState>}
              </Panel>

              <Panel title="Scan report CTA activity" subtitle="Selections from personalized report pages">
                {gaData.reportCtas.length ? (
                  <div className="space-y-3">
                    {gaData.reportCtas.map((row) => (
                      <div key={row.ctaType} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
                        <span className="text-sm font-medium text-gray-700">{formatLabel(row.ctaType)}</span>
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-sm font-semibold text-violet-700">{row.eventCount}</span>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState>CTA activity will appear after a recipient uses a report action.</EmptyState>}
              </Panel>
            </div>

            <Panel title="Top landing pages" subtitle="Pages where sessions began">
              {gaData.landingPages.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                      <tr><th className="pb-3 font-medium">Landing page</th><th className="pb-3 text-right font-medium">Sessions</th><th className="pb-3 text-right font-medium">Users</th><th className="pb-3 text-right font-medium">Views</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {gaData.landingPages.map((row) => (
                        <tr key={row.landingPage}>
                          <td className="max-w-xl truncate py-3 pr-4 text-gray-700" title={row.landingPage}>{row.landingPage}</td>
                          <td className="py-3 text-right font-medium text-gray-900">{row.sessions}</td>
                          <td className="py-3 text-right text-gray-600">{row.activeUsers}</td>
                          <td className="py-3 text-right text-gray-600">{row.screenPageViews}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState>No landing-page data is available.</EmptyState>}
            </Panel>
          </>
        ) : null
      ) : (
        <EmptyState>Connect Google Analytics to activate website and lead reporting.</EmptyState>
      )}

      <Panel
        title="Google Business Profile reviews"
        subtitle="Synchronized from Google and stored locally for reliable dashboard performance."
        action={businessConnected && status?.businessProfile?.locationId ? (
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            Refresh reviews
          </button>
        ) : undefined}
      >
        {!businessConnected ? (
          <EmptyState>Connect Google Business Profile to retrieve reviews.</EmptyState>
        ) : status?.businessProfile?.status === "approval_required" ? (
          <EmptyState>Google Business Profile API approval is pending. Reviews will load automatically after Google enables the project quota.</EmptyState>
        ) : locationsError ? (
          <EmptyState>Google Business Profile access is temporarily unavailable. Please try again shortly.</EmptyState>
        ) : (
          <div className="space-y-6">
            {locations.length > 0 && (
              <div className="max-w-xl">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Business location</label>
                <select
                  value={selectedLocation || (status?.businessProfile?.externalAccountId && status.businessProfile.locationId
                    ? `${status.businessProfile.externalAccountId}|${status.businessProfile.locationId}` : "")}
                  onChange={(event) => handleLocationChange(event.target.value)}
                  disabled={locationMutation.isPending}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                >
                  <option value="">Choose a location</option>
                  {locations.map((location) => (
                    <option key={`${location.accountId}|${location.locationId}`} value={`${location.accountId}|${location.locationId}`}>
                      {location.title}{location.locality ? ` — ${location.locality}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {reviewsLoading ? (
              <div className="h-52 animate-pulse rounded-xl bg-gray-100" />
            ) : status?.businessProfile?.status === "approval_required" ? (
              <EmptyState>Google Business Profile API approval is pending. Reviews will load automatically after Google enables the project quota.</EmptyState>
            ) : reviewsError ? (
              <EmptyState>Reviews could not be loaded right now. Please try again shortly.</EmptyState>
            ) : reviewsData ? (
              <>
                {reviewsData.syncError && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Showing stored reviews. Google refresh error: {reviewsData.syncError}</div>}
                <div className="grid gap-4 sm:grid-cols-3">
                  <MetricCard label="Average rating" value={reviewsData.summary.averageRating.toFixed(1)} icon={Star} tone="bg-amber-500" detail={`${reviewsData.summary.total} total reviews`} />
                  <MetricCard label="Total reviews" value={reviewsData.summary.total} icon={MessageSquareText} tone="bg-blue-500" />
                  <MetricCard label="Awaiting a reply" value={reviewsData.summary.unreplied} icon={Target} tone="bg-rose-500" />
                </div>

                <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
                  <div className="rounded-lg border border-gray-100 p-4">
                    <h3 className="mb-4 text-sm font-semibold text-gray-900">Rating distribution</h3>
                    <div className="space-y-3">
                      {reviewsData.summary.ratingDistribution.map((row) => (
                        <div key={row.rating} className="grid grid-cols-[42px_1fr_34px] items-center gap-2 text-sm">
                          <span className="flex items-center gap-1 text-gray-600">{row.rating}<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /></span>
                          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${reviewsData.summary.total ? (row.count / reviewsData.summary.total) * 100 : 0}%` }} />
                          </div>
                          <span className="text-right text-gray-500">{row.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {reviewsData.reviews.slice(0, 12).map((review) => (
                      <article key={review.id} className="rounded-lg border border-gray-100 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-gray-900">{review.reviewerName || "Google reviewer"}</p>
                            <div className="mt-1 flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-3.5 w-3.5 ${star <= review.starRating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />)}
                            </div>
                          </div>
                          <time className="text-xs text-gray-400">{new Date(review.reviewCreatedAt).toLocaleDateString()}</time>
                        </div>
                        {review.comment && <p className="mt-3 text-sm leading-6 text-gray-600">{review.comment}</p>}
                        {review.replyComment ? (
                          <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600"><span className="font-medium text-gray-800">Viva replied:</span> {review.replyComment}</div>
                        ) : (
                          <p className="mt-3 text-xs font-medium text-rose-600">No owner reply</p>
                        )}
                      </article>
                    ))}
                    {reviewsData.reviews.length === 0 && <EmptyState>No reviews have been synchronized yet.</EmptyState>}
                  </div>
                </div>
              </>
            ) : (
              <EmptyState>Choose a Business Profile location to begin review synchronization.</EmptyState>
            )}
          </div>
        )}
      </Panel>

      <p className="flex items-center gap-1.5 text-xs text-gray-400">
        <ExternalLink className="h-3.5 w-3.5" />
        Google data is available only to authorized CRM users and is never exposed through browser-side API credentials.
      </p>
    </div>
  );
}
