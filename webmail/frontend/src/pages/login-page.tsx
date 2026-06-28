import { Mail, ShieldCheck, ShieldEllipsis } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/auth-context";
import { LoginSidebar } from "@/components/auth/login-sidebar";
import { BrandMark } from "@/components/brand/brand-logo";
import { PageLoader } from "@/components/layout/page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ApiError } from "@/lib/api";
import { loginWithFido2 } from "@/lib/fido2-login";
import { defaultRouteForRole } from "@/lib/roles";
import { panelUrls } from "@/lib/panel-urls";
import { cn } from "@/lib/utils";

type LoginMode = "user" | "admin" | "domainadmin";

const modeLabels: Record<LoginMode, { title: string; hint: string; loginLabel: string; loginType: string }> = {
  user: {
    title: "Login de usuário",
    hint: "Acesse o webmail com sua caixa de e-mail",
    loginLabel: "Endereço de e-mail",
    loginType: "email",
  },
  admin: {
    title: "Administrador global",
    hint: "Painel Mailcow — domínios, filas e status do host",
    loginLabel: "Usuário",
    loginType: "text",
  },
  domainadmin: {
    title: "Administrador de domínio",
    hint: "Gerencie caixas e aliases do seu domínio",
    loginLabel: "Usuário ou e-mail",
    loginType: "text",
  },
};

export function LoginPage() {
  const { user, loading, login, establishSession } = useAuth();
  const [mode, setMode] = useState<LoginMode>("user");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fidoLoading, setFidoLoading] = useState(false);

  if (loading) return <PageLoader />;
  if (user) return <Navigate to={defaultRouteForRole(user.role)} replace />;

  const meta = modeLabels[mode];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const id = mode === "admin" && !loginId.trim() ? "admin" : loginId.trim();
      await login(id, password);
      toast.success("Bem-vindo!");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível entrar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFido2 = async () => {
    setFidoLoading(true);
    try {
      const sessionUser = await loginWithFido2();
      establishSession(sessionUser);
      toast.success("Autenticado com FIDO2");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na autenticação FIDO2");
    } finally {
      setFidoLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh bg-background">
      <LoginSidebar />

      <div className="relative flex flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <ThemeToggle className="rounded-xl bg-surface shadow-sm" variant="outline" />
        </div>

        <div className="relative flex flex-1 items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md animate-fade-up">
            <div className="mb-6 text-center lg:hidden">
              <div className="mb-4 flex justify-center">
                <BrandMark size="lg" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Nive Mail</h1>
            </div>

            <div className="mb-4 flex rounded-xl border border-border/70 bg-surface p-1">
              {(["user", "domainadmin", "admin"] as LoginMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-2 text-xs font-medium transition sm:text-sm",
                    mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "user" ? "Usuário" : m === "admin" ? "Admin" : "Domínio"}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-soft">
              <div className="border-b border-border/60 px-6 py-4">
                <h2 className="text-base font-semibold">{meta.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{meta.hint}</p>
              </div>

              <div className="p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="login">{meta.loginLabel}</Label>
                    <div className="relative">
                      {mode === "user" ? (
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      ) : (
                        <ShieldEllipsis className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      )}
                      <Input
                        id="login"
                        type={meta.loginType}
                        inputSize="lg"
                        className="rounded-xl pl-10"
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
                        placeholder={mode === "user" ? "voce@empresa.com.br" : mode === "admin" ? "admin" : "admin@dominio.com.br"}
                        required={mode !== "admin"}
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="password">Senha</Label>
                      {mode === "user" && (
                        <a
                          href={panelUrls.resetPassword}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Esqueceu a senha?
                        </a>
                      )}
                    </div>
                    <PasswordInput
                      id="password"
                      inputSize="lg"
                      className="rounded-xl"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <Button type="submit" className="w-full rounded-xl" size="lg" disabled={submitting}>
                    {submitting ? "Entrando…" : "Login"}
                  </Button>
                </form>

                {mode === "user" && (
                  <>
                    <div className="my-6 flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs text-muted-foreground">ou faça login com</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full rounded-xl"
                      size="lg"
                      disabled={fidoLoading}
                      onClick={handleFido2}
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      {fidoLoading ? "Aguardando chave…" : "Login do FIDO2/WebAuthn"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
