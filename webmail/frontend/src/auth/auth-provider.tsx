import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext, type LoginMode } from "./auth-context";
import { ApiError, api, runWithoutUnauthorizedHandler, setUnauthorizedHandler } from "@/lib/api";
import type { User } from "@/lib/api";
import { postLoginRoute } from "@/lib/roles";

const API_BASE = import.meta.env.BASE_URL.replace(/\/?$/, "/");
const LOGIN_URL = `${API_BASE}login`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((user) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.clear();
      setUser(null);
      window.location.replace(LOGIN_URL);
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  const login = useCallback(
    async (loginId: string, password: string, loginAs: LoginMode) => {
      await api.login(loginId, password, loginAs);
      const verified = await runWithoutUnauthorizedHandler(() => api.me());
      if (!verified) {
        throw new ApiError("Não foi possível iniciar a sessão. Tente novamente.", 401);
      }
      setUser(verified);
      navigate(postLoginRoute(verified.role, location.state), { replace: true });
    },
    [navigate, location.state],
  );

  const establishSession = useCallback(
    (u: User) => {
      setUser(u);
      navigate(postLoginRoute(u.role, location.state), { replace: true });
    },
    [navigate, location.state],
  );

  const logout = useCallback(async () => {
    await queryClient.cancelQueries();
    try {
      await runWithoutUnauthorizedHandler(() => api.logout());
    } catch {
      /* cookie pode já ter sido limpo */
    }
    queryClient.clear();
    setUser(null);
    window.location.replace(LOGIN_URL);
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, loading, login, logout, establishSession }),
    [user, loading, login, logout, establishSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
