import { Eye, EyeOff, Lock, Mail, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const { dark, toggle } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Skeleton className="h-96 w-full max-w-md" />
      </div>
    );
  }

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
    <div className="relative flex min-h-dvh">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 z-10"
        onClick={toggle}
        aria-label="Alternar tema"
      >
        {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      <aside className="hidden w-[420px] shrink-0 flex-col justify-between bg-[#1e293b] p-10 text-white lg:flex">
        <div>
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-bold">
              N
            </div>
            <div>
              <p className="text-lg font-semibold">Nive Mail</p>
              <p className="text-sm text-slate-300">E-mail profissional</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight">
            Seu e-mail,
            <br />
            simples e moderno.
          </h2>
          <p className="mt-4 max-w-sm text-slate-300">
            Interface clara para ler, escrever e organizar mensagens — sem complicação.
          </p>
        </div>
        <p className="text-xs text-slate-400">© Nive Sistemas</p>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center lg:text-left">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white lg:hidden">
              <Mail className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Entrar no webmail</h1>
            <p className="mt-2 text-sm text-muted-foreground">Use o e-mail e a senha da sua caixa postal</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Acesso</CardTitle>
              <CardDescription>Ex.: contato@nivesistemas.com.br</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      inputSize="lg"
                      className="pl-10 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
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
