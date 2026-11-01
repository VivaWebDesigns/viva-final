import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Search, Mail, Phone, Building2, MapPin, MessageSquare, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, STALE } from "@/lib/queryClient";
import { useAdminLang } from "@/i18n/LanguageContext";
import { useAuth } from "@features/auth/useAuth";

interface Submission {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  business: string | null;
  city: string | null;
  trade: string | null;
  service: string | null;
  message: string | null;
  smsConsent: boolean;
  createdAt: string;
}

interface SubmissionsResponse {
  items: Submission[];
  total: number;
}

export default function SubmissionsPage() {
  const { t } = useAdminLang();
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebounce(rawSearch, 300);
  const { data, isLoading } = useQuery<SubmissionsResponse>({
    queryKey: [`/api/admin/submissions?search=${encodeURIComponent(search)}&limit=100`],
    staleTime: STALE.FAST,
    refetchInterval: 30_000,
  });

  const submissions = data?.items ?? [];
  const total = data?.total ?? 0;

  const { role } = useAuth();
  const canDelete = role === "admin";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Only rows still on screen count as selected, so a new search never deletes hidden rows.
  const selected = submissions.filter((submission) => selectedIds.has(submission.id));
  const allSelected = submissions.length > 0 && selected.length === submissions.length;

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(submissions.map((submission) => submission.id)) : new Set());
  };

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) =>
      (await apiRequest("POST", "/api/admin/submissions/delete", { ids })).json() as Promise<{ deleted: number }>,
    onSuccess: (result) => {
      setSelectedIds(new Set());
      setConfirmOpen(false);
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/admin/submissions") });
      toast({ title: t.submissions.deleted.replace("{{count}}", String(result.deleted)) });
    },
    onError: (err: Error) => toast({ title: t.common.error, description: err.message, variant: "destructive" }),
  });

  return (
    <div className="h-full flex flex-col" data-testid="page-submissions">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.submissions.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.submissions.subtitle}</p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1 flex-shrink-0">
          {t.submissions.count.replace("{{count}}", String(total))}
        </Badge>
      </div>

      <div className="relative mb-4 flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={rawSearch}
          onChange={(event) => setRawSearch(event.target.value)}
          placeholder={t.submissions.searchPlaceholder}
          className="pl-10 bg-white"
          data-testid="input-submission-search"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-200">
          <Inbox className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">{t.submissions.noSubmissions}</p>
          <p className="text-sm text-gray-400 mt-1">
            {search ? t.common.tryDifferentSearch : t.submissions.noSubmissionsDesc}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {canDelete && (
            <div className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 px-4 py-2.5">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  data-testid="checkbox-select-all-submissions"
                />
                {selected.length > 0
                  ? t.submissions.selected.replace("{{count}}", String(selected.length))
                  : t.submissions.selectAll}
              </label>
              {selected.length > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmOpen(true)}
                  data-testid="button-delete-submissions"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  {t.submissions.deleteSelected.replace("{{count}}", String(selected.length))}
                </Button>
              )}
            </div>
          )}
          {total > 100 && !search && (
            <p className="text-xs text-gray-400">{t.submissions.showingNewest}</p>
          )}
          {submissions.map((submission) => (
            <article
              key={submission.id}
              className="bg-white rounded-xl border border-gray-200 p-4"
              data-testid={`submission-${submission.id}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0 flex items-start gap-3">
                  {canDelete && (
                    <Checkbox
                      className="mt-1"
                      checked={selectedIds.has(submission.id)}
                      onCheckedChange={(checked) => toggleOne(submission.id, checked === true)}
                      aria-label={submission.name}
                      data-testid={`checkbox-submission-${submission.id}`}
                    />
                  )}
                  <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-gray-900">{submission.name}</h2>
                    {submission.smsConsent && (
                      <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                        {t.submissions.smsConsent}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                    {submission.business && (
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {submission.business}
                      </span>
                    )}
                    {submission.email && (
                      <a className="flex items-center gap-1.5 hover:text-[#0D9488]" href={`mailto:${submission.email}`}>
                        <Mail className="w-4 h-4 text-gray-400" />
                        {submission.email}
                      </a>
                    )}
                    <a className="flex items-center gap-1.5 hover:text-[#0D9488]" href={`tel:${submission.phone}`}>
                      <Phone className="w-4 h-4 text-gray-400" />
                      {submission.phone}
                    </a>
                    {submission.city && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {submission.city}
                      </span>
                    )}
                  </div>

                  {(submission.trade || submission.service) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {submission.trade && <Badge variant="outline">{submission.trade}</Badge>}
                      {submission.service && submission.service !== submission.trade && (
                        <Badge variant="outline">{submission.service}</Badge>
                      )}
                    </div>
                  )}
                  </div>
                </div>

                <time className="text-xs text-gray-400 whitespace-nowrap" dateTime={submission.createdAt}>
                  {new Date(submission.createdAt).toLocaleString()}
                </time>
              </div>

              {submission.message && (
                <details className="mt-4 border-t border-gray-100 pt-3">
                  <summary className="cursor-pointer text-sm font-medium text-gray-600 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    {t.submissions.details}
                  </summary>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                    {submission.message}
                  </p>
                </details>
              )}
            </article>
          ))}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.submissions.deleteTitle.replace("{{count}}", String(selected.length))}</AlertDialogTitle>
            <AlertDialogDescription>{t.submissions.deleteWarning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteMutation.mutate(selected.map((submission) => submission.id));
              }}
              data-testid="button-confirm-delete-submissions"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
