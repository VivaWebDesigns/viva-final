import { Switch, Route, Redirect, useLocation } from "wouter";
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
import { AdminLangProvider } from "@/i18n/LanguageContext";
import AdminLayout from "@/layouts/AdminLayout";
import ProtectedRoute from "@features/auth/ProtectedRoute";
import NotificationCenterPage from "@features/notifications/NotificationCenterPage";
const PaymentsPage = lazy(() => import("@features/admin/pages/PaymentsPage"));

const Paquetes = lazy(() => import("@/pages/Paquetes"));
const PaqueteEmpieza = lazy(() => import("@/pages/PaqueteEmpieza"));
const PaqueteCrece = lazy(() => import("@/pages/PaqueteCrece"));
const PaqueteDomina = lazy(() => import("@/pages/PaqueteDomina"));
const Contacto = lazy(() => import("@/pages/Contacto"));
const Demo = lazy(() => import("@/pages/Demo"));
const AdminDemoBuilder = lazy(() => import("@/pages/AdminDemoBuilder"));
const NotFound = lazy(() => import("@/pages/not-found"));
const LoginPage = lazy(() => import("@features/auth/LoginPage"));
const SetupPage = lazy(() => import("@features/auth/SetupPage"));
const DashboardPage = lazy(() => import("@features/admin/pages/DashboardPage"));
const DocsPage = lazy(() => import("@features/docs/DocsPage"));
const LeadListPage = lazy(() => import("@features/crm/LeadListPage"));
const LeadProfilePage = lazy(() => import("@features/profiles/LeadProfilePage"));
const CompanyDetailPage = lazy(() => import("@features/crm/CompanyDetailPage"));
const ContactDetailPage = lazy(() => import("@features/crm/ContactDetailPage"));
const PipelineBoardPage = lazy(() => import("@features/pipeline/PipelineBoardPage"));
const PipelineListPage = lazy(() => import("@features/pipeline/PipelineListPage"));
const OpportunityProfilePage = lazy(() => import("@features/profiles/OpportunityProfilePage"));
const StageManagementPage = lazy(() => import("@features/pipeline/StageManagementPage"));
const OnboardingListPage = lazy(() => import("@features/onboarding/OnboardingListPage"));
const OnboardingDetailPage = lazy(() => import("@features/onboarding/OnboardingDetailPage"));
const OnboardingWizardPage = lazy(() => import("@features/onboarding/OnboardingWizardPage"));
const ReportsPage = lazy(() => import("@features/reports/ReportsPage"));
const CrmActivityPage = lazy(() => import("@features/crm-activity/CrmActivityPage"));
const TeamChatPage = lazy(() => import("@features/chat/TeamChatPage"));
const AdminSettingsPage = lazy(() => import("@features/admin/pages/AdminSettingsPage"));
const ClientsPage = lazy(() => import("@features/clients/ClientsPage"));
const ClientProfilePage = lazy(() => import("@features/profiles/ClientProfilePage"));
const TasksDueTodayPage = lazy(() => import("@features/tasks/TasksDueTodayPage"));
const MarketplacePendingOutreachPage = lazy(() => import("@features/marketplace/MarketplacePendingOutreachPage"));
const LeadGenIntelligencePage = lazy(() => import("@features/marketplace/LeadGenIntelligencePage"));

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
            <Route path="/admin">
              <ProtectedRoute roles={["admin", "developer"]} redirectTo="/admin/pipeline">
                <DashboardPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/crm">
              <ProtectedRoute roles={["admin", "developer"]} redirectTo="/admin/pipeline">
                <LeadListPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/crm/leads/:id">
              {(params) => (
                <ProtectedRoute roles={["admin", "developer"]} redirectTo="/admin/pipeline">
                  <LeadProfilePage id={params.id} />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/crm/companies/:id">
              {(params) => (
                <ProtectedRoute roles={["admin", "developer"]} redirectTo="/admin/pipeline">
                  <CompanyDetailPage id={params.id} />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/crm/contacts/:id">
              {(params) => (
                <ProtectedRoute roles={["admin", "developer"]} redirectTo="/admin/pipeline">
                  <ContactDetailPage id={params.id} />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/pipeline">
              <ProtectedRoute roles={["admin", "developer", "sales_rep"]}>
                <PipelineBoardPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/pipeline/list">
              <ProtectedRoute roles={["admin", "developer", "sales_rep"]}>
                <PipelineListPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/pipeline/opportunities/:id">
              {(params) => (
                <ProtectedRoute roles={["admin", "developer", "sales_rep"]}>
                  <OpportunityProfilePage id={params.id} />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/pipeline/stages">
              <ProtectedRoute roles={["admin", "developer"]}>
                <StageManagementPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/onboarding">
              <ProtectedRoute roles={["admin", "developer"]}>
                <OnboardingListPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/onboarding/new">
              <ProtectedRoute roles={["admin", "developer"]}>
                <OnboardingWizardPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/onboarding/:id">
              {(params) => (
                <ProtectedRoute roles={["admin", "developer"]}>
                  <OnboardingDetailPage id={params.id} />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/tasks">
              <ProtectedRoute roles={["admin", "developer", "sales_rep"]}>
                <TasksDueTodayPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/chat">
              <ProtectedRoute roles={["admin", "developer", "sales_rep"]}>
                <TeamChatPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/clients/:id">
              {(params) => (
                <ProtectedRoute roles={["admin", "developer"]} redirectTo="/admin/pipeline">
                  <ClientProfilePage id={params.id} />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/clients">
              <ProtectedRoute roles={["admin", "developer"]} redirectTo="/admin/pipeline">
                <ClientsPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/payments">
              <ProtectedRoute roles={["admin"]}>
                <PaymentsPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/notifications">
              <ProtectedRoute roles={["admin", "developer"]} redirectTo="/admin/pipeline">
                <NotificationCenterPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/integrations">
              <Redirect to="/admin/settings" />
            </Route>
            <Route path="/admin/reports">
              <ProtectedRoute roles={["admin", "developer"]}>
                <ReportsPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/activity">
              <ProtectedRoute roles={["admin", "developer"]}>
                <CrmActivityPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/lead-gen">
              <ProtectedRoute roles={["admin", "developer"]}>
                <LeadGenIntelligencePage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/settings">
              <ProtectedRoute roles={["admin", "developer"]}>
                <AdminSettingsPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/docs">
              <ProtectedRoute roles={["admin", "developer"]}>
                <DocsPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/demo-builder">
              <ProtectedRoute roles={["admin", "developer"]}>
                <AdminDemoBuilder />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/marketplace">
              <ProtectedRoute roles={["admin", "developer"]}>
                <MarketplacePendingOutreachPage />
              </ProtectedRoute>
            </Route>
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
  const isSetup = location === "/admin/setup";

  if (isSetup) {
    return (
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Suspense fallback={<PageFallback />}>
              <SetupPage />
            </Suspense>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </HelmetProvider>
    );
  }

  if (isLogin) {
    return (
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <AdminLangProvider>
            <TooltipProvider>
              <Suspense fallback={<PageFallback />}>
                <LoginPage />
              </Suspense>
              <Toaster />
            </TooltipProvider>
          </AdminLangProvider>
        </QueryClientProvider>
      </HelmetProvider>
    );
  }

  if (isAdmin) {
    return (
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <AdminLangProvider>
            <TooltipProvider>
              <AdminRouter />
              <Toaster />
            </TooltipProvider>
          </AdminLangProvider>
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
