import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox, Search, Mail, Phone, Building2, MapPin, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { STALE } from "@/lib/queryClient";
import { useAdminLang } from "@/i18n/LanguageContext";

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
    </div>
  );
}
