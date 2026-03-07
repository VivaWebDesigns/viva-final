import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  CreditCard, Mail, Brain, Cloud, ExternalLink, CheckCircle2, XCircle,
  Clock, ChevronDown, ChevronUp, Zap, FlaskConical, AlertCircle,
  Shield, Activity, Info, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { IntegrationRecord } from "@shared/schema";

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
  active: { label: "Active in Production", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: Zap },
  planned: { label: "Planned", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
  scaffold: { label: "Scaffolded", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: FlaskConical },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  ready: { label: "Configured", color: "text-green-600", icon: CheckCircle2 },
  partial: { label: "Partially Configured", color: "text-amber-600", icon: AlertCircle },
  not_configured: { label: "Not Configured", color: "text-gray-500", icon: XCircle },
};

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
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  const { data: integrations = [], isLoading } = useQuery<IntegrationRecord[]>({
    queryKey: ["/api/integrations"],
  });

  const { data: healthMap = {}, isLoading: healthLoading } = useQuery<Record<string, ProviderHealth>>({
    queryKey: ["/api/integrations/health"],
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
            const statusCfg = healthLoading
              ? { label: "Checking...", color: "text-gray-400", icon: Loader2 }
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

                  <div className="flex items-center gap-2 mt-3">
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
