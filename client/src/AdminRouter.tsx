import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import AdminLayout from "@/layouts/AdminLayout";
import ProtectedRoute from "@features/auth/ProtectedRoute";

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
const LeadCoverageMapPage = lazy(() => import("@features/marketplace/LeadCoverageMapPage"));
const PaymentsPage = lazy(() => import("@features/admin/pages/PaymentsPage"));
const NotificationCenterPage = lazy(() => import("@features/notifications/NotificationCenterPage"));
const AdminDemoBuilder = lazy(() => import("@/pages/AdminDemoBuilder"));

function AdminPageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AdminRouter() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<AdminPageFallback />}>
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
            <Route path="/admin/lead-coverage">
              <ProtectedRoute roles={["admin", "developer"]}>
                <LeadCoverageMapPage />
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
