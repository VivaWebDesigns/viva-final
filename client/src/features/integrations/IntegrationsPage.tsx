import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  CreditCard, Mail, Brain, Cloud, ExternalLink, CheckCircle2, XCircle,
  Clock, ChevronDown, ChevronUp, Zap, FlaskConical, AlertCircle,
  Shield, Activity, Info, Loader2, Settings2, Eye, EyeOff, Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import type { IntegrationRecord } from "@shared/schema";
import { useAdminLang } from "@/i18n/LanguageContext";

interface ProviderHealth {
  provider: string;
  configured: boolean;
  missingVars: string[];
  presentVars: string[];
  status: "ready" | "partial" | "not_configured";
  featureFlag: "active" | "planned" | "scaffold";
  notes: string;
  usedBy: string[];
}

interface TestResult {
  success: boolean;
  message: string;
  details?: string;
}

interface StripeMaskedStatus {
  configured: boolean;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  hasPublishableKey: boolean;
  mode: "live" | "test" | "unknown";
  source: "database" | "environment" | "none";
  secretKeyMasked: string | null;
  webhookSecretMasked: string | null;
  publishableKeyMasked: string | null;
}

const PROVIDER_ICONS: Record<string, any> = {
  stripe: CreditCard,
  mailgun: Mail,
  openai: Brain,
  "cloudflare-r2": Cloud,
};

const PROVIDER_COLORS: Record<string, string> = {
  stripe: "bg-purple-500",
  mailgun: "bg-red-500",
  openai: "bg-emerald-600",
  "cloudflare-r2": "bg-orange-500",
};

const FLAG_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  active: { label: "Active", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: Zap },
  planned: { label: "Planned", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
  scaffold: { label: "Scaffolded", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: FlaskConical },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  ready: { label: "Configured", color: "text-green-600", icon: CheckCircle2 },
  partial: { label: "Partial", color: "text-amber-600", icon: AlertCircle },
  not_configured: { label: "Not Configured", color: "text-gray-500", icon: XCircle },
};

const stripeConfigSchema = z.object({
  secretKey: z.string().min(1, "Required").regex(/^sk_(live|test)_/, "Must start with sk_live_ or sk_test_"),
  webhookSecret: z.string().startsWith("whsec_", "Must start with whsec_").or(z.literal("")).optional(),
  publishableKey: z.string().startsWith("pk_", "Must start with pk_").or(z.literal("")).optional(),
});

function MaskedField({ label, masked, placeholder }: { label: string; masked: string | null; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        <Shield className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="text-xs font-mono text-gray-700 truncate">
          {masked ?? <span className="text-gray-400 italic">{placeholder ?? "Not set"}</span>}
        </span>
      </div>
    </div>
  );
}

