import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext, type LoginMode } from "./auth-context";
import { api } from "@/lib/api";
import type { User } from "@/lib/api";
import { defaultRouteForRole } from "@/lib/roles";

const LOGIN_URL = `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}login`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (loginId: string, password: string, loginAs: LoginMode) => {
      const u = await api.login(loginId, password, loginAs);
      setUser(u);
      navigate(defaultRouteForRole(u.role), { replace: true });
    },
    [navigate],
  );

  const establishSession = useCallback(
    (u: User) => {
      setUser(u);
      navigate(defaultRouteForRole(u.role), { replace: true });
    },
    [navigate],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* encerra localmente mesmo se a rede falhar */
    }
    queryClient.clear();
    setUser(null);
    window.location.replace(`${LOGIN_URL}?logout=${Date.now()}`);
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, loading, login, logout, establishSession }),
    [user, loading, login, logout, establishSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
