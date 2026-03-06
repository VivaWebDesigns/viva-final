import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CreditCard, Mail, Brain, Cloud, ExternalLink, CheckCircle2, XCircle, Clock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { IntegrationRecord } from "@shared/schema";

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

export default function IntegrationsPage() {
  const { data: integrations = [], isLoading } = useQuery<IntegrationRecord[]>({
    queryKey: ["/api/integrations"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await apiRequest("PUT", `/api/integrations/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="text-integrations-title">Integrations</h1>
        <p className="text-gray-500 text-sm mt-1">Manage third-party service connections</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((integration, i) => {
            const settings = (integration.settings || {}) as any;
            const Icon = PROVIDER_ICONS[integration.provider] || Cloud;
            const color = PROVIDER_COLORS[integration.provider] || "bg-gray-500";

            return (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-xl border border-gray-200 p-6"
                data-testid={`card-integration-${integration.provider}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{settings.name || integration.provider}</h3>
                      <p className="text-sm text-gray-500">{settings.description || ""}</p>
                    </div>
                  </div>
                  <Switch
                    checked={integration.enabled}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: integration.id, enabled: checked })
                    }
                    data-testid={`switch-${integration.provider}`}
                  />
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    {integration.configComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-amber-500" />
                    )}
                    <span className={integration.configComplete ? "text-green-700" : "text-amber-700"}>
                      {integration.configComplete ? "Configuration complete" : "Configuration needed"}
                    </span>
                  </div>
                  {integration.lastTested && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span>Last tested: {new Date(integration.lastTested).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {settings.requiredEnvVars && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Required environment variables:</p>
                    <div className="flex flex-wrap gap-1">
                      {(settings.requiredEnvVars as string[]).map((v: string) => (
                        <span key={v} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {settings.docsUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      data-testid={`button-docs-${integration.provider}`}
                    >
                      <a href={settings.docsUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Docs
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" data-testid={`button-settings-${integration.provider}`}>
                    <Settings className="w-3 h-3 mr-1" />
                    Settings
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
