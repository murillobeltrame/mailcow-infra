import { Lock, Mail } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/auth-context";
import { BrandLogo } from "@/components/brand/brand-logo";
import { PageLoader } from "@/components/layout/page-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ApiError } from "@/lib/api";

export function LoginPage() {
  const { user, loading, login } = useAuth();
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
      toast.success("Bem-vindo ao Nive Mail");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível entrar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh overflow-hidden">
      <ThemeToggle className="absolute right-4 top-4 z-10" />

      <aside className="auth-sidebar hidden w-[min(100%,28rem)] shrink-0 flex-col justify-between p-10 lg:flex">
        <div>
          <BrandLogo size="lg" className="mb-10" />
          <h2 className="text-3xl font-bold leading-tight tracking-tight">
            Seu e-mail,
            <br />
            simples e moderno.
          </h2>
          <p className="mt-4 max-w-sm text-sidebar-muted">
            Interface clara para ler, escrever e organizar mensagens — sem complicação.
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">© Nive Sistemas</p>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
        <div className="w-full max-w-md animate-fade-in space-y-8">
          <div className="text-center lg:text-left">
            <div className="mb-6 flex justify-center lg:hidden">
              <BrandLogo size="md" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Entrar no webmail</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Use o e-mail e a senha da sua caixa postal
            </p>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Acesso</CardTitle>
              <CardDescription>Ex.: contato@nivesistemas.com.br</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      inputSize="lg"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@dominio.com.br"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <PasswordInput
                      id="password"
                      inputSize="lg"
                      className="pl-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? "Entrando…" : "Entrar"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
