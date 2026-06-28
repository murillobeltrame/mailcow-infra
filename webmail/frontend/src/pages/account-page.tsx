import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, KeyRound, Loader2, Mail, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/auth-context";
import { PanelLinks } from "@/components/portal/panel-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api, type MailboxProfile } from "@/lib/api";
import { panelUrls } from "@/lib/panel-urls";

function formatQuota(profile: MailboxProfile): string {
  const used = profile.quota_used ?? 0;
  const quota = profile.quota ?? 0;
  if (!quota || quota === 0) return `${used} MB usados · quota ilimitada`;
  const pct = profile.percent_in_use?.trim();
  return `${used} / ${quota} MB${pct && pct !== "-" ? ` (${pct})` : ""}`;
}

export function AccountPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [appName, setAppName] = useState("");
  const [appPass, setAppPass] = useState("");
  const [sieveContent, setSieveContent] = useState("");

  const profileQuery = useQuery({
    queryKey: ["account", "profile"],
    queryFn: () => api.accountProfile().then((r) => r.profile),
  });

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

  const removeAppPw = useMutation({
    mutationFn: (id: string) => api.deleteAppPassword(id),
    onSuccess: () => {
      toast.success("Senha de app removida");
      qc.invalidateQueries({ queryKey: ["account", "app-passwords"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro"),
  });

  const saveSieve = useMutation({
    mutationFn: () => api.saveSieve("custom", sieveContent),
    onSuccess: () => toast.success("Filtro Sieve salvo"),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro"),
  });

  const profile = profileQuery.data;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Minha conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Equivalente ao painel <strong>/user</strong> do Mailcow — configurações da sua caixa postal.
        </p>
      </div>

      <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Caixa postal</p>
            <p className="text-lg font-semibold">{user?.email ?? profile?.username}</p>
            {profile?.name && <p className="text-sm text-muted-foreground">{profile.name}</p>}
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            <Mail className="h-4 w-4" />
            Abrir webmail
          </Link>
        </div>

        {profileQuery.isLoading ? (
          <Skeleton className="mt-4 h-16 w-full" />
        ) : profile ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-4 py-3">
              <HardDrive className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Espaço da caixa</p>
                <p className="text-sm font-medium">{formatQuota(profile)}</p>
              </div>
            </div>
            <div className="rounded-xl bg-muted/40 px-4 py-3">
              <p className="text-xs text-muted-foreground">Mensagens</p>
              <p className="text-sm font-medium">{profile.messages ?? 0}</p>
            </div>
            {profile.attributes?.quarantine_category && (
              <div className="rounded-xl bg-muted/40 px-4 py-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Quarentena</p>
                <p className="text-sm font-medium">
                  {profile.attributes.quarantine_category} · notificação{" "}
                  {profile.attributes.quarantine_notification ?? "—"}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
        <h2 className="mb-1 text-lg font-medium">Atalhos do portal</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          No Mailcow, após login de usuário você caía no painel /user com links para webmail e ferramentas.
        </p>
        <PanelLinks compact />
      </section>

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
              <li
                key={item.id ?? item.app_name}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
              >
                <span>{item.app_name ?? item.id}</span>
                {item.id && (
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remover"
                    onClick={() => removeAppPw.mutate(item.id!)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            )) ?? <li className="text-muted-foreground">Nenhuma senha de app registrada</li>}
          </ul>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="app-name">Nome do app</Label>
            <Input
              id="app-name"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Outlook, Thunderbird…"
            />
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
              placeholder={'require ["fileinto"];\nif header :contains "subject" "spam" { discard; }'}
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

      <p className="text-center text-xs text-muted-foreground">
        Recursos avançados (FIDO2, TFA, aliases temporários) ainda disponíveis no painel legado{" "}
        <a href={panelUrls.user} className="text-primary underline-offset-2 hover:underline">
          /user
        </a>
        .
      </p>
    </div>
  );
}
