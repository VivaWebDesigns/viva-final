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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, DollarSign, Calendar, Building2, User as UserIcon,
  MessageSquare, Phone, Mail, FileText, CheckCircle, XCircle,
  Clock, Zap, ArrowRightLeft, UserPlus,
} from "lucide-react";
import type { PipelineStage, PipelineOpportunity, PipelineActivity, CrmCompany, CrmContact, CrmLead } from "@shared/schema";

const ACTIVITY_ICONS: Record<string, typeof MessageSquare> = {
  note: MessageSquare,
  call: Phone,
  email: Mail,
  task: FileText,
  stage_change: ArrowRightLeft,
  system: Zap,
};

export default function OpportunityDetailPage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState("note");

  const { data: opp, isLoading } = useQuery<PipelineOpportunity>({
    queryKey: ["/api/pipeline/opportunities", id],
  });

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline/stages"],
  });

  const { data: activities } = useQuery<PipelineActivity[]>({
    queryKey: ["/api/pipeline/opportunities", id, "activities"],
  });

  const { data: company } = useQuery<CrmCompany>({
    queryKey: ["/api/crm/companies", opp?.companyId || ""],
    enabled: !!opp?.companyId,
  });

  const { data: contact } = useQuery<CrmContact>({
    queryKey: ["/api/crm/contacts", opp?.contactId || ""],
    enabled: !!opp?.contactId,
  });

  const { data: sourceLead } = useQuery<CrmLead>({
    queryKey: ["/api/crm/leads", opp?.leadId || ""],
    enabled: !!opp?.leadId,
  });

  const stageMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const res = await apiRequest("PUT", `/api/pipeline/opportunities/${id}/stage`, { stageId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", id, "activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      toast({ title: "Stage updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PUT", `/api/pipeline/opportunities/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const noteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/pipeline/opportunities/${id}/activities`, {
        type: noteType,
        content: noteContent,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", id, "activities"] });
      setNoteContent("");
      toast({ title: "Activity added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const onboardingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/onboarding/convert-opportunity/${id}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Onboarding created" });
      navigate(`/admin/onboarding/${data.id}`);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Opportunity not found</p>
        <Link href="/admin/pipeline">
          <Button variant="link" className="mt-2">Back to Pipeline</Button>
        </Link>
      </div>
    );
  }

  const currentStage = stages?.find(s => s.id === opp.stageId);

  return (
    <div className="max-w-4xl mx-auto" data-testid="page-opportunity-detail">
      <button
        onClick={() => navigate("/admin/pipeline")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        data-testid="button-back-pipeline"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Pipeline
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-opportunity-title">{opp.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            {currentStage && (
              <Badge style={{ backgroundColor: currentStage.color, color: "white" }} data-testid="badge-current-stage">
                {currentStage.name}
              </Badge>
            )}
            {opp.status !== "open" && (
              <Badge variant={opp.status === "won" ? "default" : "destructive"} data-testid="badge-status">
                {opp.status === "won" ? "Won" : "Lost"}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {opp.status === "open" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => {
                  const wonStage = stages?.find(s => s.slug === "closed-won");
                  if (wonStage) stageMutation.mutate(wonStage.id);
                  else statusMutation.mutate("won");
                }}
                data-testid="button-mark-won"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Mark Won
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => {
                  const lostStage = stages?.find(s => s.slug === "closed-lost");
                  if (lostStage) stageMutation.mutate(lostStage.id);
                  else statusMutation.mutate("lost");
                }}
                data-testid="button-mark-lost"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Mark Lost
              </Button>
            </>
          )}
          {opp.status !== "open" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const defaultStage = stages?.find(s => s.isDefault) || stages?.[0];
                if (defaultStage) {
                  stageMutation.mutate(defaultStage.id);
                  statusMutation.mutate("open");
                }
              }}
              data-testid="button-reopen"
            >
              Reopen
            </Button>
          )}
          {opp.status === "won" && (
            <Button
              size="sm"
              onClick={() => onboardingMutation.mutate()}
              disabled={onboardingMutation.isPending}
              data-testid="button-start-onboarding"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Start Onboarding
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Value</p>
                  <p className="text-sm font-medium flex items-center gap-1" data-testid="text-opp-value">
                    {opp.value ? (
                      <><DollarSign className="w-3.5 h-3.5 text-green-500" />{parseFloat(opp.value).toLocaleString()}</>
                    ) : (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Probability</p>
                  <p className="text-sm font-medium" data-testid="text-opp-probability">
                    {opp.probability !== null && opp.probability !== undefined ? `${opp.probability}%` : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Expected Close</p>
                  <p className="text-sm font-medium flex items-center gap-1" data-testid="text-expected-close">
                    {opp.expectedCloseDate ? (
                      <><Calendar className="w-3.5 h-3.5 text-gray-400" />{new Date(opp.expectedCloseDate).toLocaleDateString()}</>
                    ) : (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Next Action</p>
                  <p className="text-sm font-medium flex items-center gap-1" data-testid="text-next-action">
                    {opp.nextActionDate ? (
                      <><Clock className="w-3.5 h-3.5 text-amber-500" />{new Date(opp.nextActionDate).toLocaleDateString()}</>
                    ) : (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Follow-up</p>
                  <p className="text-sm font-medium" data-testid="text-followup">
                    {opp.followUpDate ? new Date(opp.followUpDate).toLocaleDateString() : <span className="text-gray-400">Not set</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Stage Entered</p>
                  <p className="text-sm font-medium" data-testid="text-stage-entered">
                    {opp.stageEnteredAt ? new Date(opp.stageEnteredAt).toLocaleDateString() : "-"}
                  </p>
                </div>
              </div>

              {stages && opp.status === "open" && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-gray-400 mb-2">Move to Stage</p>
                  <div className="flex flex-wrap gap-1.5">
                    {stages.map(stage => (
                      <Button
                        key={stage.id}
                        size="sm"
                        variant={stage.id === opp.stageId ? "default" : "outline"}
                        className="text-xs h-7"
                        style={stage.id === opp.stageId ? { backgroundColor: stage.color } : { borderColor: stage.color, color: stage.color }}
                        onClick={() => stage.id !== opp.stageId && stageMutation.mutate(stage.id)}
                        disabled={stageMutation.isPending}
                        data-testid={`button-stage-${stage.slug}`}
                      >
                        {stage.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {opp.notes && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{opp.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger className="w-[120px]" data-testid="select-activity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Add activity..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="min-h-[60px]"
                  data-testid="textarea-activity"
                />
                <Button
                  size="sm"
                  onClick={() => noteMutation.mutate()}
                  disabled={!noteContent.trim() || noteMutation.isPending}
                  className="self-end"
                  data-testid="button-add-activity"
                >
                  Add
                </Button>
              </div>

              <div className="space-y-3">
                {(activities || []).map(act => {
                  const Icon = ACTIVITY_ICONS[act.type] || MessageSquare;
                  return (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-3 py-2 border-b border-gray-100 last:border-0"
                      data-testid={`activity-${act.id}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        act.type === "stage_change" ? "bg-blue-100 text-blue-600" :
                        act.type === "system" ? "bg-gray-100 text-gray-500" :
                        act.type === "call" ? "bg-green-100 text-green-600" :
                        act.type === "email" ? "bg-purple-100 text-purple-600" :
                        "bg-amber-100 text-amber-600"
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">{act.content}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(act.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
                {(!activities || activities.length === 0) && (
                  <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {company && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  Company
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/admin/crm/companies/${company.id}`}>
                  <p className="text-sm font-medium text-[#0D9488] hover:underline" data-testid="link-company">
                    {company.name}
                  </p>
                </Link>
                {company.phone && <p className="text-xs text-gray-500 mt-1">{company.phone}</p>}
                {company.email && <p className="text-xs text-gray-500">{company.email}</p>}
              </CardContent>
            </Card>
          )}

          {contact && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <UserIcon className="w-4 h-4 text-gray-400" />
                  Contact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/admin/crm/contacts/${contact.id}`}>
                  <p className="text-sm font-medium text-[#0D9488] hover:underline" data-testid="link-contact">
                    {contact.firstName} {contact.lastName || ""}
                  </p>
                </Link>
                {contact.phone && <p className="text-xs text-gray-500 mt-1">{contact.phone}</p>}
                {contact.email && <p className="text-xs text-gray-500">{contact.email}</p>}
              </CardContent>
            </Card>
          )}

          {sourceLead && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-gray-400" />
                  Source Lead
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/admin/crm/leads/${sourceLead.id}`}>
                  <p className="text-sm font-medium text-[#0D9488] hover:underline" data-testid="link-source-lead">
                    {sourceLead.title}
                  </p>
                </Link>
                {sourceLead.source && (
                  <p className="text-xs text-gray-500 mt-1">Source: {sourceLead.source}</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Created</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600" data-testid="text-created-date">
                {new Date(opp.createdAt).toLocaleDateString("en-US", {
                  weekday: "short", year: "numeric", month: "short", day: "numeric",
                })}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
