import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/queryClient";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Building2, Search, DollarSign, Users, TrendingUp, Layers, Phone, Mail, Globe, MapPin } from "lucide-react";

interface ClientRow {
  id: string;
  name: string;
  dba: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  createdAt: string;
  contactCount: number;
  leadCount: number;
  opportunityValue: number;
  opportunityCount: number;
  activeOnboardings: number;
}

interface ClientsResponse {
  items: ClientRow[];
  total: number;
  page: number;
  limit: number;
}

export default function ClientsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<ClientsResponse>({
    queryKey: [`/api/clients?search=${encodeURIComponent(search)}&limit=50`],
    staleTime: STALE.FAST,
  });

  const clients = data?.items || [];
  const total = data?.total || 0;

  return (
    <div className="h-full flex flex-col" data-testid="page-clients">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">All companies and client relationships</p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {total} companies
        </Badge>
      </div>

      <div className="flex-shrink-0 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, industry, or city..."
            className="pl-10 bg-white"
            data-testid="input-client-search"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-200">
          <Building2 className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">No clients found</p>
          <p className="text-sm text-gray-400 mt-1">
            {search ? "Try a different search term" : "Clients appear here once leads are ingested via CRM"}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {clients.map(client => (
              <Link key={client.id} href={`/admin/crm/companies/${client.id}`}>
                <div
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
                  data-testid={`card-client-${client.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#0D9488]/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4.5 h-4.5 text-[#0D9488]" />
                      </div>
                      <div className="min-w-0">
                        <h3
                          className="text-sm font-semibold text-gray-900 group-hover:text-[#0D9488] transition-colors leading-tight line-clamp-1"
                          data-testid={`text-client-name-${client.id}`}
                        >
                          {client.name}
                        </h3>
                        {client.dba && (
                          <p className="text-xs text-gray-400 line-clamp-1">dba {client.dba}</p>
                        )}
                        {client.industry && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 mt-1">
                            {client.industry}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span><span className="font-medium text-gray-700">{client.contactCount}</span> contact{client.contactCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <TrendingUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span><span className="font-medium text-gray-700">{client.leadCount}</span> lead{client.leadCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Layers className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span><span className="font-medium text-gray-700">{client.opportunityCount}</span> deal{client.opportunityCount !== 1 ? "s" : ""}</span>
                    </div>
                    {client.opportunityValue > 0 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="font-semibold text-emerald-600">
                          {Number(client.opportunityValue).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 border-t border-gray-50 pt-2">
                    {(client.city || client.state) && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{[client.city, client.state].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{client.phone}</span>
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.website && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Globe className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{client.website.replace(/^https?:\/\//, "")}</span>
                      </div>
                    )}
                  </div>

                  {client.activeOnboardings > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1">
                      <Layers className="w-3 h-3" />
                      {client.activeOnboardings} active onboarding{client.activeOnboardings !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
