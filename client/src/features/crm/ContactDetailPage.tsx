import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, User, Mail, Phone, Building2, MapPin,
  ChevronRight, Calendar, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CrmContact, CrmCompany, CrmLead, CrmLeadStatus } from "@shared/schema";
import { useAdminLang } from "@/i18n/LanguageContext";
import { STALE } from "@/lib/queryClient";

interface ContactDetail extends CrmContact {
  company?: CrmCompany | null;
  leads?: (CrmLead & { status?: CrmLeadStatus | null })[];
}

export default function ContactDetailPage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { t } = useAdminLang();

  const { data: contact, isLoading } = useQuery<ContactDetail>({
    queryKey: ["/api/crm/contacts", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/contacts/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch contact");
      return res.json();
    },
    staleTime: STALE.MEDIUM,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Contact not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/crm")} data-testid="button-back-to-crm">
          Back to CRM
        </Button>
      </div>
    );
  }

  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/crm")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-gray-400" />
            <h1 className="text-xl font-bold text-gray-900 truncate" data-testid="text-contact-name">
              {fullName}
            </h1>
          </div>
          {contact.title && (
            <p className="text-sm text-gray-500 mt-0.5 ml-7">{contact.title}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Contact Info</h2>
            <div className="space-y-3 text-sm">
              {contact.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700 truncate" data-testid="text-contact-email">{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700" data-testid="text-contact-phone">{contact.phone}</span>
                </div>
              )}
              {contact.altPhone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700">Alt: {contact.altPhone}</span>
                </div>
              )}
              {contact.preferredLanguage && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">{t.clients.preferredLanguage}</p>
                  <p className="text-gray-900">{contact.preferredLanguage === "es" ? t.clients.langSpanish : t.clients.langEnglish}</p>
                </div>
              )}
              {contact.notes && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">Notes</p>
                  <p className="text-gray-700 whitespace-pre-wrap" data-testid="text-contact-notes">{contact.notes}</p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                Created {new Date(contact.createdAt).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                Updated {new Date(contact.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </Card>

          {contact.company && (
            <Card
              className="p-5 hover-elevate cursor-pointer"
              onClick={() => navigate(`/admin/crm/companies/${contact.company!.id}`)}
              data-testid="card-contact-company"
            >
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-gray-400" />
                <h3 className="font-semibold text-gray-900 text-sm">Company</h3>
              </div>
              <p className="font-medium text-gray-900" data-testid="text-company-name">
                {contact.company.name}
              </p>
              {contact.company.dba && (
                <p className="text-xs text-gray-500 mt-0.5">DBA: {contact.company.dba}</p>
              )}
              <div className="mt-3 space-y-1.5 text-sm">
                {contact.company.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{contact.company.email}</span>
                  </div>
                )}
                {contact.company.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>{contact.company.phone}</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card className="p-5">
            <h2 className="font-semibold text-gray-900 mb-4">
              Leads ({contact.leads?.length ?? 0})
            </h2>
            {!contact.leads || contact.leads.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No leads linked to this contact</p>
            ) : (
              <div className="space-y-2">
                {contact.leads.map((lead, i) => (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card
                      className="p-4 hover-elevate cursor-pointer"
                      onClick={() => navigate(`/admin/crm/leads/${lead.id}`)}
                      data-testid={`card-lead-${lead.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900 text-sm truncate" data-testid={`text-lead-title-${lead.id}`}>
                              {lead.title}
                            </p>
                            {lead.status && (
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{ borderColor: lead.status.color, color: lead.status.color }}
                              >
                                {(t.crm.statusNames as Record<string, string>)[lead.status.slug] || lead.status.name}
                              </Badge>
                            )}
                            {lead.fromWebsiteForm && (
                              <Badge variant="secondary" className="text-xs">
                                <Globe className="w-3 h-3 mr-1" />
                                Web Form
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                            {lead.value && <span>${Number(lead.value).toLocaleString()}</span>}
                            {lead.source && <span>{lead.sourceLabel || lead.source}</span>}
                            <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
