import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
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
const DashboardPage = lazy(() => import("@features/admin/pages/DashboardPage"));
const DocsPage = lazy(() => import("@features/docs/DocsPage"));
const IntegrationsPage = lazy(() => import("@features/integrations/IntegrationsPage"));
const LeadListPage = lazy(() => import("@features/crm/LeadListPage"));
const LeadDetailPage = lazy(() => import("@features/crm/LeadDetailPage"));
const CompanyDetailPage = lazy(() => import("@features/crm/CompanyDetailPage"));
const ContactDetailPage = lazy(() => import("@features/crm/ContactDetailPage"));
const PipelineBoardPage = lazy(() => import("@features/pipeline/PipelineBoardPage"));
const PipelineListPage = lazy(() => import("@features/pipeline/PipelineListPage"));
const OpportunityDetailPage = lazy(() => import("@features/pipeline/OpportunityDetailPage"));
const StageManagementPage = lazy(() => import("@features/pipeline/StageManagementPage"));
const OnboardingListPage = lazy(() => import("@features/onboarding/OnboardingListPage"));
const OnboardingDetailPage = lazy(() => import("@features/onboarding/OnboardingDetailPage"));
const OnboardingWizardPage = lazy(() => import("@features/onboarding/OnboardingWizardPage"));
const ReportsPage = lazy(() => import("@features/reports/ReportsPage"));
const TeamChatPage = lazy(() => import("@features/chat/TeamChatPage"));
const AdminSettingsPage = lazy(() => import("@features/admin/pages/AdminSettingsPage"));
const ClientsPage = lazy(() => import("@features/clients/ClientsPage"));
const ClientProfilePage = lazy(() => import("@features/clients/ClientProfilePage"));
const TasksDueTodayPage = lazy(() => import("@features/tasks/TasksDueTodayPage"));

function PageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AdminRoutes() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<PageFallback />}>
          <Switch>
            <Route path="/admin">
              <ProtectedRoute roles={["admin", "developer", "sales_rep"]} redirectTo="/admin/crm">
                <DashboardPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/crm" component={LeadListPage} />
            <Route path="/admin/crm/leads/:id">
              {(params) => <LeadDetailPage id={params.id} />}
            </Route>
            <Route path="/admin/crm/companies/:id">
              {(params) => <CompanyDetailPage id={params.id} />}
            </Route>
            <Route path="/admin/crm/contacts/:id">
              {(params) => (
                <ProtectedRoute roles={["admin", "developer", "sales_rep"]}>
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
                  <OpportunityDetailPage id={params.id} />
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
                <ProtectedRoute roles={["admin", "developer", "sales_rep"]}>
                  <ClientProfilePage id={params.id} />
                </ProtectedRoute>
              )}
            </Route>
            <Route path="/admin/clients">
              <ProtectedRoute roles={["admin", "developer", "sales_rep"]}>
                <ClientsPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/payments">
              <ProtectedRoute roles={["admin"]}>
                <PaymentsPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/notifications">
              <ProtectedRoute roles={["admin", "developer", "sales_rep"]}>
                <NotificationCenterPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/integrations">
              <ProtectedRoute roles={["admin", "developer"]}>
                <IntegrationsPage />
              </ProtectedRoute>
            </Route>
            <Route path="/admin/reports">
              <ProtectedRoute roles={["admin", "developer"]}>
                <ReportsPage />
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
          </Switch>
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <PreviewLangProvider>
      <ScrollToTop />
      <JsonLd />
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
      <BookDemoButton />
    </PreviewLangProvider>
  );
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AdminLangProvider>
          <TooltipProvider>
            <Switch>
              <Route path="/login">
                <Suspense fallback={<PageFallback />}>
                  <LoginPage />
                </Suspense>
              </Route>

              <Route path="/admin/:rest*">
                <AdminRoutes />
              </Route>

              <Route path="/">
                <MarketingLayout>
                  <Suspense fallback={<PageFallback />}>
                    <Home />
                  </Suspense>
                </MarketingLayout>
              </Route>
              <Route path="/paquetes">
                <MarketingLayout>
                  <Suspense fallback={<PageFallback />}>
                    <Paquetes />
                  </Suspense>
                </MarketingLayout>
              </Route>
              <Route path="/paquetes/empieza">
                <MarketingLayout>
                  <Suspense fallback={<PageFallback />}>
                    <PaqueteEmpieza />
                  </Suspense>
                </MarketingLayout>
              </Route>
              <Route path="/paquetes/crece">
                <MarketingLayout>
                  <Suspense fallback={<PageFallback />}>
                    <PaqueteCrece />
                  </Suspense>
                </MarketingLayout>
              </Route>
              <Route path="/paquetes/domina">
                <MarketingLayout>
                  <Suspense fallback={<PageFallback />}>
                    <PaqueteDomina />
                  </Suspense>
                </MarketingLayout>
              </Route>
              <Route path="/contacto">
                <MarketingLayout>
                  <Suspense fallback={<PageFallback />}>
                    <Contacto />
                  </Suspense>
                </MarketingLayout>
              </Route>
              <Route path="/demo">
                <MarketingLayout>
                  <Suspense fallback={<PageFallback />}>
                    <Demo />
                  </Suspense>
                </MarketingLayout>
              </Route>

              <Route>
                <MarketingLayout>
                  <Suspense fallback={<PageFallback />}>
                    <NotFound />
                  </Suspense>
                </MarketingLayout>
              </Route>
            </Switch>
            <Toaster />
          </TooltipProvider>
        </AdminLangProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
