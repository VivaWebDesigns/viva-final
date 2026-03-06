import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import SEO from "@/components/SEO";
import ScrollToTop from "@/components/ScrollToTop";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import BookDemoButton from "@/components/WhatsAppButton";
import Home from "@/pages/Home";
import { lazy, Suspense } from "react";
import JsonLd from "@/components/JsonLd";
import { PreviewLangProvider } from "@/contexts/PreviewLangContext";
import AdminLayout from "@/layouts/AdminLayout";
import ProtectedRoute from "@features/auth/ProtectedRoute";
import PlaceholderPage from "@features/admin/pages/PlaceholderPage";
import { Users, TrendingUp, UserPlus, MessageSquare, CreditCard, Bell, BarChart3, Settings } from "lucide-react";

const Paquetes = lazy(() => import("@/pages/Paquetes"));
const PaqueteEmpieza = lazy(() => import("@/pages/PaqueteEmpieza"));
const PaqueteCrece = lazy(() => import("@/pages/PaqueteCrece"));
const PaqueteDomina = lazy(() => import("@/pages/PaqueteDomina"));
const Contacto = lazy(() => import("@/pages/Contacto"));
const Demo = lazy(() => import("@/pages/Demo"));
const AdminDemoBuilder = lazy(() => import("@/pages/AdminDemoBuilder"));
const NotFound = lazy(() => import("@/pages/not-found"));
const LoginPage = lazy(() => import("@features/auth/LoginPage"));
const DashboardPage = lazy(() => import("@features/admin/pages/DashboardPage"));
const DocsPage = lazy(() => import("@features/docs/DocsPage"));
const IntegrationsPage = lazy(() => import("@features/integrations/IntegrationsPage"));
const LeadListPage = lazy(() => import("@features/crm/LeadListPage"));
const LeadDetailPage = lazy(() => import("@features/crm/LeadDetailPage"));
const CompanyDetailPage = lazy(() => import("@features/crm/CompanyDetailPage"));
const ContactDetailPage = lazy(() => import("@features/crm/ContactDetailPage"));

function PageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function MarketingRouter() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/paquetes" component={Paquetes} />
        <Route path="/paquetes/empieza" component={PaqueteEmpieza} />
        <Route path="/paquetes/crece" component={PaqueteCrece} />
        <Route path="/paquetes/domina" component={PaqueteDomina} />
        <Route path="/contacto" component={Contacto} />
        <Route path="/demo" component={Demo} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AdminRouter() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<PageFallback />}>
          <Switch>
            <Route path="/admin" component={DashboardPage} />
            <Route path="/admin/crm" component={LeadListPage} />
            <Route path="/admin/crm/leads/:id">
              {(params) => <LeadDetailPage id={params.id} />}
            </Route>
            <Route path="/admin/crm/companies/:id">
              {(params) => <CompanyDetailPage id={params.id} />}
            </Route>
            <Route path="/admin/crm/contacts/:id">
              {(params) => <ContactDetailPage id={params.id} />}
            </Route>
            <Route path="/admin/pipeline">
              <PlaceholderPage title="Sales Pipeline" description="Manage deals and track progress through your sales workflow. Visualize your pipeline stages and forecast revenue." icon={TrendingUp} />
            </Route>
            <Route path="/admin/onboarding">
              <PlaceholderPage title="Client Onboarding" description="Streamlined client setup workflows. Manage onboarding checklists, collect assets, and track project kickoffs." icon={UserPlus} />
            </Route>
            <Route path="/admin/chat">
              <PlaceholderPage title="Team Chat" description="Internal team communication. Real-time messaging for collaboration across projects and tasks." icon={MessageSquare} />
            </Route>
            <Route path="/admin/payments">
              <PlaceholderPage title="Payments" description="Payment processing via Stripe. Manage invoices, subscriptions, and billing for all clients." icon={CreditCard} />
            </Route>
            <Route path="/admin/notifications">
              <PlaceholderPage title="Notifications" description="Email and in-app notifications. Configure alerts for leads, payments, and system events." icon={Bell} />
            </Route>
            <Route path="/admin/integrations">
              <ProtectedRoute roles={["admin", "developer"]}>
                <IntegrationsPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/reports">
              <PlaceholderPage title="Reports" description="Analytics and business intelligence. Track key metrics, generate reports, and monitor performance." icon={BarChart3} />
            </Route>
            <Route path="/admin/settings">
              <ProtectedRoute roles={["admin"]}>
                <PlaceholderPage title="Admin Settings" description="System configuration and user management. Manage roles, permissions, and platform settings." icon={Settings} />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/docs">
              <ProtectedRoute roles={["admin", "developer"]}>
                <DocsPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/demo-builder" component={AdminDemoBuilder} />
          </Switch>
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function App() {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");
  const isLogin = location === "/login";

  if (isLogin) {
    return (
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Suspense fallback={<PageFallback />}>
              <LoginPage />
            </Suspense>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </HelmetProvider>
    );
  }

  if (isAdmin) {
    return (
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AdminRouter />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </HelmetProvider>
    );
  }

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <PreviewLangProvider>
          <TooltipProvider>
            <ScrollToTop />
            <JsonLd />
            <div className="min-h-screen flex flex-col">
              <Navigation />
              <main className="flex-1">
                <MarketingRouter />
              </main>
              <Footer />
            </div>
            <BookDemoButton />
            <Toaster />
          </TooltipProvider>
        </PreviewLangProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
