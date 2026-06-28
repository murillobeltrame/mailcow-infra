import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Cpu, HardDrive, Plus, Server, Timer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api, type AdminDashboard } from "@/lib/api";
import { asArray } from "@/lib/utils";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Server;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

type DomainRow = { domain_name?: string; active?: string };

export function AdminPage() {
  const qc = useQueryClient();
  const [newDomain, setNewDomain] = useState("");
  const [mbDomain, setMbDomain] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [mbName, setMbName] = useState("");
  const [mbPassword, setMbPassword] = useState("");

  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.hostStatus(),
  });

  const domainsQuery = useQuery({
    queryKey: ["admin", "domains"],
    queryFn: () => api.adminDomains().then((r) => r.domains as DomainRow[]),
  });

  const mailboxesQuery = useQuery({
    queryKey: ["admin", "mailboxes", mbDomain],
    queryFn: () => api.adminMailboxes(mbDomain || undefined).then((r) => r.mailboxes),
    enabled: !!mbDomain,
  });

  const addDomain = useMutation({
    mutationFn: () => api.adminCreateDomain(newDomain.trim().toLowerCase()),
    onSuccess: () => {
      toast.success("Domínio registrado");
      setNewDomain("");
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro ao registrar domínio"),
  });

  const addMailbox = useMutation({
    mutationFn: () =>
      api.adminCreateMailbox({
        local_part: localPart.trim(),
        domain: mbDomain,
        name: mbName.trim() || localPart.trim(),
        password: mbPassword,
      }),
    onSuccess: () => {
      toast.success("Caixa postal criada");
      setLocalPart("");
      setMbName("");
      setMbPassword("");
      qc.invalidateQueries({ queryKey: ["admin", "mailboxes", mbDomain] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro ao criar caixa"),
  });

  const dash = dashboardQuery.data as AdminDashboard | undefined;
  const domains = asArray<DomainRow>(domainsQuery.data);
  const mailboxes = asArray<{ username?: string; name?: string; quota_used?: string; quota?: string }>(
    mailboxesQuery.data,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administração global</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Equivalente ao painel <strong>/admin</strong> do Mailcow — RAM, disco, containers, domínios e caixas.
        </p>
      </div>

      {dashboardQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : dash ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Memória RAM"
              value={`${dash.memory.usedLabel} / ${dash.memory.totalLabel}`}
              sub={`${dash.memory.usagePercent.toFixed(1)}% em uso`}
              icon={Activity}
            />
            <StatCard
              label="Disco (vmail)"
              value={`${dash.disk.used} / ${dash.disk.total}`}
              sub={dash.disk.usedPercent !== "—" ? `${dash.disk.usedPercent} usado` : undefined}
              icon={HardDrive}
            />
            <StatCard
              label="CPU"
              value={`${dash.cpu.usagePercent.toFixed(1)}%`}
              sub={`${dash.cpu.cores} núcleos`}
              icon={Cpu}
            />
            <StatCard
              label="Containers"
              value={`${dash.containersRunning} / ${dash.containersTotal}`}
              sub={`Mailcow ${dash.version}`}
              icon={Server}
            />
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Timer className="h-4 w-4" />
              Uptime: {dash.uptime}
            </span>
            <span>Horário do servidor: {dash.systemTime}</span>
            <span>Arquitetura: {dash.architecture}</span>
            {dash.disk.device && <span>Volume: {dash.disk.device}</span>}
          </div>

          <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
            <h2 className="mb-4 text-lg font-medium">Containers Docker</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Nome</th>
                    <th className="pb-2 pr-4 font-medium">Estado</th>
                    <th className="pb-2 font-medium">Imagem</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.containers.map((c) => (
                    <tr key={c.name} className="border-b border-border/40">
                      <td className="py-2 pr-4 font-mono text-xs">{c.name}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={
                            c.state === "running"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          }
                        >
                          {c.state}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{c.image ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <p className="text-sm text-destructive">Não foi possível carregar o status do servidor.</p>
      )}

      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-soft">
        <h2 className="text-lg font-medium">Registrar novo domínio de e-mail</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No Mailcow, só o <strong>administrador global</strong> pode adicionar domínios. Após registrar,
          configure DNS (MX, SPF, DKIM) no Cloudflare.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1 space-y-2">
            <Label htmlFor="new-domain">Nome do domínio</Label>
            <Input
              id="new-domain"
              placeholder="empresa.com.br"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
            />
          </div>
          <Button
            className="rounded-xl"
            disabled={!newDomain.trim() || addDomain.isPending}
            onClick={() => addDomain.mutate()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar domínio
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
        <h2 className="mb-4 text-lg font-medium">Domínios existentes ({domains.length})</h2>
        {domainsQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Domínio</th>
                  <th className="pb-2 font-medium">Ativo</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((d) => (
                  <tr key={d.domain_name} className="border-b border-border/40">
                    <td className="py-2 pr-4">{d.domain_name}</td>
                    <td className="py-2">{d.active === "1" ? "Sim" : "Não"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
        <h2 className="mb-2 text-lg font-medium">Nova caixa postal</h2>
        <p className="mb-4 text-sm text-muted-foreground">Crie mailboxes em qualquer domínio do servidor.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mb-domain">Domínio</Label>
            <select
              id="mb-domain"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              value={mbDomain}
              onChange={(e) => setMbDomain(e.target.value)}
            >
              <option value="">Selecione…</option>
              {domains.map((d) => (
                <option key={d.domain_name} value={d.domain_name}>
                  {d.domain_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="local-part">Parte local (antes do @)</Label>
            <Input
              id="local-part"
              placeholder="contato"
              value={localPart}
              onChange={(e) => setLocalPart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mb-name">Nome exibido</Label>
            <Input id="mb-name" value={mbName} onChange={(e) => setMbName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mb-pass">Senha</Label>
            <PasswordInput id="mb-pass" value={mbPassword} onChange={(e) => setMbPassword(e.target.value)} />
          </div>
        </div>
        <Button
          className="mt-4 rounded-xl"
          disabled={!mbDomain || !localPart || !mbPassword || addMailbox.isPending}
          onClick={() => addMailbox.mutate()}
        >
          <Plus className="mr-2 h-4 w-4" />
          Criar caixa
        </Button>

        {mbDomain && (
          <div className="mt-8 overflow-x-auto">
            <h3 className="mb-3 text-sm font-medium">Caixas em {mbDomain}</h3>
            {mailboxesQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">E-mail</th>
                    <th className="pb-2 pr-4 font-medium">Nome</th>
                    <th className="pb-2 font-medium">Quota</th>
                  </tr>
                </thead>
                <tbody>
                  {mailboxes.map((m) => (
                    <tr key={m.username} className="border-b border-border/40">
                      <td className="py-2 pr-4">{m.username}</td>
                      <td className="py-2 pr-4">{m.name ?? "—"}</td>
                      <td className="py-2">
                        {m.quota_used ?? "0"} / {m.quota ?? "∞"} MB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
