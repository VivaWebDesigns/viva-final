import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellRing, Check, CheckCheck, Mail, MailX, MailCheck,
  UserPlus, TrendingUp, Users, ArrowRight, AlertTriangle,
  Filter, Loader2, Inbox, X, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, STALE } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string; group: string }> = {
  new_lead:               { icon: Users,        color: "text-blue-600 bg-blue-50",    label: "New Lead",                group: "CRM" },
  lead_assignment:        { icon: UserPlus,     color: "text-indigo-600 bg-indigo-50", label: "Lead Assigned",          group: "CRM" },
  lead_converted:         { icon: TrendingUp,   color: "text-teal-600 bg-teal-50",    label: "Lead Converted",          group: "Pipeline" },
  stage_change:           { icon: ArrowRight,   color: "text-amber-600 bg-amber-50",  label: "Stage Change",            group: "Pipeline" },
  opportunity_assignment: { icon: UserPlus,     color: "text-emerald-600 bg-emerald-50", label: "Opportunity Assigned", group: "Pipeline" },
  onboarding_assignment:  { icon: UserPlus,     color: "text-teal-600 bg-teal-50",    label: "Onboarding Assigned",     group: "Onboarding" },
  onboarding_status:      { icon: ArrowRight,   color: "text-purple-600 bg-purple-50", label: "Onboarding Status",     group: "Onboarding" },
  system_alert:           { icon: AlertTriangle, color: "text-red-600 bg-red-50",     label: "System Alert",            group: "System" },
};

const EMAIL_STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  sent:    { icon: MailCheck, color: "text-green-600", label: "Email sent" },
  failed:  { icon: MailX,    color: "text-red-600",   label: "Email failed" },
  skipped: { icon: Mail,     color: "text-gray-400",  label: "In-app only" },
  pending: { icon: Mail,     color: "text-amber-500", label: "Email pending" },
};

function getEntityRoute(entityType?: string | null, entityId?: string | null): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "lead":         return `/admin/crm/leads/${entityId}`;
    case "opportunity":  return `/admin/pipeline/opportunities/${entityId}`;
    case "onboarding":   return `/admin/onboarding/${entityId}`;
    case "company":      return `/admin/crm/companies/${entityId}`;
    case "contact":      return `/admin/crm/contacts/${entityId}`;
    default:             return null;
  }
}

function getEntityLabel(entityType?: string | null): string {
  switch (entityType) {
    case "lead":        return "View Lead";
    case "opportunity": return "View Opportunity";
    case "onboarding":  return "View Onboarding";
    case "company":     return "View Company";
    case "contact":     return "View Contact";
    default:            return "View";
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);
  if (d >= todayStart) return "Today";
  if (d >= yesterdayStart) return "Yesterday";
  if (d >= weekStart) return "Earlier This Week";
  return "Older";
}

const DATE_GROUP_ORDER = ["Today", "Yesterday", "Earlier This Week", "Older"];

function groupByDate(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const groups: Record<string, Notification[]> = {};
  for (const n of notifications) {
    const g = getDateGroup(n.createdAt as unknown as string);
    if (!groups[g]) groups[g] = [];
    groups[g].push(n);
  }
  return DATE_GROUP_ORDER.filter((g) => groups[g]?.length > 0).map((g) => ({ label: g, items: groups[g] }));
}

const NOTIFICATIONS_BASE_KEY = "/api/notifications";

function invalidateNotifications() {
  queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_BASE_KEY], exact: false });
  queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
}

