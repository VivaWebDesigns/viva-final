import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Calendar, Building2, User as UserIcon, CheckCircle2, Clock,
  AlertTriangle, Pause, ArrowRight, MessageSquare, Play, CheckCheck,
  XCircle, RefreshCw, Zap, ListChecks, FileText,
} from "lucide-react";
import type { OnboardingRecord, OnboardingChecklistItem, OnboardingNote, CrmCompany, CrmContact, PipelineOpportunity } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: ArrowRight },
  completed: { label: "Completed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
  on_hold: { label: "On Hold", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", icon: Pause },
};

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

const NOTE_ICONS: Record<string, typeof MessageSquare> = {
  note: MessageSquare,
  system: Zap,
  status_change: RefreshCw,
  checklist_update: ListChecks,
};

type OnboardingDetailData = OnboardingRecord & {
  checklist: OnboardingChecklistItem[];
  progress: { total: number; completed: number; percentage: number };
};

export default function OnboardingDetailPage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [noteContent, setNoteContent] = useState("");

  const { data: record, isLoading } = useQuery<OnboardingDetailData>({
    queryKey: [`/api/onboarding/records/${id}`],
  });

  const { data: notes } = useQuery<OnboardingNote[]>({
    queryKey: [`/api/onboarding/records/${id}/notes`],
  });

  const { data: company } = useQuery<CrmCompany>({
    queryKey: ["/api/crm/companies", record?.companyId],
    enabled: !!record?.companyId,
  });

  const { data: contact } = useQuery<CrmContact>({
    queryKey: ["/api/crm/contacts", record?.contactId],
    enabled: !!record?.contactId,
  });

  const { data: opportunity } = useQuery<PipelineOpportunity>({
    queryKey: ["/api/pipeline/opportunities", record?.opportunityId],
    enabled: !!record?.opportunityId,
  });

  const invalidateRecord = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/onboarding/records/${id}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/onboarding/records/${id}/notes`] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PUT", `/api/onboarding/records/${id}`, { status }),
    onSuccess: () => {
      invalidateRecord();
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/stats"] });
      toast({ title: "Status updated" });
    },
  });

  const toggleItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiRequest("PUT", `/api/onboarding/records/${id}/checklist/${itemId}`, {}),
    onSuccess: () => {
      invalidateRecord();
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/onboarding/records/${id}/notes`, { content, type: "note" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/onboarding/records/${id}/notes`] });
      setNoteContent("");
      toast({ title: "Note added" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Record not found</h2>
        <Link href="/admin/onboarding">
          <Button variant="outline">Back to Onboarding</Button>
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.pending;
  const now = new Date();
  const isOverdue = record.dueDate && new Date(record.dueDate) < now && record.status !== "completed";

  const checklistByCategory = (record.checklist || []).reduce<Record<string, OnboardingChecklistItem[]>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/onboarding">
          <Button variant="ghost" size="icon" data-testid="button-back-onboarding">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" data-testid="text-onboarding-client-name">{record.clientName}</h1>
            <Badge className={statusCfg.color} data-testid="badge-onboarding-status">{statusCfg.label}</Badge>
            {isOverdue && (
              <Badge variant="destructive" data-testid="badge-onboarding-overdue">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overdue
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-2">
                <Progress value={record.progress.percentage} className="flex-1" data-testid="progress-bar" />
                <span className="text-sm font-medium whitespace-nowrap" data-testid="text-progress-percentage">
                  {record.progress.completed}/{record.progress.total} ({record.progress.percentage}%)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(checklistByCategory).length === 0 ? (
                <p className="text-muted-foreground text-sm">No checklist items</p>
              ) : (
                Object.entries(checklistByCategory).map(([category, items]) => (
                  <div key={category}>
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                      {CATEGORY_LABELS[category] || category}
                    </h4>
                    <div className="space-y-2">
                      {items.map((item) => {
                        const itemOverdue = item.dueDate && new Date(item.dueDate) < now && !item.isCompleted;
                        return (
                          <div
                            key={item.id}
                            className={`flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors ${itemOverdue ? "bg-red-50 dark:bg-red-950/30" : ""}`}
                            data-testid={`checklist-item-${item.id}`}
                          >
                            <Checkbox
                              checked={item.isCompleted}
                              onCheckedChange={() => toggleItemMutation.mutate(item.id)}
                              disabled={record.status === "completed"}
                              data-testid={`checkbox-item-${item.id}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm ${item.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                                  {item.label}
                                </span>
                                {item.isRequired && (
                                  <Badge variant="outline" className="text-[10px] px-1">Required</Badge>
                                )}
                                {itemOverdue && (
                                  <Badge variant="destructive" className="text-[10px] px-1">
                                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                    Overdue
                                  </Badge>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Textarea
                  placeholder="Add a note..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="mb-2"
                  data-testid="textarea-note"
                />
                <Button
                  size="sm"
                  disabled={!noteContent.trim() || addNoteMutation.isPending}
                  onClick={() => addNoteMutation.mutate(noteContent.trim())}
                  data-testid="button-add-note"
                >
                  Add Note
                </Button>
              </div>

              <div className="space-y-3">
                {(notes || []).map((note) => {
                  const NoteIcon = NOTE_ICONS[note.type] || MessageSquare;
                  return (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3 p-3 rounded-md bg-muted/30"
                      data-testid={`note-${note.id}`}
                    >
                      <NoteIcon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(note.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {record.status === "pending" && (
                <Button
                  className="w-full"
                  onClick={() => statusMutation.mutate("in_progress")}
                  disabled={statusMutation.isPending}
                  data-testid="button-start-onboarding"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Onboarding
                </Button>
              )}
              {record.status === "in_progress" && (
                <>
                  <Button
                    className="w-full"
                    onClick={() => statusMutation.mutate("completed")}
                    disabled={statusMutation.isPending}
                    data-testid="button-complete-onboarding"
                  >
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Mark Complete
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => statusMutation.mutate("on_hold")}
                    disabled={statusMutation.isPending}
                    data-testid="button-hold-onboarding"
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Put On Hold
                  </Button>
                </>
              )}
              {record.status === "on_hold" && (
                <Button
                  className="w-full"
                  onClick={() => statusMutation.mutate("in_progress")}
                  disabled={statusMutation.isPending}
                  data-testid="button-resume-onboarding"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              )}
              {record.status === "completed" && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => statusMutation.mutate("in_progress")}
                  disabled={statusMutation.isPending}
                  data-testid="button-reopen-onboarding"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reopen
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {record.kickoffDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Kickoff:</span>
                  <span data-testid="text-kickoff-date">{new Date(record.kickoffDate).toLocaleDateString()}</span>
                </div>
              )}
              {record.dueDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Due:</span>
                  <span className={isOverdue ? "text-red-600 font-semibold" : ""} data-testid="text-due-date">
                    {new Date(record.dueDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              {record.completedAt && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-muted-foreground">Completed:</span>
                  <span data-testid="text-completed-date">{new Date(record.completedAt).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Created: {new Date(record.createdAt).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Linked Records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {company && (
                <Link href={`/admin/crm/companies/${company.id}`}>
                  <div className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer" data-testid="link-company">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{company.name}</span>
                  </div>
                </Link>
              )}
              {contact && (
                <Link href={`/admin/crm/contacts/${contact.id}`}>
                  <div className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer" data-testid="link-contact">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{contact.firstName} {contact.lastName}</span>
                  </div>
                </Link>
              )}
              {opportunity && (
                <Link href={`/admin/pipeline/opportunities/${opportunity.id}`}>
                  <div className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer" data-testid="link-opportunity">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{opportunity.title}</span>
                  </div>
                </Link>
              )}
              {!company && !contact && !opportunity && (
                <p className="text-muted-foreground text-xs">No linked records</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
