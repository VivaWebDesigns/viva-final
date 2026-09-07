import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Eye,
  Globe2,
  Link2,
  MapPin,
  MessageSquareText,
  MonitorSmartphone,
  MousePointerClick,
  RefreshCw,
  Route,
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
  config: { oauthClientConfigured: boolean; encryptionConfigured: boolean; businessProfileEnabled: boolean };
  analytics: GoogleConnection | null;
  businessProfile: GoogleConnection | null;
};

type GaDashboard = {
  propertyId: string;
  days: number;
  dateRange: { startDate: string; endDate: string; label: string; days: number };
  summary: {
    activeUsers: number;
    newUsers: number;
    sessions: number;
    engagedSessions: number;
    engagementRate: number;
    averageSessionDuration: number;
    pagesPerSession: number;
    screenPageViews: number;
    eventCount: number;
    keyEvents: number;
    confirmedLeads: number;
  };
  channels: Array<{ channel: string; sessions: number; activeUsers: number; engagedSessions: number; engagementRate: number; keyEvents: number }>;
  landingPages: Array<{ landingPage: string; sessions: number; activeUsers: number; engagedSessions: number; screenPageViews: number; keyEvents: number }>;
  events: Array<{ eventName: string; eventCount: number; keyEvents: number }>;
  leadTypes: Array<{ leadType: string; eventCount: number }>;
  trend: Array<{ date: string; sessions: number; activeUsers: number; engagedSessions: number; engagementRate: number; keyEvents: number }>;
  devices: Array<{ device: string; sessions: number; activeUsers: number; engagedSessions: number; engagementRate: number; keyEvents: number }>;
  geography: Array<{ city: string; region: string; country: string; sessions: number; activeUsers: number; engagedSessions: number; engagementRate: number; averageSessionDuration: number; screenPageViews: number }>;
  flow: Array<{ channel: string; landingPage: string; sessions: number; activeUsers: number; engagedSessions: number; engagementRate: number; screenPageViews: number; confirmedLeads: number }>;
  content: Array<{ pagePath: string; activeUsers: number; screenPageViews: number; userEngagementDuration: number; eventCount: number; keyEvents: number }>;
  behavior: Array<{ eventName: string; eventCount: number; totalUsers: number; keyEvents: number }>;
  outreachTrend: Array<{ date: string; sends: number }>;
  timeZone: string | null;
  generatedAt: string;
};

type WebsiteActivityData = {
  dateRange: { startDate: string; endDate: string };
  detailedTrackingStartedAt: string | null;
  summary: {
    credibleSessions: number;
    meaningfulSessions: number;
    briefSessions: number;
    filteredSessions: number;
    automatedSessions: number;
    internalSessions: number;
  };
  sessions: Array<{
    id: string;
    startedAt: string;
    lastSeenAt: string;
    entryPath: string;
    referrerHost: string | null;
    source: string;
    city: string | null;
    region: string | null;
    country: string | null;
    device: string;
    pageViewCount: number;
    activeSeconds: number;
    actionCount: number;
    quality: "meaningful" | "brief" | "automated" | "internal";
    journey: Array<{ type: string; path: string; occurredAt: string }>;
  }>;
  emailSends: Array<{ sentAt: string }>;
  retentionDays: number;
  generatedAt: string;
};

type AnalyticsTab = "monitoring" | "overview" | "engagement" | "devices" | "geography" | "flow";
type RangeMode = "monitoring" | "1" | "7" | "30" | "90" | "custom";

