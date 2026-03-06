import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellRing, Check, CheckCheck, Mail, MailX, MailCheck,
  UserPlus, TrendingUp, Users, ArrowRight, AlertTriangle,
  Filter, Loader2, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  new_lead: { icon: Users, color: "text-blue-600 bg-blue-50", label: "New Lead" },
  lead_assignment: { icon: UserPlus, color: "text-indigo-600 bg-indigo-50", label: "Lead Assignment" },
  stage_change: { icon: TrendingUp, color: "text-amber-600 bg-amber-50", label: "Stage Change" },
  opportunity_assignment: { icon: TrendingUp, color: "text-emerald-600 bg-emerald-50", label: "Opportunity Assignment" },
  onboarding_assignment: { icon: UserPlus, color: "text-teal-600 bg-teal-50", label: "Onboarding Assignment" },
  onboarding_status: { icon: ArrowRight, color: "text-purple-600 bg-purple-50", label: "Onboarding Status" },
  system_alert: { icon: AlertTriangle, color: "text-red-600 bg-red-50", label: "System Alert" },
};

const EMAIL_STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  sent: { icon: MailCheck, color: "text-green-600", label: "Email Sent" },
  failed: { icon: MailX, color: "text-red-600", label: "Email Failed" },
  skipped: { icon: Mail, color: "text-gray-400", label: "No Email" },
  pending: { icon: Mail, color: "text-amber-500", label: "Email Pending" },
};

function getEntityRoute(entityType?: string | null, entityId?: string | null): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "lead": return `/admin/crm/leads/${entityId}`;
    case "opportunity": return `/admin/pipeline/opportunities/${entityId}`;
    case "onboarding": return `/admin/onboarding/${entityId}`;
    case "company": return `/admin/crm/companies/${entityId}`;
    case "contact": return `/admin/crm/contacts/${entityId}`;
    default: return null;
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

export default function NotificationCenterPage() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<string>("all");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const queryParams = new URLSearchParams();
  if (typeFilter !== "all") queryParams.set("type", typeFilter);
  if (readFilter !== "all") queryParams.set("is_read", readFilter === "read" ? "true" : "false");
  queryParams.set("limit", "100");
  const notificationsQueryKey = `/api/notifications?${queryParams.toString()}`;

  const { data, isLoading } = useQuery<{ notifications: Notification[]; total: number }>({
    queryKey: [notificationsQueryKey],
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: [notificationsQueryKey] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
  };

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/notifications/${id}/read`),
    onSuccess: invalidateAll,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/notifications/read-all"),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "All notifications marked as read" });
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

      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="new_lead">New Lead</SelectItem>
            <SelectItem value="lead_assignment">Lead Assignment</SelectItem>
            <SelectItem value="stage_change">Stage Change</SelectItem>
            <SelectItem value="opportunity_assignment">Opportunity Assignment</SelectItem>
            <SelectItem value="onboarding_assignment">Onboarding Assignment</SelectItem>
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
            <p className="text-sm text-gray-500">You're all caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {notificationList.map((notification) => {
              const typeConf = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system_alert;
              const emailConf = EMAIL_STATUS_CONFIG[notification.emailStatus || "skipped"];
              const TypeIcon = typeConf.icon;
              const EmailIcon = emailConf.icon;
              const route = getEntityRoute(notification.relatedEntityType, notification.relatedEntityId);

              return (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Card
                    className={`cursor-pointer transition-all ${
                      !notification.isRead ? "bg-teal-50/30 ring-1 ring-[#0D9488]/20" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                    data-testid={`notification-item-${notification.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${typeConf.color}`}>
                          <TypeIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className={`text-sm ${!notification.isRead ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                                  {notification.title}
                                </h3>
                                {!notification.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-[#0D9488] flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-0.5">{notification.message}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`${emailConf.color}`} title={emailConf.label}>
                                <EmailIcon className="w-4 h-4" />
                              </span>
                              {!notification.isRead && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markReadMutation.mutate(notification.id);
                                  }}
                                  title="Mark as read"
                                  data-testid={`button-mark-read-${notification.id}`}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {typeConf.label}
                            </Badge>
                            <span className="text-xs text-gray-400">
                              {timeAgo(notification.createdAt as unknown as string)}
                            </span>
                            {route && (
                              <span className="text-xs text-[#0D9488] flex items-center gap-0.5">
                                View {notification.relatedEntityType}
                                <ArrowRight className="w-3 h-3" />
                              </span>
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
      )}
    </div>
  );
}
