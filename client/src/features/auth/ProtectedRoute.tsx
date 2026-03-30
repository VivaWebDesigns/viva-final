import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { Redirect } from "wouter";
import type { Role } from "@shared/schema";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Role[];
  redirectTo?: string;
}

export default function ProtectedRoute({ children, roles, redirectTo }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      fetch("/api/users/setup-status")
        .then((r) => r.json())
        .then((data) => setSetupNeeded(data.needsSetup === true))
        .catch(() => setSetupNeeded(true));
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading || (!isAuthenticated && setupNeeded === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" data-testid="loading-auth">
        <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (setupNeeded) {
      return <Redirect to="/admin/setup" />;
    }
    return <Redirect to="/login" />;
  }

  if (roles && (!role || !roles.includes(role as Role))) {
    if (redirectTo) {
      return <Redirect to={redirectTo} />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" data-testid="access-denied">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
