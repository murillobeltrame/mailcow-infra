import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/auth-context";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { defaultRouteForRole, roleLabel, type UserRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; roles: UserRole[] };

const nav: NavItem[] = [
  { to: "/", label: "E-mail", roles: ["user"] },
  { to: "/account", label: "Minha conta", roles: ["user"] },
  { to: "/calendar", label: "Calendário", roles: ["user"] },
  { to: "/contacts", label: "Contactos", roles: ["user"] },
  { to: "/admin", label: "Administração", roles: ["admin"] },
  { to: "/domain", label: "Domínios e caixas", roles: ["domainadmin"] },
  { to: "/domain", label: "Caixas por domínio", roles: ["admin"] },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const items = nav.filter((n) => n.roles.includes(user.role));

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Sessão encerrada");
      navigate("/login", { replace: true });
    } catch {
      toast.error("Erro ao sair");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex shrink-0 items-center gap-4 border-b border-border/70 bg-surface px-4 py-3">
        <BrandLogo />
        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {items.map((item) => (
            <NavLink
              key={`${item.to}-${item.label}`}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {user.email} · {roleLabel(user.role)}
          </span>
          <ThemeToggle variant="outline" className="rounded-xl" />
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Sair
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export { defaultRouteForRole };
