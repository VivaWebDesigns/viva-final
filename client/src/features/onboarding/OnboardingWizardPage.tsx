import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RichTextEditorField from "@/features/chat/RichTextEditorField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowRight, Check, User as UserIcon, ListChecks,
  Calendar, Eye, Building2, FileText,
} from "lucide-react";
import type { OnboardingTemplate, CrmCompany, CrmContact } from "@shared/schema";

const CATEGORY_LABELS: Record<string, string> = {
  contract: "Contract",
  payment: "Payment",
  branding: "Branding & Assets",
  domain_dns: "Domain & DNS",
  website: "Website Access",
  google_business: "Google Business",
  google_ads: "Google Ads",
  meta_facebook: "Meta / Facebook",
  social: "Social Media",
  content: "Content",
  kickoff: "Kickoff",
};

type ChecklistItem = {
  category: string;
  label: string;
  description?: string;
  isRequired: boolean;
  sortOrder: number;
  included: boolean;
};

const STEPS = [
  { title: "Client Info", icon: UserIcon },
  { title: "Checklist", icon: ListChecks },
  { title: "Dates & Assignment", icon: Calendar },
  { title: "Review & Create", icon: Eye },
];

export default function OnboardingWizardPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  const [clientName, setClientName] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [kickoffDate, setKickoffDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const { data: templates } = useQuery<OnboardingTemplate[]>({
    queryKey: ["/api/onboarding/templates"],
  });

  const { data: companiesData } = useQuery<{ companies: CrmCompany[] }>({
    queryKey: ["/api/crm/companies"],
  });

  const { data: contactsData } = useQuery<{ contacts: CrmContact[] }>({
    queryKey: ["/api/crm/contacts"],
  });

  const companies = companiesData?.companies || (Array.isArray(companiesData) ? companiesData : []) as CrmCompany[];
  const contacts = contactsData?.contacts || (Array.isArray(contactsData) ? contactsData : []) as CrmContact[];

  const createMutation = useMutation({
    mutationFn: () => {
      const selectedItems = checklistItems
        .filter((item) => item.included)
        .map((item, idx) => ({
          category: item.category,
          label: item.label,
          description: item.description,
          isRequired: item.isRequired,
          sortOrder: idx,
        }));

      return apiRequest("POST", "/api/onboarding/records", {
        clientName,
        companyId: companyId && companyId !== "none" ? companyId : null,
        contactId: contactId && contactId !== "none" ? contactId : null,
        templateId: templateId || null,
        kickoffDate: kickoffDate || null,
        dueDate: dueDate || null,
        notes: notes || null,
        checklistItems: selectedItems,
      });
    },
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith?.("/api/onboarding") });

      toast({ title: "Onboarding created", description: `${clientName} onboarding has been created.` });
      navigate(`/admin/onboarding/${data.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleTemplateSelect = (id: string) => {
    setTemplateId(id);
    const template = templates?.find((t) => t.id === id);
    if (template && Array.isArray(template.items)) {
      setChecklistItems(
        (template.items as any[]).map((item: any, idx: number) => ({
          category: item.category,
          label: item.label,
          description: item.description || "",
          isRequired: item.isRequired !== false,
          sortOrder: idx,
          included: true,
        }))
      );
    }
  };

  const toggleItem = (idx: number) => {
    setChecklistItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, included: !item.included } : item))
    );
  };

  const canProceed = () => {
    if (step === 0) return clientName.trim().length > 0;
    if (step === 1) return checklistItems.some((item) => item.included);
    return true;
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const selectedItems = checklistItems.filter((item) => item.included);
  const groupedItems = selectedItems.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/onboarding">
          <Button variant="ghost" size="icon" data-testid="button-back-wizard">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold" data-testid="text-wizard-title">New Client Onboarding</h1>
      </div>

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const StepIcon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid={`step-indicator-${i}`}
              >
                {isDone ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                <span className="hidden sm:inline">{s.title}</span>
              </div>
              {i < STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 0 && (
            <Card className="border">
              <CardHeader>
                <CardTitle>Client Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="clientName">Client Name *</Label>
                  <Input
                    id="clientName"
                    placeholder="Enter client or project name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    data-testid="input-client-name"
                  />
                </div>
                <div>
                  <Label>Company (optional)</Label>
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger data-testid="select-company">
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {companies.map((c: CrmCompany) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contact (optional)</Label>
                  <Select value={contactId} onValueChange={setContactId}>
                    <SelectTrigger data-testid="select-contact">
                      <SelectValue placeholder="Select a contact" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {contacts.map((c: CrmContact) => (
                        <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card className="border">
              <CardHeader>
                <CardTitle>Checklist Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {templates && templates.length > 0 && (
                  <div>
                    <Label>Start from template</Label>
                    <Select value={templateId} onValueChange={handleTemplateSelect}>
                      <SelectTrigger data-testid="select-template">
                        <SelectValue placeholder="Choose a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {checklistItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListChecks className="h-10 w-10 mx-auto mb-3" />
                    <p>Select a template above to load checklist items</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(
                      checklistItems.reduce<Record<string, { item: ChecklistItem; idx: number }[]>>((acc, item, idx) => {
                        if (!acc[item.category]) acc[item.category] = [];
                        acc[item.category].push({ item, idx });
                        return acc;
                      }, {})
                    ).map(([category, items]) => (
                      <div key={category}>
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                          {CATEGORY_LABELS[category] || category}
                        </h4>
                        <div className="space-y-2">
                          {items.map(({ item, idx }) => (
                            <div key={idx} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50">
                              <Checkbox
                                checked={item.included}
                                onCheckedChange={() => toggleItem(idx)}
                                data-testid={`checkbox-wizard-item-${idx}`}
                              />
                              <div>
                                <span className="text-sm">{item.label}</span>
                                {item.isRequired && (
                                  <Badge variant="outline" className="ml-2 text-[10px] px-1">Required</Badge>
                                )}
                                {item.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      {selectedItems.length} of {checklistItems.length} items selected
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="border">
              <CardHeader>
                <CardTitle>Dates & Assignment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="kickoffDate">Kickoff Date</Label>
                  <Input
                    id="kickoffDate"
                    type="date"
                    value={kickoffDate}
                    onChange={(e) => setKickoffDate(e.target.value)}
                    data-testid="input-kickoff-date"
                  />
                </div>
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    data-testid="input-due-date"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <RichTextEditorField
                    value={notes}
                    onChange={(html) => setNotes(html)}
                    placeholder="Additional notes or instructions..."
                    minHeight="100px"
                    data-testid="textarea-wizard-notes"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="border">
              <CardHeader>
                <CardTitle>Review & Create</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Client:</span>
                    <p className="font-semibold" data-testid="review-client-name">{clientName}</p>
                  </div>
                  {companyId && companyId !== "none" && (
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Company:</span>
                      <p className="font-semibold">{companies.find((c: CrmCompany) => c.id === companyId)?.name}</p>
                    </div>
                  )}
                  {contactId && contactId !== "none" && (
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1"><UserIcon className="h-3 w-3" /> Contact:</span>
                      <p className="font-semibold">
                        {(() => { const c = contacts.find((c: CrmContact) => c.id === contactId); return c ? `${c.firstName} ${c.lastName}` : ""; })()}
                      </p>
                    </div>
                  )}
                  {kickoffDate && (
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Kickoff:</span>
                      <p className="font-semibold">{new Date(kickoffDate).toLocaleDateString()}</p>
                    </div>
                  )}
                  {dueDate && (
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Due:</span>
                      <p className="font-semibold">{new Date(dueDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>

                {selectedItems.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <ListChecks className="h-4 w-4" />
                      Checklist ({selectedItems.length} items)
                    </h4>
                    {Object.entries(groupedItems).map(([category, items]) => (
                      <div key={category} className="mb-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{CATEGORY_LABELS[category] || category}</p>
                        <ul className="ml-4 text-sm">
                          {items.map((item, i) => (
                            <li key={i} className="flex items-center gap-1">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              {item.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {notes && (
                  <div>
                    <span className="text-sm text-muted-foreground">Notes:</span>
                    <p className="text-sm">{notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prev}
          disabled={step === 0}
          data-testid="button-wizard-prev"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={next}
            disabled={!canProceed()}
            data-testid="button-wizard-next"
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !clientName.trim()}
            data-testid="button-wizard-create"
          >
            {createMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Create Onboarding
          </Button>
        )}
      </div>
    </div>
  );
}
