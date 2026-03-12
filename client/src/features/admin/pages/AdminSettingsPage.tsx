import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, STALE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@features/auth/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Settings, Users, Shield, Activity, Plus, Edit2, Ban, CheckCircle2,
  Clock, AlertCircle,
} from "lucide-react";
import { useAdminLang } from "@/i18n/LanguageContext";

type Tab = "users" | "audit";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  createdAt: string;
}

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/20",
  developer: "bg-purple-50 text-purple-700 border-purple-200",
  sales_rep: "bg-blue-50 text-blue-700 border-blue-200",
  lead_gen: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function AdminSettingsPage() {
  const { t } = useAdminLang();
  const { user: currentUser, role: authRole } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("users");
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "sales_rep" });
  const [editRole, setEditRole] = useState("");

  const { data: users = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    staleTime: STALE.FAST,
  });

  const { data: auditLogs = [], isLoading: logsLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
    enabled: tab === "audit",
    staleTime: STALE.FAST,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newUser) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowAddUser(false);
      setNewUser({ name: "", email: "", password: "", role: "sales_rep" });
      toast({ title: t.settings.userCreatedTitle, description: t.settings.userCreated });
    },
    onError: (err: Error) => toast({ title: t.common.error, description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
      toast({ title: t.settings.userUpdatedTitle });
    },
    onError: (err: Error) => toast({ title: t.common.error, description: err.message, variant: "destructive" }),
  });

  const ROLE_LABELS = t.settings.roles as Record<string, string>;

  const TABS = [
    { id: "users" as Tab, label: t.settings.teamMembers, icon: Users },
    { id: "audit" as Tab, label: t.settings.auditLogs, icon: Activity },
  ];

  return (
    <div className="h-full flex flex-col" data-testid="page-admin-settings">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.settings.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.common.settings}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(tabItem => {
          const Icon = tabItem.icon;
          return (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === tabItem.id
                  ? "border-[#0D9488] text-[#0D9488]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              data-testid={`tab-${tabItem.id}`}
            >
              <Icon className="w-4 h-4" />
              {tabItem.label}
            </button>
          );
        })}
      </div>

      {tab === "users" && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{users.length} {t.settings.teamMembers.toLowerCase()}</p>
            {authRole === "admin" && (
              <Button
                onClick={() => setShowAddUser(true)}
                size="sm"
                className="bg-[#0D9488] hover:bg-[#0F766E] text-white"
                data-testid="button-add-user"
              >
                <Plus className="w-4 h-4 mr-1" />
                {t.settings.createMember}
              </Button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {usersLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{t.common.name}</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{t.settings.roleLabel}</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{t.common.status}</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{t.common.joined}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors" data-testid={`row-user-${u.id}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#0D9488]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-[#0D9488]">
                              {u.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{u.name}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${ROLE_COLORS[u.role] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          <Shield className="w-3 h-3 mr-1" />
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.banned ? (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <Ban className="w-3.5 h-3.5" /> {t.settings.ban}ned
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t.common.active}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        {authRole === "admin" && u.id !== (currentUser as any)?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingUser(u); setEditRole(u.role); }}
                            className="text-gray-400 hover:text-gray-700"
                            data-testid={`button-edit-user-${u.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {logsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t.common.noData}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {auditLogs.map(log => (
                  <div key={log.id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50/50" data-testid={`row-audit-${log.id}`}>
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{log.action.replace(/_/g, " ")}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5">{log.entity}</Badge>
                        {log.entityId && (
                          <span className="text-xs text-gray-400 font-mono truncate max-w-[140px]">{log.entityId}</span>
                        )}
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(log.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.settings.newMemberTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t.settings.nameLabel}</Label>
              <Input
                value={newUser.name}
                onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
                placeholder={t.settings.namePlaceholder}
                data-testid="input-new-user-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.settings.emailLabel}</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                placeholder={t.settings.emailPlaceholder}
                data-testid="input-new-user-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.settings.passwordLabel}</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                placeholder={t.settings.passwordPlaceholder}
                data-testid="input-new-user-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.settings.roleLabel}</Label>
              <Select value={newUser.role} onValueChange={v => setNewUser(p => ({ ...p, role: v }))}>
                <SelectTrigger data-testid="select-new-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales_rep">{t.settings.roles.sales_rep}</SelectItem>
                  <SelectItem value="developer">{t.settings.roles.developer}</SelectItem>
                  <SelectItem value="admin">{t.settings.roles.admin}</SelectItem>
                  <SelectItem value="lead_gen">{t.settings.roles.lead_gen}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)}>{t.settings.cancel}</Button>
            <Button
              onClick={() => createMutation.mutate(newUser)}
              disabled={createMutation.isPending || !newUser.name || !newUser.email || !newUser.password}
              className="bg-[#0D9488] hover:bg-[#0F766E] text-white"
              data-testid="button-create-user"
            >
              {createMutation.isPending ? t.settings.creating : t.settings.createMember}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.settings.editMember.replace("{{name}}", editingUser?.name ?? "")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t.settings.roleLabel}</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger data-testid="select-edit-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales_rep">{t.settings.roles.sales_rep}</SelectItem>
                  <SelectItem value="developer">{t.settings.roles.developer}</SelectItem>
                  <SelectItem value="admin">{t.settings.roles.admin}</SelectItem>
                  <SelectItem value="lead_gen">{t.settings.roles.lead_gen}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{t.settings.accountStatus}</p>
                <p className="text-xs text-gray-500">{editingUser?.banned ? t.settings.accountBanned : t.settings.accountActive}</p>
              </div>
              <Button
                variant={editingUser?.banned ? "outline" : "destructive"}
                size="sm"
                onClick={() => updateMutation.mutate({ id: editingUser!.id, updates: { banned: !editingUser?.banned } })}
                data-testid="button-toggle-ban"
              >
                {editingUser?.banned ? t.settings.unban : t.settings.ban}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>{t.settings.cancel}</Button>
            <Button
              onClick={() => updateMutation.mutate({ id: editingUser!.id, updates: { role: editRole } })}
              disabled={updateMutation.isPending}
              className="bg-[#0D9488] hover:bg-[#0F766E] text-white"
              data-testid="button-save-user"
            >
              {t.settings.saveChanges}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
