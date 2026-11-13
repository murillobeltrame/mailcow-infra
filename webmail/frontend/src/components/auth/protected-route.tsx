import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { PageLoader } from "@/components/layout/page-loader";
import { defaultRouteForRole, postLoginRoute, type UserRole } from "@/lib/roles";

export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  // Guarda o link pedido (ex.: e-mail aberto) para voltar a ele depois do login.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={defaultRouteForRole(user.role)} replace />;
  }
  return children;
}

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={postLoginRoute(user.role, location.state)} replace />;
  return children;
}
