import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, STALE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreditCard, Webhook, CheckCircle2, XCircle, Clock,
  AlertTriangle, RefreshCw, Users, Activity, DollarSign,
} from "lucide-react";
import { useAdminLang } from "@/i18n/LanguageContext";

interface BillingStatus {
  configured: boolean;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  mode: "live" | "test";
}

interface WebhookEvent {
  id: string;
  stripeEventId: string;
  type: string;
  processed: boolean;
  processedAt: string | null;
  rawPayload: string;
  createdAt: string;
}

interface StripeCustomer {
  id: string;
  entityType: string;
  entityId: string;
  stripeCustomerId: string;
  email: string | null;
  createdAt: string;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function EventTypeBadge({ type }: { type: string }) {
  const cat = type.split(".")[0];
  const color: Record<string, string> = {
    customer: "bg-blue-50 text-blue-700 border-blue-200",
    payment_intent: "bg-green-50 text-green-700 border-green-200",
    invoice: "bg-yellow-50 text-yellow-700 border-yellow-200",
    subscription: "bg-purple-50 text-purple-700 border-purple-200",
    charge: "bg-orange-50 text-orange-700 border-orange-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color[cat] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {type}
    </span>
  );
}

export default function PaymentsPage() {
  const { t } = useAdminLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newCustomer, setNewCustomer] = useState({ entityType: "company", entityId: "", email: "", name: "" });
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const { data: status, isLoading: statusLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    staleTime: STALE.MEDIUM,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<WebhookEvent[]>({
    queryKey: ["/api/billing/events"],
    staleTime: STALE.MEDIUM,
    refetchInterval: 30000,
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<StripeCustomer[]>({
    queryKey: ["/api/billing/customers"],
    staleTime: STALE.MEDIUM,
  });

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/customers", newCustomer);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t.payments.customerCreated });
      qc.invalidateQueries({ queryKey: ["/api/billing/customers"] });
      setShowAddCustomer(false);
      setNewCustomer({ entityType: "company", entityId: "", email: "", name: "" });
    },
    onError: (err: Error) => toast({ title: t.common.error, description: err.message, variant: "destructive" }),
  });

  const processedCount = events.filter((e) => e.processed).length;
  const pendingCount = events.filter((e) => !e.processed).length;

