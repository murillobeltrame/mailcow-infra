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
