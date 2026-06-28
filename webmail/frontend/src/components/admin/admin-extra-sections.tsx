import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Key, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api, type QuarantineRow } from "@/lib/api";
import { asArray, cn } from "@/lib/utils";

type DomainRow = { domain_name?: string; active?: string };

export function DomainManagePanel({ domains }: { domains: DomainRow[] }) {
  const qc = useQueryClient();
  const [dkimDomain, setDkimDomain] = useState("");

  const dkimQuery = useQuery({
    queryKey: ["admin", "dkim", dkimDomain],
    queryFn: () => api.adminDkim(dkimDomain).then((r) => r.dkim),
    enabled: !!dkimDomain,
  });

  const toggleDomain = useMutation({
    mutationFn: (d: DomainRow) =>
      api.adminUpdateDomain({
        items: [d.domain_name!],
        attr: { active: d.active === "1" ? "0" : "1" },
      }),
    onSuccess: () => {
      toast.success("Domínio atualizado");
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro"),
  });

  const deleteDomain = useMutation({
    mutationFn: (domain: string) => api.adminDeleteDomain(domain),
    onSuccess: () => {
      toast.success("Domínio removido");
      qc.invalidateQueries({ queryKey: ["admin", "domains"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro"),
  });

  const createDkim = useMutation({
    mutationFn: () =>
      api.adminCreateDkim({
        domains: dkimDomain,
        dkim_selector: "dkim",
        key_length: "2048",
      }),
    onSuccess: () => {
      toast.success("DKIM gerado");
      qc.invalidateQueries({ queryKey: ["admin", "dkim", dkimDomain] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro ao gerar DKIM"),
  });

  return (
    <div className="space-y-8">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Domínio</th>
              <th className="pb-2 pr-4 font-medium">Ativo</th>
              <th className="pb-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.domain_name} className="border-b border-border/40">
                <td className="py-2 pr-4">{d.domain_name}</td>
                <td className="py-2 pr-4">{d.active === "1" ? "Sim" : "Não"}</td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={toggleDomain.isPending}
                      onClick={() => toggleDomain.mutate(d)}
                    >
                      {d.active === "1" ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="rounded-lg"
                      disabled={deleteDomain.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remover domínio ${d.domain_name}? Todas as caixas serão excluídas.`,
                          )
                        ) {
                          deleteDomain.mutate(d.domain_name!);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-border/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Key className="h-4 w-4 text-primary" />
          <h3 className="font-medium">DKIM</h3>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="dkim-domain">Domínio</Label>
            <select
              id="dkim-domain"
              className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              value={dkimDomain}
              onChange={(e) => setDkimDomain(e.target.value)}
            >
              <option value="">Selecione…</option>
              {domains.map((d) => (
                <option key={d.domain_name} value={d.domain_name}>
                  {d.domain_name}
                </option>
              ))}
            </select>
          </div>
          <Button
            className="rounded-xl"
            disabled={!dkimDomain || createDkim.isPending}
            onClick={() => createDkim.mutate()}
          >
            Gerar chave DKIM
          </Button>
        </div>
        {dkimDomain && (
          <div className="mt-4">
            {dkimQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <pre className="max-h-48 overflow-auto rounded-lg bg-muted/50 p-3 text-xs">
                {JSON.stringify(dkimQuery.data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export function QuarantinePanel() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["admin", "quarantine"],
    queryFn: () => api.adminQuarantine().then((r) => r.items),
  });

  const deleteItems = useMutation({
    mutationFn: (ids: string[]) => api.adminDeleteQuarantine(ids),
    onSuccess: () => {
      toast.success("Itens removidos da quarentena");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin", "quarantine"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro"),
  });

  const items = asArray<QuarantineRow>(query.data);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <Button
          variant="destructive"
          size="sm"
          className="rounded-xl"
          disabled={deleteItems.isPending}
          onClick={() => deleteItems.mutate([...selected])}
        >
          Excluir {selected.size} selecionado(s)
        </Button>
      )}
      {query.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Quarentena vazia.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-muted-foreground">
                <th className="pb-2 pr-2" />
                <th className="pb-2 pr-4 font-medium">Remetente</th>
                <th className="pb-2 pr-4 font-medium">Destinatário</th>
                <th className="pb-2 pr-4 font-medium">Assunto</th>
                <th className="pb-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const id = String(item.id ?? "");
                return (
                  <tr key={id} className="border-b border-border/40">
                    <td className="py-2 pr-2">
                      <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} />
                    </td>
                    <td className="py-2 pr-4">{item.sender ?? "—"}</td>
                    <td className="py-2 pr-4">{item.rcpt ?? "—"}</td>
                    <td className="py-2 pr-4">{item.subject ?? "—"}</td>
                    <td className="py-2">{item.score ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function MailQueuePanel() {
  const query = useQuery({
    queryKey: ["admin", "mailq"],
    queryFn: () => api.adminMailQueue().then((r) => r.items),
  });

  const items = asArray<Record<string, unknown>>(query.data);

  return query.isLoading ? (
    <Skeleton className="h-32 w-full" />
  ) : items.length === 0 ? (
    <p className="text-sm text-muted-foreground">Fila de e-mail vazia.</p>
  ) : (
    <pre className="max-h-96 overflow-auto rounded-xl bg-muted/50 p-4 text-xs">
      {JSON.stringify(items, null, 2)}
    </pre>
  );
}

const INFRA_TABS = [
  { id: "fwd", label: "Fwd hosts", fn: () => api.adminFwdHosts() },
  { id: "relay", label: "Relay", fn: () => api.adminRelayHosts() },
  { id: "transport", label: "Transport", fn: () => api.adminTransports() },
  { id: "sync", label: "Sync jobs", fn: () => api.adminSyncJobs() },
  { id: "resources", label: "Resources", fn: () => api.adminResources() },
] as const;

export function InfraPanel() {
  const [tab, setTab] = useState<(typeof INFRA_TABS)[number]["id"]>("fwd");

  const query = useQuery({
    queryKey: ["admin", "infra", tab],
    queryFn: () => INFRA_TABS.find((t) => t.id === tab)!.fn(),
  });

  const data = query.data as { items?: unknown[] } | undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {INFRA_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition",
              tab === t.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {query.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <pre className="max-h-96 overflow-auto rounded-xl bg-muted/50 p-4 text-xs">
          {JSON.stringify(data?.items ?? data, null, 2)}
        </pre>
      )}
    </div>
  );
}

const LOG_TYPES = ["postfix", "dovecot", "autodiscover", "api", "ratelimited"] as const;

export function LogsPanel() {
  const [type, setType] = useState<(typeof LOG_TYPES)[number]>("postfix");

  const query = useQuery({
    queryKey: ["admin", "logs", type],
    queryFn: () => api.adminLogs(type).then((r) => r.logs),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {LOG_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm capitalize transition",
              type === t
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {query.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <pre className="max-h-96 overflow-auto rounded-xl bg-muted/50 p-4 text-xs whitespace-pre-wrap">
          {typeof query.data === "string" ? query.data : JSON.stringify(query.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function Fail2banPanel() {
  const query = useQuery({
    queryKey: ["admin", "fail2ban"],
    queryFn: () => api.adminFail2ban().then((r) => r.fail2ban),
  });

  const solrQuery = useQuery({
    queryKey: ["admin", "solr"],
    queryFn: () => api.adminSolrStatus().then((r) => r.solr),
  });

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Fail2ban</h3>
        </div>
        {query.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <pre className="max-h-64 overflow-auto rounded-xl bg-muted/50 p-4 text-xs">
            {JSON.stringify(query.data, null, 2)}
          </pre>
        )}
      </section>
      <section>
        <h3 className="mb-2 font-medium">Solr (busca)</h3>
        {solrQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <pre className="max-h-64 overflow-auto rounded-xl bg-muted/50 p-4 text-xs">
            {JSON.stringify(solrQuery.data, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
