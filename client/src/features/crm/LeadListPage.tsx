import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Search, Filter, ChevronLeft, ChevronRight, ExternalLink, Globe, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CrmLead, CrmLeadStatus, CrmContact, CrmCompany } from "@shared/schema";

interface LeadWithRelations extends CrmLead {
  contact?: CrmContact | null;
  company?: CrmCompany | null;
  status?: CrmLeadStatus | null;
}

interface LeadsResponse {
  leads: LeadWithRelations[];
  total: number;
  page: number;
  pageSize: number;
}

export default function LeadListPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: statuses = [] } = useQuery<CrmLeadStatus[]>({
    queryKey: ["/api/crm/statuses"],
  });

  const { data: leadsData, isLoading } = useQuery<LeadsResponse>({
    queryKey: ["/api/crm/leads", search, statusFilter, sourceFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "all") params.set("statusId", statusFilter);
      if (sourceFilter && sourceFilter !== "all") params.set("source", sourceFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const res = await fetch(`/api/crm/leads?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  const leads = leadsData?.leads ?? [];
  const total = leadsData?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const getStatusBadge = (lead: LeadWithRelations) => {
    const status = lead.status;
    if (!status) return null;
    return (
      <Badge
        variant="outline"
        className="text-xs"
        style={{
          borderColor: status.color,
          color: status.color,
        }}
        data-testid={`badge-status-${lead.id}`}
      >
        {status.name}
      </Badge>
    );
  };

  const getContactName = (lead: LeadWithRelations) => {
    if (!lead.contact) return "No contact";
    return [lead.contact.firstName, lead.contact.lastName].filter(Boolean).join(" ");
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-crm-title">CRM Leads</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} lead{total !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search leads, contacts, companies..."
              className="pl-10"
              data-testid="input-search-leads"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status-filter">
              <Filter className="w-4 h-4 mr-2 text-gray-400" />
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-source-filter">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="website_form">Website Form</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500" data-testid="text-no-leads">No leads found</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {leads.map((lead, i) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card
                className="hover-elevate cursor-pointer"
                onClick={() => navigate(`/admin/crm/leads/${lead.id}`)}
                data-testid={`card-lead-${lead.id}`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-gray-900 text-sm truncate" data-testid={`text-lead-title-${lead.id}`}>
                          {lead.title}
                        </h3>
                        {getStatusBadge(lead)}
                        {lead.fromWebsiteForm && (
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-web-form-${lead.id}`}>
                            <Globe className="w-3 h-3 mr-1" />
                            Web Form
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                        <span data-testid={`text-lead-contact-${lead.id}`}>
                          {getContactName(lead)}
                        </span>
                        {lead.company && (
                          <span data-testid={`text-lead-company-${lead.id}`}>
                            {lead.company.name}
                          </span>
                        )}
                        {lead.contact?.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {lead.contact.email}
                          </span>
                        )}
                        {lead.contact?.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {lead.contact.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {lead.value && (
                        <span className="text-sm font-medium text-gray-900" data-testid={`text-lead-value-${lead.id}`}>
                          ${Number(lead.value).toLocaleString()}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
