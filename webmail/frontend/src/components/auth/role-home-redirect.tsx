import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { defaultRouteForRole } from "@/lib/roles";

/** Redireciona rotas desconhecidas conforme o role da sessão. */
export function RoleHomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={defaultRouteForRole(user.role)} replace />;
}