export default function NotificationCenterPage() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<string>("all");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const queryParams = new URLSearchParams();
  if (typeFilter !== "all") queryParams.set("type", typeFilter);
  if (readFilter !== "all") queryParams.set("is_read", readFilter === "read" ? "true" : "false");
  queryParams.set("limit", "100");
  const notificationsQueryKey = [NOTIFICATIONS_BASE_KEY, queryParams.toString()];

  const { data, isLoading } = useQuery<{ notifications: Notification[]; total: number }>({
    queryKey: notificationsQueryKey,
    queryFn: async () => {
      const res = await fetch(`/api/notifications?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load notifications");
      return res.json();
    },
    staleTime: STALE.REALTIME,
    refetchInterval: 30_000,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    staleTime: STALE.REALTIME,
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/notifications/${id}/read`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
      const previous = queryClient.getQueryData<{ notifications: Notification[]; total: number }>(notificationsQueryKey);
      queryClient.setQueryData<{ notifications: Notification[]; total: number }>(notificationsQueryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() as any } : n
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _id, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(notificationsQueryKey, ctx.previous);
    },
    onSettled: () => {
      invalidateNotifications();
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/notifications/read-all"),
    onSuccess: () => {
      invalidateNotifications();
      toast({ title: "All notifications marked as read" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/notifications/${id}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
      const previous = queryClient.getQueryData<{ notifications: Notification[]; total: number }>(notificationsQueryKey);
      queryClient.setQueryData<{ notifications: Notification[]; total: number }>(notificationsQueryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.filter((n) => n.id !== id),
          total: old.total - 1,
        };
      });
      return { previous };
    },
    onError: (_err, _id, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(notificationsQueryKey, ctx.previous);
      toast({ title: "Failed to delete notification", variant: "destructive" });
    },
    onSettled: () => {
      invalidateNotifications();
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    const route = getEntityRoute(notification.relatedEntityType, notification.relatedEntityId);
    if (route) navigate(route);
  };

  const notificationList = data?.notifications || [];
  const unreadCount = unreadData?.count || 0;
  const grouped = groupByDate(notificationList);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-notifications-title">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-type-filter">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="new_lead">New Lead</SelectItem>
            <SelectItem value="lead_assignment">Lead Assigned</SelectItem>
            <SelectItem value="lead_converted">Lead Converted</SelectItem>
            <SelectItem value="stage_change">Stage Change</SelectItem>
            <SelectItem value="opportunity_assignment">Opportunity Assigned</SelectItem>
            <SelectItem value="onboarding_assignment">Onboarding Assigned</SelectItem>
            <SelectItem value="onboarding_status">Onboarding Status</SelectItem>
            <SelectItem value="system_alert">System Alert</SelectItem>
          </SelectContent>
        </Select>
        <Select value={readFilter} onValueChange={setReadFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-read-filter">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
        {notificationList.length > 0 && (
          <span className="text-sm text-gray-400 ml-auto">
            {notificationList.length} notification{notificationList.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : notificationList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1" data-testid="text-empty-state">No notifications</h3>
            <p className="text-sm text-gray-500">
              {readFilter === "unread" ? "No unread notifications — you're all caught up!" : "Nothing here yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, items }) => (
            <div key={label}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {label}
              </h2>
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {items.map((notification) => {
                    const typeConf = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system_alert;
                    const emailConf = EMAIL_STATUS_CONFIG[notification.emailStatus || "skipped"];
                    const TypeIcon = typeConf.icon;
                    const EmailIcon = emailConf.icon;
                    const route = getEntityRoute(notification.relatedEntityType, notification.relatedEntityId);

                    return (
                      <motion.div
                        key={notification.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20, height: 0 }}
                      >
                        <Card
                          className={`transition-all group ${
                            !notification.isRead
                              ? "bg-teal-50/40 ring-1 ring-[#0D9488]/20"
                              : "bg-white hover:bg-gray-50/50"
                          }`}
                          data-testid={`notification-item-${notification.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${typeConf.color}`}>
                                <TypeIcon className="w-5 h-5" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className={`text-sm ${!notification.isRead ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                                        {notification.title}
                                      </h3>
                                      {!notification.isRead && (
                                        <span className="w-2 h-2 rounded-full bg-[#0D9488] flex-shrink-0" data-testid={`dot-unread-${notification.id}`} />
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600 mt-0.5 leading-snug">{notification.message}</p>
                                  </div>

                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <span className={emailConf.color} title={emailConf.label}>
                                      <EmailIcon className="w-3.5 h-3.5" />
                                    </span>
                                    {!notification.isRead && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          markReadMutation.mutate(notification.id);
                                        }}
                                        title="Mark as read"
                                        data-testid={`button-mark-read-${notification.id}`}
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteMutation.mutate(notification.id);
                                      }}
                                      title="Dismiss"
                                      data-testid={`button-delete-${notification.id}`}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                                  <Badge variant="secondary" className="text-xs">
                                    {typeConf.label}
                                  </Badge>
                                  <span className="text-xs text-gray-400">
                                    {timeAgo(notification.createdAt as unknown as string)}
                                  </span>
                                  {route && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs text-[#0D9488] hover:text-[#0D9488] hover:bg-teal-50 gap-1 ml-auto"
                                      onClick={() => handleNotificationClick(notification)}
                                      data-testid={`button-view-entity-${notification.id}`}
                                    >
                                      {getEntityLabel(notification.relatedEntityType)}
                                      <ExternalLink className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
