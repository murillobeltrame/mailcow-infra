import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth/auth-context";
import { AliasListPanel } from "@/components/admin/alias-list-panel";
import { MailboxListTable } from "@/components/admin/mailbox-list-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api, type MailboxRow } from "@/lib/api";
import { asArray, cn } from "@/lib/utils";

const DOMAIN_TABS = [
  { id: "mailboxes", label: "Caixas" },
  { id: "aliases", label: "Aliases" },
] as const;

type DomainTab = (typeof DOMAIN_TABS)[number]["id"];

export function DomainPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<DomainTab>("mailboxes");
  const [domain, setDomain] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [mbName, setMbName] = useState("");
  const [mbPassword, setMbPassword] = useState("");

  const domainsQuery = useQuery({
    queryKey: ["domain", "domains"],
    queryFn: () => api.domainDomains().then((r) => r.domains),
  });

  const domainOptions = asArray<{ domain_name?: string }>(domainsQuery.data)
    .map((d) => d.domain_name)
    .filter(Boolean) as string[];

  useEffect(() => {
    if (!domain && domainOptions?.length) {
      setDomain(domainOptions[0]!);
    }
  }, [domain, domainOptions]);

  const mailboxesQuery = useQuery({
    queryKey: ["domain", "mailboxes", domain],
    queryFn: () => api.domainMailboxes(domain),
    enabled: !!domain,
  });

  const addMailbox = useMutation({
    mutationFn: () =>
      api.domainCreateMailbox({
        local_part: localPart.trim(),
        domain,
        name: mbName.trim() || localPart.trim(),
        password: mbPassword,
      }),
    onSuccess: () => {
      toast.success("Caixa postal criada");
      setLocalPart("");
      setMbName("");
      setMbPassword("");
      qc.invalidateQueries({ queryKey: ["domain", "mailboxes", domain] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro ao criar caixa"),
  });

  const mailboxes = asArray<MailboxRow>(mailboxesQuery.data?.mailboxes);

  const isDomainAdmin = user?.role === "domainadmin";

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administração de domínio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Equivalente ao painel <strong>/domainadmin</strong> do Mailcow — gerencie caixas e aliases do seu domínio.
        </p>
      </div>

      {isDomainAdmin && (
        <div className="flex gap-3 rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
          <p>
            <strong>Registrar um domínio novo</strong> só pode ser feito pelo administrador global em{" "}
            <strong>Administração → Domínios</strong>.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="domain-select" className="text-sm font-medium">
          Domínio
        </label>
        {domainsQuery.isLoading ? (
          <Skeleton className="mt-2 h-10 max-w-xs rounded-xl" />
        ) : (
          <select
            id="domain-select"
            className="mt-1 block w-full max-w-xs rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          >
            {!domainOptions?.length && <option value="">Nenhum domínio</option>}
            {domainOptions?.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>

      <nav className="flex flex-wrap gap-2">
        {DOMAIN_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition",
              tab === t.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "mailboxes" && (
        <>
          <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
            <h2 className="mb-4 text-lg font-medium">Nova caixa postal — {domain || "…"}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="da-local">Parte local</Label>
                <Input
                  id="da-local"
                  placeholder="vendas"
                  value={localPart}
                  onChange={(e) => setLocalPart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="da-name">Nome</Label>
                <Input id="da-name" value={mbName} onChange={(e) => setMbName(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="da-pass">Senha</Label>
                <PasswordInput id="da-pass" value={mbPassword} onChange={(e) => setMbPassword(e.target.value)} />
              </div>
            </div>
            <Button
              className="mt-4 rounded-xl"
              disabled={!domain || !localPart || !mbPassword || addMailbox.isPending}
              onClick={() => addMailbox.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar caixa
            </Button>
          </section>

          <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
            <h2 className="mb-4 text-lg font-medium">Caixas existentes</h2>
            {!domain ? (
              <p className="text-sm text-muted-foreground">Selecione um domínio.</p>
            ) : (
              <MailboxListTable
                mailboxes={mailboxes}
                loading={mailboxesQuery.isLoading}
                scope="domain"
                onChanged={() => qc.invalidateQueries({ queryKey: ["domain", "mailboxes", domain] })}
              />
            )}
          </section>
        </>
      )}

      {tab === "aliases" && (
        <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
          <h2 className="mb-4 text-lg font-medium">Aliases — {domain || "…"}</h2>
          <AliasListPanel domain={domain} scope="domain" />
        </section>
      )}
    </div>
  );
}
