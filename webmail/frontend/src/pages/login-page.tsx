import { Mail, Settings2 } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/auth-context";
import { BrandMark } from "@/components/brand/brand-logo";
import { PageLoader } from "@/components/layout/page-loader";
import { PanelLinks } from "@/components/portal/panel-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type LoginMode = "webmail" | "panel";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const [mode, setMode] = useState<LoginMode>("webmail");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success("Bem-vindo!");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível entrar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <ThemeToggle className="absolute right-4 top-4 z-10 rounded-xl bg-surface shadow-sm" variant="outline" />

      <div className="relative w-full max-w-[480px] animate-fade-up">
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <BrandMark size="lg" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Nive Mail</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "webmail" ? "Leia e envie e-mails" : "Administração e contas"}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setMode("webmail")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              mode === "webmail"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Mail className="h-4 w-4" />
            Webmail
          </button>
          <button
            type="button"
            onClick={() => setMode("panel")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              mode === "panel"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings2 className="h-4 w-4" />
            Painel
          </button>
        </div>

        <div className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft sm:p-8">
          {mode === "webmail" ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    inputSize="lg"
                    className="rounded-xl pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@empresa.com.br"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
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
                {submitting ? "Entrando…" : "Entrar no webmail"}
              </Button>
            </form>
          ) : (
            <PanelLinks compact />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">© Nive Sistemas</p>
      </div>
    </div>
  );
}
