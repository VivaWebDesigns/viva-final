import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  developer: "Developer",
  sales_rep: "Sales Rep",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/20",
  developer: "bg-purple-50 text-purple-700 border-purple-200",
  sales_rep: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function AdminSettingsPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("users");
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "sales_rep" });
  const [editRole, setEditRole] = useState("");

  const { data: users = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: auditLogs = [], isLoading: logsLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
    enabled: tab === "audit",
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
      toast({ title: "User created", description: "New team member added successfully." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
      toast({ title: "User updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const TABS = [
    { id: "users", label: "Team Members", icon: Users },
    { id: "audit", label: "Audit Logs", icon: Activity },
  ] as const;

  return (
    <div className="h-full flex flex-col" data-testid="page-admin-settings">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage team members, roles, and platform activity</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? "border-[#0D9488] text-[#0D9488]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              data-testid={`tab-${t.id}`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "users" && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{users.length} team member{users.length !== 1 ? "s" : ""}</p>
            <Button
              onClick={() => setShowAddUser(true)}
              size="sm"
              className="bg-[#0D9488] hover:bg-[#0F766E] text-white"
              data-testid="button-add-user"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Member
            </Button>
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
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Member</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Role</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Joined</th>
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
                            <Ban className="w-3.5 h-3.5" /> Banned
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        {u.id !== (currentUser as any)?.id && (
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
                <p className="text-sm">No audit events recorded yet</p>
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
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                value={newUser.name}
                onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
                placeholder="Jane Smith"
                data-testid="input-new-user-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                placeholder="jane@vivawebdesigns.com"
                data-testid="input-new-user-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Temporary Password</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                placeholder="Min. 8 characters"
                data-testid="input-new-user-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={v => setNewUser(p => ({ ...p, role: v }))}>
                <SelectTrigger data-testid="select-new-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales_rep">Sales Rep</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(newUser)}
              disabled={createMutation.isPending || !newUser.name || !newUser.email || !newUser.password}
              className="bg-[#0D9488] hover:bg-[#0F766E] text-white"
              data-testid="button-create-user"
            >
              {createMutation.isPending ? "Creating..." : "Create Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit {editingUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger data-testid="select-edit-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales_rep">Sales Rep</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">Account Status</p>
                <p className="text-xs text-gray-500">{editingUser?.banned ? "This account is banned" : "Account is active"}</p>
              </div>
              <Button
                variant={editingUser?.banned ? "outline" : "destructive"}
                size="sm"
                onClick={() => updateMutation.mutate({ id: editingUser!.id, updates: { banned: !editingUser?.banned } })}
                data-testid="button-toggle-ban"
              >
                {editingUser?.banned ? "Unban" : "Ban"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button
              onClick={() => updateMutation.mutate({ id: editingUser!.id, updates: { role: editRole } })}
              disabled={updateMutation.isPending}
              className="bg-[#0D9488] hover:bg-[#0F766E] text-white"
              data-testid="button-save-user"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
