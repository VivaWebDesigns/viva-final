import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, Globe, ExternalLink,
  User, ChevronRight, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CrmCompany, CrmContact, CrmLead, CrmLeadStatus } from "@shared/schema";
import { useAdminLang } from "@/i18n/LanguageContext";
import { STALE } from "@/lib/queryClient";

interface CompanyDetail extends CrmCompany {
  contacts?: CrmContact[];
  leads?: (CrmLead & { status?: CrmLeadStatus | null })[];
}

export default function CompanyDetailPage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { t } = useAdminLang();

  const { data: company, isLoading } = useQuery<CompanyDetail>({
    queryKey: ["/api/crm/companies", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/companies/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch company");
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

  if (!company) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Company not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/crm")} data-testid="button-back-to-crm">
          Back to CRM
        </Button>
      </div>
    );
  }

  const address = [company.address, company.city, company.state, company.zip]
    .filter(Boolean)
    .join(", ");

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
            <Building2 className="w-5 h-5 text-gray-400" />
            <h1 className="text-xl font-bold text-gray-900 truncate" data-testid="text-company-name">
              {company.name}
            </h1>
          </div>
          {company.dba && (
            <p className="text-sm text-gray-500 mt-0.5 ml-7">DBA: {company.dba}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Company Info</h2>
            <div className="space-y-3 text-sm">
              {company.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700 truncate" data-testid="text-company-email">{company.email}</span>
                </div>
              )}
              {company.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700" data-testid="text-company-phone">{company.phone}</span>
                </div>
              )}
              {address && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700" data-testid="text-company-address">{address}</span>
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0D9488] hover:underline truncate"
                    data-testid="link-company-website"
                  >
                    {company.website}
                  </a>
                </div>
              )}
              {company.industry && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">Industry</p>
                  <p className="text-gray-900" data-testid="text-company-industry">{company.industry}</p>
                </div>
              )}
              {company.preferredLanguage && (
                <div>
                  <p className="text-xs text-gray-500">{t.clients.preferredLanguage}</p>
                  <p className="text-gray-900">{company.preferredLanguage === "es" ? t.clients.langSpanish : t.clients.langEnglish}</p>
                </div>
              )}
              {company.notes && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">Notes</p>
                  <p className="text-gray-700 whitespace-pre-wrap" data-testid="text-company-notes">{company.notes}</p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                Created {new Date(company.createdAt).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                Updated {new Date(company.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold text-gray-900 mb-4">
              Contacts ({company.contacts?.length ?? 0})
            </h2>
            {!company.contacts || company.contacts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No contacts linked to this company</p>
            ) : (
              <div className="space-y-2">
                {company.contacts.map((contact, i) => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card
                      className="p-4 hover-elevate cursor-pointer"
                      onClick={() => navigate(`/admin/crm/contacts/${contact.id}`)}
                      data-testid={`card-contact-${contact.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-blue-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate" data-testid={`text-contact-name-${contact.id}`}>
                              {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                              {contact.title && <span>{contact.title}</span>}
                              {contact.email && <span>{contact.email}</span>}
                              {contact.phone && <span>{contact.phone}</span>}
                            </div>
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

          <Card className="p-5">
            <h2 className="font-semibold text-gray-900 mb-4">
              Leads ({company.leads?.length ?? 0})
            </h2>
            {!company.leads || company.leads.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No leads linked to this company</p>
            ) : (
              <div className="space-y-2">
                {company.leads.map((lead, i) => (
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
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                            {lead.value && <span>${Number(lead.value).toLocaleString()}</span>}
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
