import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient, STALE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, GripVertical, Save } from "lucide-react";
import type { PipelineStage } from "@shared/schema";
import { useAdminLang } from "@/i18n/LanguageContext";

const COLOR_OPTIONS = [
  "#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444",
  "#EC4899", "#6366F1", "#14B8A6", "#F97316", "#6B7280",
];

interface StageForm {
  name: string;
  slug: string;
  color: string;
  isClosed: boolean;
}

export default function StageManagementPage() {
  const { toast } = useToast();
  const { t } = useAdminLang();
  const [showAdd, setShowAdd] = useState(false);
  const [newStage, setNewStage] = useState<StageForm>({ name: "", slug: "", color: "#3B82F6", isClosed: false });

  const { data: stages, isLoading } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline/stages"],
    staleTime: STALE.NEVER,
  });

  const createMutation = useMutation({
    mutationFn: async (data: StageForm) => {
      const maxSort = (stages || []).reduce((max, s) => Math.max(max, s.sortOrder), -1);
      const res = await apiRequest("POST", "/api/pipeline/stages", {
        ...data,
        sortOrder: maxSort + 1,
        isDefault: false,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/stages"] });
      setShowAdd(false);
      setNewStage({ name: "", slug: "", color: "#3B82F6", isClosed: false });
      toast({ title: t.pipeline.stageCreated });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PipelineStage> }) => {
      const res = await apiRequest("PUT", `/api/pipeline/stages/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/stages"] });
      toast({ title: t.pipeline.stageUpdated });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/pipeline/stages/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/stages"] });
      toast({ title: t.pipeline.stageDeleted });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleNameChange = (name: string) => {
    setNewStage({
      ...newStage,
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto" data-testid="page-stage-management">
      <Link href="/admin/pipeline">
        <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4" data-testid="button-back-pipeline">
          <ArrowLeft className="w-4 h-4" />
          Back to Pipeline
        </button>
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-stages-title">Pipeline Stages</h1>
          <p className="text-sm text-gray-500 mt-1">Configure your sales pipeline stages</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
          data-testid="button-add-stage"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Stage
        </Button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <Card>
              <CardContent className="p-4 space-y-3">
                <Input
                  placeholder="Stage name"
                  value={newStage.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  data-testid="input-new-stage-name"
                />
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-400">Color:</p>
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        newStage.color === color ? "border-gray-800 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewStage({ ...newStage, color })}
                      data-testid={`button-color-${color.slice(1)}`}
                    />
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newStage.isClosed}
                    onChange={(e) => setNewStage({ ...newStage, isClosed: e.target.checked })}
                    data-testid="checkbox-is-closed"
                  />
                  Closed stage (Won/Lost)
                </label>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={() => createMutation.mutate(newStage)}
                    disabled={!newStage.name.trim() || createMutation.isPending}
                    data-testid="button-save-new-stage"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {(stages || []).map((stage, idx) => (
          <motion.div
            key={stage.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card data-testid={`card-stage-${stage.slug}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />

                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: stage.color }}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{stage.name}</p>
                  <p className="text-xs text-gray-400">slug: {stage.slug}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {stage.isDefault && (
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  )}
                  {stage.isClosed && (
                    <Badge variant="outline" className="text-xs">Closed</Badge>
                  )}
                  <span className="text-xs text-gray-400">#{stage.sortOrder}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                    onClick={() => {
                      if (confirm(`Delete stage "${stage.name}"? Opportunities in this stage will lose their stage assignment.`)) {
                        deleteMutation.mutate(stage.id);
                      }
                    }}
                    data-testid={`button-delete-stage-${stage.slug}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {(!stages || stages.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No stages configured. Add your first stage to get started.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
