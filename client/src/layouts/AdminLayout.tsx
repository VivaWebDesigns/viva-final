import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@features/auth/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, TrendingUp, UserPlus, MessageSquare,
  CreditCard, Bell, Puzzle, BarChart3, Settings, BookOpen,
  LogOut, ChevronLeft, ChevronRight, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  path: string;
  icon: any;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "CRM", path: "/admin/crm", icon: Users },
  { label: "Sales Pipeline", path: "/admin/pipeline", icon: TrendingUp },
  { label: "Client Onboarding", path: "/admin/onboarding", icon: UserPlus },
  { label: "Team Chat", path: "/admin/chat", icon: MessageSquare },
  { label: "Payments", path: "/admin/payments", icon: CreditCard },
  { label: "Notifications", path: "/admin/notifications", icon: Bell },
  { label: "Integrations", path: "/admin/integrations", icon: Puzzle, roles: ["admin", "developer"] },
  { label: "Reports", path: "/admin/reports", icon: BarChart3 },
  { label: "Admin", path: "/admin/settings", icon: Settings, roles: ["admin"] },
  { label: "App Docs", path: "/admin/docs", icon: BookOpen, roles: ["admin", "developer"] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut, role } = useAuth();
  const [location, navigate] = useLocation();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count || 0;

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  const isActive = (path: string) => {
    if (path === "/admin") return location === "/admin";
    return location.startsWith(path);
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#0D9488] rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
              <p className="font-semibold text-gray-900 text-sm leading-tight">Viva Web Designs</p>
              <p className="text-xs text-gray-500">Internal Platform</p>
            </motion.div>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link key={item.path} href={item.path}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm ${
                  active
                    ? "bg-[#0D9488]/10 text-[#0D9488] font-medium"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
                onClick={() => setMobileOpen(false)}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-[#0D9488]" : ""}`} />
                {!collapsed && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#0D9488]/20 flex items-center justify-center">
              <span className="text-xs font-medium text-[#0D9488]">
                {user.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{(user as any).role}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-500 hover:text-red-600"
          onClick={signOut}
          data-testid="button-sign-out"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {!collapsed && "Sign Out"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside
        className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-200 ${
          collapsed ? "w-[68px]" : "w-[250px]"
        }`}
      >
        {sidebar}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute bottom-4 -right-3 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm z-10"
          style={{ left: collapsed ? "56px" : "238px" }}
          data-testid="button-toggle-sidebar"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-white z-50 md:hidden shadow-xl"
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
          <button
            className="md:hidden text-gray-600"
            onClick={() => setMobileOpen(true)}
            data-testid="button-mobile-menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin/notifications")}
                data-testid="button-notification-bell"
              >
                <Bell className="w-5 h-5" />
              </Button>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center pointer-events-none" data-testid="badge-unread-count">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
            {user && (
              <span className="text-sm text-gray-500 hidden sm:block">
                {user.name}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
