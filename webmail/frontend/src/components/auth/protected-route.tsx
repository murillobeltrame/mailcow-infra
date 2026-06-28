import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { PageLoader } from "@/components/layout/page-loader";
import { defaultRouteForRole, type UserRole } from "@/lib/roles";

export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={defaultRouteForRole(user.role)} replace />;
  }
  return children;
}

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={defaultRouteForRole(user.role)} replace />;
  return children;
}
