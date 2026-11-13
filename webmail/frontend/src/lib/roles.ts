export type UserRole = "user" | "domainadmin" | "admin";

export function roleLabel(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Administrador";
    case "domainadmin":
      return "Admin de domínio";
    default:
      return "Usuário";
  }
}

export function defaultRouteForRole(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "domainadmin":
      return "/domain";
    default:
      return "/";
  }
}

/** Depois do login: volta ao link de e-mail pedido (só para caixas de usuário), senão a home do role. */
export function postLoginRoute(role: UserRole, state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  if (role === "user" && typeof from === "string" && (from.startsWith("/folder/") || from === "/compose")) return from;
  return defaultRouteForRole(role);
}