const MONITORING_START_DATE = "2026-09-04";

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

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function secondsLabel(value: number) {
  const total = Math.max(0, Math.round(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function percentLabel(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function behaviorLabel(value: string) {
  const labels: Record<string, string> = {
    scroll: "Reached 90% of a page",
    click: "Outbound link click",
    form_start: "Started a form",
    form_submit: "Submitted a form",
    generate_lead: "Confirmed lead",
    file_download: "Downloaded a file",
    view_search_results: "Viewed search results",
    phone_click: "Tapped the phone number",
    email_click: "Tapped the email address",
    schedule_click: "Opened scheduling",
    scan_interest: "Opened or started a scan",
    results_interest: "Opened client results",
    contact_interest: "Opened the contact path",
    deep_scroll: "Read most of the page",
  };
  return labels[value] ?? formatLabel(value);
}

function trafficQuality(row: GaDashboard["geography"][number]) {
  if (row.engagedSessions === 0 && row.averageSessionDuration < 2 && row.screenPageViews <= row.sessions) {
    return "Very low activity";
  }
  return "Meaningful activity";
}

function pageLabel(path: string) {
  const labels: Record<string, string> = {
    "/": "Home",
    "/results": "Results",
    "/scan": "Free Visibility Scan",
    "/contact": "Contact",
    "/thanks": "Scan confirmation",
    "/contact-thanks": "Contact confirmation",
    "/privacy-policy": "Privacy Policy",
  };
  return labels[path] ?? path;
}

function easternDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function activityLocation(session: WebsiteActivityData["sessions"][number]) {
  return [session.city, session.region, session.country].filter(Boolean).join(", ") || "Location unavailable";
}

export default function AnalyticsPage() {
  const { toast } = useToast();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [rangeMode, setRangeMode] = useState<RangeMode>("monitoring");
  const [customStartDate, setCustomStartDate] = useState(MONITORING_START_DATE);
  const [customEndDate, setCustomEndDate] = useState(() => dateInputValue(new Date()));
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("monitoring");
  const [selectedLocation, setSelectedLocation] = useState("");

  const { data: status, isLoading: statusLoading } = useQuery<IntegrationStatus>({
    queryKey: ["/api/business-analytics/status"],
    staleTime: STALE.MEDIUM,
  });

  const analyticsConnected = !!status?.analytics;
  const businessProfileEnabled = !!status?.config.businessProfileEnabled;
  const businessConnected = businessProfileEnabled && !!status?.businessProfile;

  const customRangeValid = customStartDate !== "" && customEndDate !== "" && customStartDate <= customEndDate;
  const analyticsRangeQuery = rangeMode === "monitoring"
    ? `startDate=${MONITORING_START_DATE}&endDate=${encodeURIComponent(dateInputValue(new Date()))}`
    : rangeMode === "custom"
      ? `startDate=${encodeURIComponent(customStartDate)}&endDate=${encodeURIComponent(customEndDate)}`
      : `days=${rangeMode}`;
  const { data: gaData, isLoading: gaLoading, error: gaError } = useQuery<GaDashboard>({
    queryKey: [`/api/business-analytics/ga4?${analyticsRangeQuery}`],
    enabled: analyticsConnected && (rangeMode !== "custom" || customRangeValid),
    staleTime: STALE.SLOW,
  });
  const { data: activityData, isLoading: activityLoading, error: activityError } = useQuery<WebsiteActivityData>({
    queryKey: [`/api/business-analytics/website-activity?${analyticsRangeQuery}`],
    enabled: rangeMode !== "custom" || customRangeValid,
    staleTime: 30_000,
    refetchInterval: 60_000,
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
  const engagedTrendMax = useMemo(() => Math.max(...(gaData?.trend.map((point) => point.engagedSessions) ?? [1]), 1), [gaData]);
  const channelMax = useMemo(() => Math.max(...(gaData?.channels.map((row) => row.sessions) ?? [1]), 1), [gaData]);
  const sendsByDate = useMemo(() => new Map((gaData?.outreachTrend ?? []).map((point) => [point.date, point.sends])), [gaData]);
  const totalOutreachSends = useMemo(() => (gaData?.outreachTrend ?? []).reduce((total, point) => total + point.sends, 0), [gaData]);
  const includesToday = gaData?.dateRange.endDate === dateInputValue(new Date());
  const configReady = !!status?.config.oauthClientConfigured && !!status?.config.encryptionConfigured;
  const canConnect = role === "admin" && configReady && !connectMutation.isPending;
  const activityFeed = useMemo(() => {
    const sessions = (activityData?.sessions ?? [])
      .filter((session) => session.quality === "meaningful" || session.quality === "brief")
      .map((session) => ({ kind: "session" as const, occurredAt: session.startedAt, session }));
    const sends = (activityData?.emailSends ?? [])
      .map((send) => ({ kind: "email" as const, occurredAt: send.sentAt }));
    return [...sessions, ...sends].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
  }, [activityData]);
  const latestMeaningfulSession = useMemo(() => (activityData?.sessions ?? [])
    .filter((session) => session.quality === "meaningful")
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())[0], [activityData]);

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
          <p className="mt-1 text-sm text-gray-500">Website performance and confirmed leads.</p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <Link
            href="/admin/analytics/email-outreach"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f659e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0c527f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f659e] focus-visible:ring-offset-2 sm:w-auto"
          >
            <MessageSquareText className="h-4 w-4" />
            View Email Outreach
          </Link>
          <div className="flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1" aria-label="Analytics date range">
            <button
              type="button"
              onClick={() => setRangeMode("monitoring")}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${rangeMode === "monitoring" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Since Sep 4
            </button>
            {([1, 7, 30, 90] as const).map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setRangeMode(String(value) as RangeMode)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${rangeMode === String(value) ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {value === 1 ? "1 day" : `${value} days`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRangeMode("custom")}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${rangeMode === "custom" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Custom
            </button>
          </div>
          {rangeMode === "custom" && (
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              <label className="flex items-center gap-2 text-gray-600">
                From
                <input type="date" value={customStartDate} max={customEndDate || undefined} onChange={event => setCustomStartDate(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800" />
              </label>
              <label className="flex items-center gap-2 text-gray-600">
                To
                <input type="date" value={customEndDate} min={customStartDate || undefined} max={dateInputValue(new Date())} onChange={event => setCustomEndDate(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800" />
              </label>
              {!customRangeValid && <span className="w-full text-right text-xs text-red-600">Choose a valid start and end date.</span>}
            </div>
          )}
        </div>
      </header>

      {!statusLoading && !configReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Google Cloud credentials are not configured on the server yet. The dashboard is ready and will activate after Cloud setup is completed.
        </div>
      )}

      <div className={`grid gap-4 ${businessProfileEnabled ? "xl:grid-cols-2" : ""}`}>
        <ConnectionCard
          title="Google Analytics 4"
          description="Traffic, acquisition, landing pages and confirmed leads."
          connection={status?.analytics ?? null}
          onConnect={() => connectMutation.mutate("analytics")}
          disabled={!canConnect}
          icon={BarChart3}
        />
        {businessProfileEnabled && (
          <ConnectionCard
            title="Google Business Profile"
            description="Live review totals, ratings, review text and reply coverage."
            connection={status?.businessProfile ?? null}
            onConnect={() => connectMutation.mutate("business_profile")}
            disabled={!canConnect}
            icon={Globe2}
          />
        )}
      </div>

      {analyticsConnected ? (
        gaLoading ? (
          <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
        ) : gaError ? (
          <EmptyState>Google Analytics could not be loaded: {(gaError as Error).message}</EmptyState>
        ) : gaData ? (
          <div className="space-y-6">
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1.5" role="tablist" aria-label="Analytics views">
              {([
                ["monitoring", "Website Monitor", Activity],
                ["overview", "Acquisition", BarChart3],
                ["engagement", "Engagement", MousePointerClick],
                ["devices", "Devices", MonitorSmartphone],
                ["geography", "Geography", MapPin],
                ["flow", "Entry Paths", Route],
              ] as const).map(([key, label, Icon]) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === key}
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`inline-flex min-w-fit flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${activeTab === key ? "bg-[#0f659e] text-white shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "monitoring" && <>
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
                <p className="font-semibold">One timeline for outreach and website activity</p>
                <p className="mt-1 text-blue-800">
                  Credible traffic is treated as outreach-influenced. Sessions remain anonymous: timing and approximate location provide context, but never claim that a particular lead visited.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
                <MetricCard label="Emails recorded" value={(activityData?.emailSends.length ?? totalOutreachSends).toLocaleString()} icon={MessageSquareText} tone="bg-sky-600" detail="Shown beside traffic, not attributed" />
                <MetricCard label="Credible visits" value={activityData?.summary.credibleSessions ?? "—"} icon={Activity} tone="bg-indigo-500" detail="Detailed tracking only" />
                <MetricCard label="Meaningful visits" value={activityData?.summary.meaningfulSessions ?? "—"} icon={MousePointerClick} tone="bg-emerald-500" detail="10s active, 2+ pages, or an action" />
                <MetricCard label="Brief visits" value={activityData?.summary.briefSessions ?? "—"} icon={Eye} tone="bg-gray-500" detail="One page with under 10s active" />
                <MetricCard label="Filtered" value={activityData?.summary.filteredSessions ?? "—"} icon={Target} tone="bg-amber-500" detail="Internal and recognizable automation" />
              </div>

              <Panel
                title="What happened"
                subtitle="Email sends and anonymous website journeys in chronological order"
                action={<span className="whitespace-nowrap text-xs text-gray-500">Eastern time · refreshes every minute</span>}
              >
                {activityData && activityData.summary.credibleSessions > 0 && (
                  <div className="mb-4 rounded-xl bg-blue-950 px-4 py-3 text-sm leading-6 text-white">
                    <strong>{activityData.summary.credibleSessions} credible visit{activityData.summary.credibleSessions === 1 ? "" : "s"}</strong> since detailed tracking began: {activityData.summary.meaningfulSessions} meaningful and {activityData.summary.briefSessions} brief.
                    {latestMeaningfulSession && <> The latest meaningful visit was approximately {activityLocation(latestMeaningfulSession)}, viewed {latestMeaningfulSession.pageViewCount} page{latestMeaningfulSession.pageViewCount === 1 ? "" : "s"}, and was active for {secondsLabel(latestMeaningfulSession.activeSeconds)}.</>}
                  </div>
                )}
                {activityLoading ? <div className="h-48 animate-pulse rounded-lg bg-gray-100" /> : activityError ? (
                  <EmptyState>Detailed website activity could not be loaded: {(activityError as Error).message}</EmptyState>
                ) : activityFeed.length ? (
                  <div className="space-y-3">
                    {activityFeed.map((item, index) => item.kind === "email" ? (
                      <article key={`email-${item.occurredAt}-${index}`} className="flex gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500"><MessageSquareText className="h-4 w-4 text-white" /></div>
                        <div><p className="font-semibold text-amber-950">Outreach email recorded</p><p className="mt-1 text-sm text-amber-800">{easternDateTime(item.occurredAt)} · A timing marker only; no visitor identity is inferred.</p></div>
                      </article>
                    ) : (() => {
                      const session = item.session;
                      const meaningful = session.quality === "meaningful";
                      const arrival = session.source === "Direct" ? "Arrived directly" : `Arrived from ${session.source}`;
                      return (
                        <article key={`session-${session.id}-${item.occurredAt}`} className={`rounded-xl border p-4 ${meaningful ? "border-emerald-200 bg-emerald-50/50" : "border-gray-200 bg-gray-50"}`}>
                          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-gray-950">Anonymous session · approximately {activityLocation(session)}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${meaningful ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-700"}`}>{meaningful ? "Meaningful" : "Brief"}</span>
                              </div>
                              <p className="mt-1 text-sm text-gray-600">{arrival} on {pageLabel(session.entryPath)}.</p>
                            </div>
                            <time className="shrink-0 text-xs font-medium text-gray-500">{easternDateTime(session.startedAt)}</time>
                          </div>
                          {session.journey.length > 0 && (
                            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                              {session.journey.slice(0, 12).map((step, stepIndex) => (
                                <span key={`${step.type}-${step.occurredAt}-${stepIndex}`} className="contents">
                                  {stepIndex > 0 && <span className="text-gray-300">→</span>}
                                  <span className={`rounded-lg border px-2.5 py-1.5 ${step.type === "page_view" ? "border-blue-100 bg-white text-gray-800" : "border-emerald-200 bg-emerald-100 text-emerald-900"}`}>
                                    {step.type === "page_view" ? pageLabel(step.path) : behaviorLabel(step.type)}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="mt-4 text-xs text-gray-500">{session.pageViewCount} page{session.pageViewCount === 1 ? "" : "s"} · {secondsLabel(session.activeSeconds)} active · {session.actionCount} important action{session.actionCount === 1 ? "" : "s"} · {formatLabel(session.device)} · session {session.id}</p>
                        </article>
                      );
                    })())}
                  </div>
                ) : (
                  <EmptyState>No detailed public visits have been recorded yet. The first anonymous journey will appear here as soon as someone visits after deployment.</EmptyState>
                )}
                {activityData && activityData.summary.filteredSessions > 0 && (
                  <details className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                    <summary className="cursor-pointer font-semibold text-gray-800">{activityData.summary.filteredSessions} filtered session{activityData.summary.filteredSessions === 1 ? "" : "s"}</summary>
                    <p className="mt-2">{activityData.summary.internalSessions} internal · {activityData.summary.automatedSessions} recognizable automation. These do not appear in the primary timeline.</p>
                  </details>
                )}
                <p className="mt-4 text-xs leading-5 text-gray-500">Location is approximate and can be affected by mobile networks, VPNs, or corporate routing. Sessions are anonymous, detailed records are retained for {activityData?.retentionDays ?? 90} days, and no full IP address is stored.</p>
              </Panel>

              <Panel
                title="Historical context from Google Analytics"
                subtitle={`Aggregate traffic retained from September 4; individual journeys cannot be reconstructed · ${gaData.dateRange.label}`}
                action={<span className="whitespace-nowrap text-xs text-gray-500">GA timezone: {gaData.timeZone || "Not reported"}</span>}
              >
                <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-lg bg-gray-50 p-3"><p className="text-xl font-bold text-gray-900">{gaData.summary.sessions}</p><p className="text-xs text-gray-500">aggregate sessions</p></div>
                  <div className="rounded-lg bg-gray-50 p-3"><p className="text-xl font-bold text-gray-900">{gaData.summary.engagedSessions}</p><p className="text-xs text-gray-500">GA engaged sessions</p></div>
                  <div className="rounded-lg bg-gray-50 p-3"><p className="text-xl font-bold text-gray-900">{gaData.summary.screenPageViews}</p><p className="text-xs text-gray-500">page views</p></div>
                  <div className="rounded-lg bg-gray-50 p-3"><p className="text-xl font-bold text-gray-900">{gaData.geography[0]?.city || "—"}</p><p className="text-xs text-gray-500">top reported city</p></div>
                </div>
                {includesToday && <p className="mb-4 text-xs text-amber-700">Today remains preliminary while Google finishes processing engagement.</p>}
                {gaData.trend.length ? (
                  <div className="overflow-x-auto pb-2">
                    <div className="flex h-44 min-w-[680px] items-end gap-1.5" style={{ width: `${Math.max(gaData.trend.length * 48, 680)}px` }}>
                      {gaData.trend.map((point) => {
                        const sends = sendsByDate.get(String(point.date)) ?? 0;
                        return <div key={point.date} className="group relative flex h-full min-w-10 flex-1 flex-col justify-end">
                          {sends > 0 && <span className="mb-1 self-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">{sends} sent</span>}
                          <div className="flex h-28 items-end justify-center gap-1"><div className="w-4 rounded-t bg-indigo-500" style={{ height: `${Math.max((point.sessions / trendMax) * 100, 2)}%` }} /></div>
                          <span className="mt-2 text-center text-[10px] text-gray-500">{formatGaDate(String(point.date))}</span>
                          <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">{point.sessions} sessions · {point.engagedSessions} engaged · {sends} emails</div>
                        </div>;
                      })}
                    </div>
                  </div>
                ) : <EmptyState>No aggregate traffic is available for this range.</EmptyState>}
              </Panel>
            </>}

            {activeTab === "overview" && <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <MetricCard label="Active users" value={gaData.summary.activeUsers.toLocaleString()} icon={Users} tone="bg-blue-500" detail={`${gaData.summary.newUsers.toLocaleString()} new users`} />
                <MetricCard label="Sessions" value={gaData.summary.sessions.toLocaleString()} icon={Activity} tone="bg-indigo-500" detail={gaData.dateRange.label} />
                <MetricCard label="Page views" value={gaData.summary.screenPageViews.toLocaleString()} icon={Eye} tone="bg-cyan-500" detail={`${gaData.summary.pagesPerSession} per session`} />
                <MetricCard label="Confirmed leads" value={gaData.summary.confirmedLeads.toLocaleString()} icon={CheckCircle2} tone="bg-teal-500" detail={`${gaData.summary.keyEvents.toLocaleString()} total key events`} />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Panel title="Traffic trend" subtitle={`Sessions · ${gaData.dateRange.label}`}>
                  {gaData.trend.length ? (
                    <div>
                      <div className="flex h-44 items-end gap-1">
                        {gaData.trend.map((point) => (
                          <div key={point.date} className="group relative flex h-full flex-1 items-end">
                            <div className="w-full min-w-[3px] rounded-t bg-teal-500 transition-colors hover:bg-teal-600" style={{ height: `${Math.max((point.sessions / trendMax) * 100, 2)}%` }} />
                            <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                              {formatGaDate(point.date)}: {point.sessions} sessions
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex justify-between text-xs text-gray-400"><span>{formatGaDate(String(gaData.trend[0]?.date))}</span><span>{formatGaDate(String(gaData.trend.at(-1)?.date))}</span></div>
                    </div>
                  ) : <EmptyState>No traffic data is available for this range.</EmptyState>}
                </Panel>

                <Panel title="Traffic acquisition" subtitle="Where website sessions came from">
                  {gaData.channels.length ? (
                    <div className="space-y-3">
                      {gaData.channels.map((row) => (
                        <div key={row.channel} className="grid grid-cols-[130px_1fr_52px] items-center gap-3 text-sm">
                          <span className="truncate text-gray-600" title={row.channel}>{row.channel}</span>
                          <div className="h-5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max((row.sessions / channelMax) * 100, 2)}%` }} /></div>
                          <span className="text-right font-semibold text-gray-900">{row.sessions}</span>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState>No acquisition data is available.</EmptyState>}
                </Panel>
              </div>
            </>}

            {activeTab === "engagement" && <>
              {rangeMode === "1" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Today’s engagement data may still be processing in Google Analytics.
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <MetricCard label="Engaged sessions" value={gaData.summary.engagedSessions.toLocaleString()} icon={MousePointerClick} tone="bg-blue-500" />
                <MetricCard label="Engagement rate" value={percentLabel(gaData.summary.engagementRate)} icon={Target} tone="bg-emerald-500" />
                <MetricCard label="Average session duration" value={secondsLabel(gaData.summary.averageSessionDuration)} icon={Activity} tone="bg-indigo-500" detail="Average across all sessions" />
                <MetricCard label="Pages per session" value={gaData.summary.pagesPerSession} icon={Eye} tone="bg-cyan-500" />
              </div>
              <Panel title="Engagement trend" subtitle={`Engaged sessions · ${gaData.dateRange.label}`}>
                {gaData.trend.length ? (
                  <div>
                    <div className="flex h-52 items-end gap-1">
                      {gaData.trend.map(point => (
                        <div key={point.date} className="group relative flex h-full flex-1 items-end">
                          <div className="w-full min-w-[3px] rounded-t bg-blue-500 transition-colors hover:bg-blue-600" style={{ height: `${Math.max((point.engagedSessions / engagedTrendMax) * 100, 2)}%` }} />
                          <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">{formatGaDate(point.date)}: {point.engagedSessions} engaged · {percentLabel(point.engagementRate)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-gray-400"><span>{formatGaDate(String(gaData.trend[0]?.date))}</span><span>{formatGaDate(String(gaData.trend.at(-1)?.date))}</span></div>
                  </div>
                ) : <EmptyState>No engagement data is available for this range.</EmptyState>}
              </Panel>
            </>}

            {activeTab === "devices" && <Panel title="Devices" subtitle="How visitors use the website">
              {gaData.devices.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400"><tr><th className="pb-3 font-medium">Device</th><th className="pb-3 text-right font-medium">Sessions</th><th className="pb-3 text-right font-medium">Users</th><th className="pb-3 text-right font-medium">Engaged</th><th className="pb-3 text-right font-medium">Rate</th></tr></thead>
                <tbody className="divide-y divide-gray-100">{gaData.devices.map(row => <tr key={row.device}><td className="py-4 font-semibold capitalize text-gray-800">{row.device}</td><td className="py-4 text-right text-gray-700">{row.sessions}</td><td className="py-4 text-right text-gray-700">{row.activeUsers}</td><td className="py-4 text-right text-gray-700">{row.engagedSessions}</td><td className="py-4 text-right font-semibold text-gray-900">{percentLabel(row.engagementRate)}</td></tr>)}</tbody>
              </table></div> : <EmptyState>No device data is available for this range.</EmptyState>}
            </Panel>}

            {activeTab === "geography" && <Panel title="Visitor geography" subtitle="Aggregated GA4 location data; individual visitors are not identified">
              {gaData.geography.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400"><tr><th className="pb-3 font-medium">City</th><th className="pb-3 font-medium">Region</th><th className="pb-3 font-medium">Country</th><th className="pb-3 text-right font-medium">Sessions</th><th className="pb-3 text-right font-medium">Engagement</th></tr></thead>
                <tbody className="divide-y divide-gray-100">{gaData.geography.map((row, index) => <tr key={`${row.city}-${row.region}-${row.country}-${index}`}><td className="py-4 font-semibold text-gray-800">{row.city}</td><td className="py-4 text-gray-600">{row.region}</td><td className="py-4 text-gray-600">{row.country}</td><td className="py-4 text-right text-gray-700">{row.sessions}</td><td className="py-4 text-right font-semibold text-gray-900">{percentLabel(row.engagementRate)}</td></tr>)}</tbody>
              </table></div> : <EmptyState>No geographic data is available for this range.</EmptyState>}
            </Panel>}

            {activeTab === "flow" && <Panel title="Entry paths" subtitle="Return path → first website page → engagement → confirmed lead">
              {gaData.flow.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400"><tr><th className="pb-3 font-medium">Channel</th><th className="pb-3 font-medium">Landing page</th><th className="pb-3 text-right font-medium">Sessions</th><th className="pb-3 text-right font-medium">Engaged</th><th className="pb-3 text-right font-medium">Page views</th><th className="pb-3 text-right font-medium">Leads</th></tr></thead>
                <tbody className="divide-y divide-gray-100">{gaData.flow.map((row, index) => <tr key={`${row.channel}-${row.landingPage}-${index}`}><td className="py-4 pr-4 font-semibold text-gray-800">{row.channel}</td><td className="max-w-md truncate py-4 pr-4 text-gray-600" title={row.landingPage}>{row.landingPage}</td><td className="py-4 text-right text-gray-700">{row.sessions}</td><td className="py-4 text-right text-gray-700">{row.engagedSessions}</td><td className="py-4 text-right text-gray-700">{row.screenPageViews}</td><td className="py-4 text-right font-semibold text-teal-700">{row.confirmedLeads}</td></tr>)}</tbody>
              </table></div> : <EmptyState>No traffic-flow data is available for this range.</EmptyState>}
              <p className="mt-4 text-xs text-gray-500">For this monitoring model, both Direct and Organic Search can be outreach-influenced. The channel describes how someone returned, not necessarily what first created awareness.</p>
            </Panel>}
          </div>
        ) : null
      ) : (
        <EmptyState>Connect Google Analytics to activate website and lead reporting.</EmptyState>
      )}

      {businessProfileEnabled && <Panel
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
      </Panel>}

      <p className="flex items-center gap-1.5 text-xs text-gray-400">
        <ExternalLink className="h-3.5 w-3.5" />
        Google data is available only to authorized CRM users and is never exposed through browser-side API credentials.
      </p>
    </div>
  );
}