  return (
    <div data-testid="page-payments">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.payments.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.payments.subtitle}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["/api/billing"] })}
          className="gap-1.5"
          data-testid="button-refresh-payments"
        >
          <RefreshCw className="w-4 h-4" />
          {t.payments.refresh}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="p-5" data-testid="card-billing-status">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${status?.configured ? "bg-green-500" : "bg-yellow-500"}`}>
                {status?.configured ? <CheckCircle2 className="w-5 h-5 text-white" /> : <AlertTriangle className="w-5 h-5 text-white" />}
              </div>
              {!statusLoading && status && (
                <Badge variant="secondary" className={`text-xs ${status.mode === "live" ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
                  {status.mode}
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {statusLoading ? "—" : status?.configured ? t.payments.configured : t.payments.notConfigured}
            </p>
            <p className="text-sm text-gray-500 mt-1">{t.payments.stripeStatus}</p>
            {status && !status.configured && (
              <p className="text-xs text-yellow-600 mt-1">
                {!status.hasSecretKey && "Missing STRIPE_SECRET_KEY. "}
                {!status.hasWebhookSecret && "Missing STRIPE_WEBHOOK_SECRET."}
              </p>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="p-5" data-testid="card-webhook-events">
            <div className="w-10 h-10 bg-[#0D9488] rounded-lg flex items-center justify-center mb-3">
              <Webhook className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{eventsLoading ? "—" : events.length}</p>
            <p className="text-sm text-gray-500 mt-1">{t.payments.webhookEvents}</p>
            {events.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{processedCount} {t.payments.processed.toLowerCase()} · {pendingCount} {t.payments.pending.toLowerCase()}</p>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-5" data-testid="card-stripe-customers">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{customersLoading ? "—" : customers.length}</p>
            <p className="text-sm text-gray-500 mt-1">{t.payments.customers}</p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-5" data-testid="card-webhook-endpoint">
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mb-3">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm font-bold text-gray-900 break-all">POST /api/billing/webhook</p>
            <p className="text-sm text-gray-500 mt-1">Webhook Endpoint</p>
            <p className="text-xs text-gray-400 mt-0.5">Configure in Stripe Dashboard</p>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Webhook className="w-4 h-4 text-gray-400" />
                {t.payments.webhookEvents}
              </h2>
              <span className="text-xs text-gray-400">{events.length} {t.common.total.toLowerCase()}</span>
            </div>

            {eventsLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                <Webhook className="w-10 h-10 mb-3" />
                <p className="text-sm font-medium text-gray-400">{t.payments.noEvents}</p>
                <p className="text-xs text-gray-300 mt-1">{t.payments.noEventsDesc}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {events.slice(0, 20).map((evt) => (
                  <div key={evt.id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors" data-testid={`webhook-event-${evt.id}`}>
                    <div className="flex-shrink-0 mt-0.5">
                      {evt.processed
                        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                        : <Clock className="w-4 h-4 text-yellow-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <EventTypeBadge type={evt.type} />
                        <span className="text-xs text-gray-400">{formatTime(evt.createdAt)}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">{evt.stripeEventId}</p>
                    </div>
                    <Badge variant="secondary" className={`flex-shrink-0 text-xs ${evt.processed ? "text-green-600" : "text-yellow-600"}`}>
                      {evt.processed ? t.payments.processed : t.payments.pending}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                {t.payments.customers}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-[#0D9488]"
                onClick={() => setShowAddCustomer(!showAddCustomer)}
                data-testid="button-add-customer"
              >
                + {t.payments.addCustomer}
              </Button>
            </div>

            {showAddCustomer && (
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t.payments.entityId}</Label>
                  <Input
                    value={newCustomer.entityId}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, entityId: e.target.value }))}
                    placeholder="CRM ID"
                    className="h-8 text-xs"
                    data-testid="input-customer-entity-id"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.payments.emailLabel}</Label>
                  <Input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))}
                    placeholder="customer@email.com"
                    className="h-8 text-xs"
                    data-testid="input-customer-email"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.payments.nameLabel}</Label>
                  <Input
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Customer name"
                    className="h-8 text-xs"
                    data-testid="input-customer-name"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs bg-[#0D9488] hover:bg-[#0F766E]"
                    onClick={() => createCustomerMutation.mutate()}
                    disabled={!newCustomer.entityId || createCustomerMutation.isPending || !status?.configured}
                    data-testid="button-save-customer"
                  >
                    {createCustomerMutation.isPending ? t.payments.creating : t.payments.createCustomer}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowAddCustomer(false)}>
                    {t.payments.cancelAdd}
                  </Button>
                </div>
                {!status?.configured && (
                  <p className="text-xs text-yellow-600">{t.payments.setupRequired} — Stripe not configured.</p>
                )}
              </div>
            )}

            {customersLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : customers.length === 0 ? (
              <div className="py-10 px-5 text-center text-gray-300">
                <CreditCard className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm text-gray-400">{t.payments.noCustomers}</p>
                <p className="text-xs text-gray-300 mt-1">{t.payments.noCustomersDesc}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {customers.slice(0, 15).map((c) => (
                  <div key={c.id} className="px-5 py-3 hover:bg-gray-50 transition-colors" data-testid={`customer-row-${c.id}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#0D9488]/10 flex items-center justify-center flex-shrink-0">
                        <CreditCard className="w-3.5 h-3.5 text-[#0D9488]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.email ?? c.stripeCustomerId}</p>
                        <p className="text-xs text-gray-400 font-mono truncate">{c.stripeCustomerId}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {!status?.configured && !statusLoading && (
            <Card className="p-5 border-yellow-200 bg-yellow-50" data-testid="card-stripe-setup">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800">{t.payments.setupRequired}</p>
                  <ol className="text-xs text-yellow-700 mt-2 space-y-1 list-decimal list-inside">
                    <li>Add <code className="bg-yellow-100 px-1 rounded">STRIPE_SECRET_KEY</code> to secrets</li>
                    <li>Add <code className="bg-yellow-100 px-1 rounded">STRIPE_WEBHOOK_SECRET</code> to secrets</li>
                    <li>Configure <code className="bg-yellow-100 px-1 rounded">/api/billing/webhook</code> in Stripe Dashboard</li>
                  </ol>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
