import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface InstantlyStatus {
  apiKeySet: boolean;
  campaignIdSet: boolean;
  webhookSecretSet: boolean;
  imageDomainSet: boolean;
  counts: Record<string, number>;
  imageSyncPending: number;
  problems: Array<{ leadId: string; businessName: string; status: string; error: string | null }>;
}

interface InstantlyPreview {
  eligibleCount: number;
  excludedCounts: Record<string, number>;
}

const STATUS_KEY = ["/api/instantly/status"];
const PREVIEW_KEY = ["/api/instantly/enrollment/preview"];

const EXCLUSION_LABELS: Record<string, string> = {
  crm_only: "CRM-only (no scan)",
  no_snapshot: "No finished picture",
  no_email: "No email address",
  already_emailed: "Already emailed",
  outreach_stopped: "Outreach stopped",
  duplicate_email: "Shares an email address",
  already_enrolled: "Already in Instantly",
};

function SetupRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-500" />}
      <span className={ok ? "text-gray-700" : "text-gray-900"}>{label}</span>
    </li>
  );
}

export default function InstantlyPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: status } = useQuery<InstantlyStatus>({ queryKey: STATUS_KEY });
  const { data: preview } = useQuery<InstantlyPreview>({ queryKey: PREVIEW_KEY });
  const counts = status?.counts ?? {};
  const configured = !!status && status.apiKeySet && status.campaignIdSet;

  const useAction = (url: string, success: (body: any) => string) => useMutation({
    mutationFn: async () => (await apiRequest("POST", url)).json(),
    onSuccess: (body) => {
      toast({ title: success(body) });
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
      queryClient.invalidateQueries({ queryKey: PREVIEW_KEY });
    },
    onError: (error: Error) => toast({ title: "Something went wrong", description: error.message, variant: "destructive" }),
  });
  const prepare = useAction("/api/instantly/enrollment/prepare",
    body => `${body.prepared} pictures copied${body.failed.length ? `, ${body.failed.length} failed` : ""}${body.retired.length ? `, ${body.retired.length} no longer qualify` : ""}`);
  const push = useAction("/api/instantly/enrollment/push",
    body => `${body.enrolled} leads sent to Instantly${body.skipped.length ? `, ${body.skipped.length} skipped` : ""}${body.retired.length ? `, ${body.retired.length} no longer qualify` : ""}`);
  const registerHook = useAction("/api/instantly/webhook/register", () => "Instantly will now report back to the CRM");
  const retrySync = useAction("/api/instantly/enrollment/retry-image-sync",
    body => `${body.synced} of ${body.attempted} pictures updated in Instantly`);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Instantly</h1>
        <p className="mt-1 text-sm text-gray-600">
          Sends SAB + Email Ready leads to the Instantly campaign and records sends, replies, unsubscribes and bounces back in the CRM.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Setup</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <SetupRow ok={!!status?.imageDomainSet} label="Picture domain (img.vivascans.com)" />
            <SetupRow ok={!!status?.apiKeySet} label="Instantly API key" />
            <SetupRow ok={!!status?.campaignIdSet} label="Instantly campaign ID" />
            <SetupRow ok={!!status?.webhookSecretSet} label="Webhook secret" />
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Redraw and copy pictures</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <p>
            {preview ? `${preview.eligibleCount} leads can be prepared.` : "Checking leads…"}
            {preview && Object.entries(preview.excludedCounts).map(([reason, count]) => (
              <span key={reason} className="block text-gray-500">Left out — {EXCLUSION_LABELS[reason] ?? reason}: {count}</span>
            ))}
          </p>
          <p>Redraw pictures first if any numbers changed, then copy them to the picture domain. Nothing is sent to Instantly here.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><Link href="/admin/tools/redraw-report-pictures">Redraw pictures</Link></Button>
            <Button onClick={() => prepare.mutate()} disabled={prepare.isPending || !status?.imageDomainSet} data-testid="button-instantly-prepare">
              {prepare.isPending ? "Copying pictures…" : "Copy pictures"}
            </Button>
          </div>
          <p className="text-gray-500">Ready to send: {counts.ready ?? 0}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2. Connect and send</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => registerHook.mutate()}
              disabled={registerHook.isPending || !configured || !status?.webhookSecretSet} data-testid="button-instantly-webhook">
              {registerHook.isPending ? "Connecting…" : "Connect webhook"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={push.isPending || !configured || !(counts.ready > 0)} data-testid="button-instantly-push">
                  {push.isPending ? "Sending…" : `Send ${counts.ready ?? 0} leads to Instantly`}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Send {counts.ready ?? 0} leads to Instantly?</AlertDialogTitle>
                  <AlertDialogDescription>
                    They are added to the campaign and Instantly starts emailing them on its schedule. Their manual Gmail email tasks are closed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => push.mutate()}>Send to Instantly</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className="text-gray-500">
            In Instantly: {counts.enrolled ?? 0} · Stopped: {counts.stopped ?? 0} · Problems: {counts.error ?? 0}
          </p>
        </CardContent>
      </Card>

      {(status?.imageSyncPending || status?.problems.length) ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Needs attention</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {status.imageSyncPending > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span>{status.imageSyncPending} redrawn pictures not yet updated in Instantly.</span>
                <Button size="sm" variant="outline" onClick={() => retrySync.mutate()} disabled={retrySync.isPending}>Retry</Button>
              </div>
            )}
            <ul className="space-y-1 text-red-700">
              {status.problems.map(problem => (
                <li key={problem.leadId}>
                  <Link href={`/admin/crm/leads/${problem.leadId}`} className="underline">{problem.businessName}</Link>: {problem.error}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
