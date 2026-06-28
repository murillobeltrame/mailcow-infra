import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";

export function AccountPage() {
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [appName, setAppName] = useState("");
  const [appPass, setAppPass] = useState("");
  const [sieveContent, setSieveContent] = useState("");

  const appPwQuery = useQuery({
    queryKey: ["account", "app-passwords"],
    queryFn: () => api.appPasswords().then((r) => r.items),
  });

  const sieveQuery = useQuery({
    queryKey: ["account", "sieve"],
    queryFn: async () => {
      const data = await api.sieve();
      setSieveContent(data.active ?? "");
      return data;
    },
  });

  const changePw = useMutation({
    mutationFn: () => api.changePassword(password, password2),
    onSuccess: () => {
      toast.success("Senha alterada");
      setPassword("");
      setPassword2("");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro"),
  });

  const addAppPw = useMutation({
    mutationFn: () => api.addAppPassword(appName, appPass),
    onSuccess: () => {
      toast.success("Senha de app criada");
      setAppName("");
      setAppPass("");
      qc.invalidateQueries({ queryKey: ["account", "app-passwords"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro"),
  });

  const saveSieve = useMutation({
    mutationFn: () => api.saveSieve("custom", sieveContent),
    onSuccess: () => toast.success("Filtro Sieve salvo"),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Minha conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">Senha, senhas de aplicativo e filtros de e-mail</p>
      </div>

      <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">Alterar senha</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-pw">Nova senha</Label>
            <PasswordInput id="new-pw" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pw2">Confirmar senha</Label>
            <PasswordInput id="new-pw2" value={password2} onChange={(e) => setPassword2(e.target.value)} />
          </div>
          <Button
            className="rounded-xl"
            disabled={!password || password !== password2 || changePw.isPending}
            onClick={() => changePw.mutate()}
          >
            {changePw.isPending && <Loader2 className="animate-spin" />}
            Salvar senha
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">Senhas de aplicativo</h2>
        </div>
        {appPwQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <ul className="mb-4 space-y-2 text-sm">
            {(appPwQuery.data as { app_name?: string; id?: string }[] | undefined)?.map((item) => (
              <li key={item.id ?? item.app_name} className="rounded-lg bg-muted/50 px-3 py-2">
                {item.app_name ?? item.id}
              </li>
            )) ?? <li className="text-muted-foreground">Nenhuma senha de app registrada</li>}
          </ul>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="app-name">Nome do app</Label>
            <Input id="app-name" value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Outlook, Thunderbird…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-pass">Senha do app</Label>
            <PasswordInput id="app-pass" value={appPass} onChange={(e) => setAppPass(e.target.value)} />
          </div>
        </div>
        <Button
          className="mt-4 rounded-xl"
          variant="secondary"
          disabled={!appName || !appPass || addAppPw.isPending}
          onClick={() => addAppPw.mutate()}
        >
          Adicionar senha de app
        </Button>
      </section>

      <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
        <h2 className="mb-4 text-lg font-medium">Filtros Sieve</h2>
        {sieveQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <Textarea
              value={sieveContent}
              onChange={(e) => setSieveContent(e.target.value)}
              className="min-h-[200px] font-mono text-xs"
              placeholder="require [&quot;fileinto&quot;];&#10;if header :contains &quot;subject&quot; &quot;spam&quot; { discard; }"
            />
            <Button
              className="mt-4 rounded-xl"
              disabled={saveSieve.isPending}
              onClick={() => saveSieve.mutate()}
            >
              {saveSieve.isPending && <Loader2 className="animate-spin" />}
              Salvar filtro
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