function StripeConfigDialog({
  open,
  onClose,
  stripeStatus,
}: {
  open: boolean;
  onClose: () => void;
  stripeStatus: StripeMaskedStatus | undefined;
}) {
  const { toast } = useToast();
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const form = useForm<z.infer<typeof stripeConfigSchema>>({
    resolver: zodResolver(stripeConfigSchema),
    defaultValues: { secretKey: "", webhookSecret: "", publishableKey: "" },
  });

  const configureMutation = useMutation({
    mutationFn: async (values: z.infer<typeof stripeConfigSchema>) => {
      const res = await apiRequest("POST", "/api/integrations/stripe/configure", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/stripe/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/health"] });
      toast({ title: "Stripe configured", description: "Credentials saved and verified." });
      form.reset();
      onClose();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Configuration failed", description: err.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg" aria-describedby="stripe-config-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-500" />
            Configure Stripe
          </DialogTitle>
          <DialogDescription id="stripe-config-desc">
            Enter your Stripe API credentials. These are stored securely in the database and take precedence over environment variables.
          </DialogDescription>
        </DialogHeader>

        {stripeStatus?.configured && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Current Configuration
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium ${
                stripeStatus.mode === "live"
                  ? "bg-green-100 text-green-700"
                  : stripeStatus.mode === "test"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-500"
              }`}>
                {stripeStatus.mode === "live" ? "Live Mode" : stripeStatus.mode === "test" ? "Test Mode" : "Unknown"}
              </span>
            </p>
            <MaskedField label="Secret Key" masked={stripeStatus.secretKeyMasked} />
            {stripeStatus.hasWebhookSecret && (
              <MaskedField label="Webhook Secret" masked={stripeStatus.webhookSecretMasked} />
            )}
            {stripeStatus.hasPublishableKey && (
              <MaskedField label="Publishable Key" masked={stripeStatus.publishableKeyMasked} />
            )}
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <Database className="w-3 h-3" />
              Source: {stripeStatus.source === "database" ? "Stored in database" : "Environment variable"}
            </p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => configureMutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="secretKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secret Key <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showSecretKey ? "text" : "password"}
                        placeholder="sk_test_... or sk_live_..."
                        className="pr-10 font-mono text-sm"
                        data-testid="input-stripe-secret-key"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        data-testid="button-toggle-secret-key"
                      >
                        {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    From Stripe Dashboard → Developers → API Keys
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="webhookSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Webhook Secret <span className="text-gray-400 font-normal text-xs">(optional)</span></FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showWebhookSecret ? "text" : "password"}
                        placeholder="whsec_..."
                        className="pr-10 font-mono text-sm"
                        data-testid="input-stripe-webhook-secret"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        data-testid="button-toggle-webhook-secret"
                      >
                        {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    Required for webhook signature verification. Stripe Dashboard → Webhooks → Signing Secret
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="publishableKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Publishable Key <span className="text-gray-400 font-normal text-xs">(optional)</span></FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="text"
                      placeholder="pk_test_... or pk_live_..."
                      className="font-mono text-sm"
                      data-testid="input-stripe-publishable-key"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    Needed for future Stripe.js / Elements frontend features
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-stripe-config">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={configureMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                data-testid="button-save-stripe-config"
              >
                {configureMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                Save Credentials
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EnvVarBadge({ name, isPresent }: { name: string; isPresent: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs" data-testid={`env-var-${name}`}>
      {isPresent ? (
        <Shield className="w-3 h-3 text-green-500 flex-shrink-0" />
      ) : (
        <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
      )}
      <span className={`font-mono ${isPresent ? "text-green-700" : "text-red-600"}`}>{name}</span>
      <span className={`text-[10px] ${isPresent ? "text-green-500" : "text-red-400"}`}>
        {isPresent ? "set" : "missing"}
      </span>
    </div>
  );
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const { t } = useAdminLang();
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [stripeConfigOpen, setStripeConfigOpen] = useState(false);

  const { data: integrations = [], isLoading } = useQuery<IntegrationRecord[]>({
    queryKey: ["/api/integrations"],
  });

  const { data: healthMap = {}, isLoading: healthLoading } = useQuery<Record<string, ProviderHealth>>({
    queryKey: ["/api/integrations/health"],
  });

  const { data: stripeStatus } = useQuery<StripeMaskedStatus>({
    queryKey: ["/api/integrations/stripe/status"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await apiRequest("PUT", `/api/integrations/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (provider: string) => {
      setTestingProvider(provider);
      const res = await apiRequest("POST", `/api/integrations/${provider}/test`);
      return res.json() as Promise<TestResult>;
    },
    onSuccess: (result, provider) => {
      setTestingProvider(null);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/stripe/status"] });
      toast({
        title: result.success ? "Test Passed" : "Test Failed",
        description: result.message + (result.details ? ` — ${result.details}` : ""),
        variant: result.success ? "default" : "destructive",
      });
    },
    onError: (err: any) => {
      setTestingProvider(null);
      toast({ title: "Test Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleExpand = (provider: string) => {
    setExpandedProvider(expandedProvider === provider ? null : provider);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="text-integrations-title">Integrations</h1>
        <p className="text-gray-500 text-sm mt-1">Manage third-party service connections and configuration</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: integrations.length, color: "text-gray-900", loading: isLoading },
          { label: "Configured", value: Object.values(healthMap).filter((h) => h.status === "ready").length, color: "text-green-600", loading: healthLoading },
          { label: "Active", value: Object.values(healthMap).filter((h) => h.featureFlag === "active").length, color: "text-blue-600", loading: healthLoading },
          { label: "Enabled", value: integrations.filter((i) => i.enabled).length, color: "text-teal-600", loading: isLoading },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center" data-testid={`stat-integration-${stat.label.toLowerCase()}`}>
            {stat.loading ? (
              <div className="h-7 w-8 bg-gray-100 rounded animate-pulse mx-auto" />
            ) : (
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            )}
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <StripeConfigDialog
        open={stripeConfigOpen}
        onClose={() => setStripeConfigOpen(false)}
        stripeStatus={stripeStatus}
      />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration, i) => {
            const settings = (integration.settings || {}) as any;
            const Icon = PROVIDER_ICONS[integration.provider] || Cloud;
            const color = PROVIDER_COLORS[integration.provider] || "bg-gray-500";
            const health = healthMap[integration.provider];
            const isExpanded = expandedProvider === integration.provider;
            const isTesting = testingProvider === integration.provider;
            const isStripe = integration.provider === "stripe";

            const stripeIsConfigured = isStripe && stripeStatus?.configured;
            const stripeIsMissing = isStripe && !stripeIsConfigured;

            const statusCfg = healthLoading
              ? { label: "Checking...", color: "text-gray-400", icon: Loader2 }
              : isStripe && stripeStatus?.configured
              ? STATUS_CONFIG["ready"]
              : health ? STATUS_CONFIG[health.status] : STATUS_CONFIG.not_configured;

            const flagCfg = health ? FLAG_CONFIG[health.featureFlag] : (settings.featureFlag ? FLAG_CONFIG[settings.featureFlag] : FLAG_CONFIG.planned);
            const StatusIcon = statusCfg.icon;
            const FlagIcon = flagCfg.icon;

            const allVars = [...(settings.requiredEnvVars || []), ...(settings.optionalEnvVars || [])];
            const presentSet = new Set(health?.presentVars || []);

            return (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                data-testid={`card-integration-${integration.provider}`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{settings.name || integration.provider}</h3>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${flagCfg.bg} ${flagCfg.color}`} data-testid={`badge-flag-${integration.provider}`}>
                            <FlagIcon className="w-3 h-3" />
                            {flagCfg.label}
                          </span>
                          {isStripe && stripeStatus?.configured && (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                              stripeStatus.mode === "live"
                                ? "bg-green-50 border-green-200 text-green-700"
                                : "bg-amber-50 border-amber-200 text-amber-700"
                            }`} data-testid="badge-stripe-mode">
                              {stripeStatus.mode === "live" ? "Live" : stripeStatus.mode === "test" ? "Test" : "?"}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{settings.description || ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon className={`w-4 h-4 ${statusCfg.color}`} />
                        <span className={`text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                      </div>
                      <Switch
                        checked={integration.enabled}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: integration.id, enabled: checked })
                        }
                        data-testid={`switch-${integration.provider}`}
                      />
                    </div>
                  </div>

                  {isStripe && stripeStatus?.configured && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5" data-testid="stripe-secret-key-status">
                        <Shield className="w-3 h-3 text-green-500" />
                        <span className="font-mono">{stripeStatus.secretKeyMasked}</span>
                      </div>
                      {stripeStatus.hasWebhookSecret && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5" data-testid="stripe-webhook-status">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          <span>Webhook ready</span>
                        </div>
                      )}
                      {stripeStatus.source === "database" && (
                        <div className="flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5">
                          <Database className="w-3 h-3" />
                          <span>DB config</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {integration.lastTested && (
                      <div className="flex items-center gap-1 text-xs text-gray-500" data-testid={`last-tested-${integration.provider}`}>
                        <Clock className="w-3 h-3" />
                        Last tested: {new Date(integration.lastTested).toLocaleString()}
                      </div>
                    )}
                    {health?.usedBy && health.usedBy.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Activity className="w-3 h-3" />
                        {health.usedBy.length} feature{health.usedBy.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExpand(integration.provider)}
                      data-testid={`button-expand-${integration.provider}`}
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                      Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testMutation.mutate(integration.provider)}
                      disabled={isTesting}
                      data-testid={`button-test-${integration.provider}`}
                    >
                      {isTesting ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <FlaskConical className="w-3 h-3 mr-1" />
                      )}
                      {isTesting ? "Testing..." : "Test Connection"}
                    </Button>
                    {isStripe && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStripeConfigOpen(true)}
                        className="border-purple-200 text-purple-700 hover:bg-purple-50"
                        data-testid="button-configure-stripe"
                      >
                        <Settings2 className="w-3 h-3 mr-1" />
                        {stripeIsConfigured ? "Update Credentials" : "Configure Stripe"}
                      </Button>
                    )}
                    {settings.docsUrl && (
                      <Button variant="outline" size="sm" asChild data-testid={`button-docs-${integration.provider}`}>
                        <a href={settings.docsUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Docs
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-gray-100 p-5 bg-gray-50/50 space-y-5">
                        {isStripe && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                              <CreditCard className="w-4 h-4 text-purple-500" />
                              Stripe Configuration
                            </h4>
                            {stripeStatus?.configured ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <MaskedField label="Secret Key" masked={stripeStatus.secretKeyMasked} />
                                  {stripeStatus.hasWebhookSecret && (
                                    <MaskedField label="Webhook Secret" masked={stripeStatus.webhookSecretMasked} />
                                  )}
                                  {stripeStatus.hasPublishableKey && (
                                    <MaskedField label="Publishable Key" masked={stripeStatus.publishableKeyMasked} />
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                                  <Database className="w-3 h-3" />
                                  Source: {stripeStatus.source === "database" ? "Stored in database (takes precedence)" : "Environment variable"}
                                  {" · "}
                                  Mode: {stripeStatus.mode === "live" ? "🟢 Live" : stripeStatus.mode === "test" ? "🟡 Test" : "Unknown"}
                                </p>
                              </div>
                            ) : (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-xs text-amber-700 flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                  Stripe is not configured. Click <strong>Configure Stripe</strong> above to add your credentials.
                                </p>
                                <p className="text-[10px] text-amber-600 mt-1.5">
                                  Alternatively, set <code className="font-mono">STRIPE_SECRET_KEY</code> in your environment variables.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {!isStripe && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                              <Shield className="w-4 h-4" />
                              Environment Variables
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {allVars.map((v: string) => (
                                <EnvVarBadge key={v} name={v} isPresent={presentSet.has(v)} />
                              ))}
                            </div>
                            {settings.optionalEnvVars?.length > 0 && (
                              <p className="text-[10px] text-gray-400 mt-1.5">
                                Optional: {settings.optionalEnvVars.join(", ")}
                              </p>
                            )}
                          </div>
                        )}

                        {isStripe && allVars.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                              <Shield className="w-4 h-4" />
                              Environment Variables
                              <span className="text-[10px] font-normal text-gray-400">(fallback if no DB config)</span>
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {allVars.map((v: string) => (
                                <EnvVarBadge key={v} name={v} isPresent={presentSet.has(v)} />
                              ))}
                            </div>
                          </div>
                        )}

                        {health?.usedBy && health.usedBy.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                              <Activity className="w-4 h-4" />
                              Used By
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                              {health.usedBy.map((feature) => {
                                const isPlanned = feature.includes("planned");
                                return (
                                  <span
                                    key={feature}
                                    className={`text-xs px-2 py-1 rounded-lg border ${
                                      isPlanned
                                        ? "bg-gray-50 text-gray-500 border-gray-200"
                                        : "bg-teal-50 text-teal-700 border-teal-200"
                                    }`}
                                  >
                                    {feature}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {settings.operationalNotes && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                              <Info className="w-4 h-4" />
                              Operational Notes
                            </h4>
                            <p className="text-sm text-gray-600 leading-relaxed">{settings.operationalNotes}</p>
                          </div>
                        )}

                        {settings.setupInstructions && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Setup Instructions</h4>
                            <ol className="text-sm text-gray-600 space-y-1.5 list-decimal list-inside">
                              {(settings.setupInstructions as string[]).map((step, idx) => (
                                <li key={idx}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
