import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";

export function DomainPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [domain, setDomain] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [mbName, setMbName] = useState("");
  const [mbPassword, setMbPassword] = useState("");

  const domainsQuery = useQuery({
    queryKey: ["domain", "domains"],
    queryFn: () => api.domainDomains().then((r) => r.domains),
  });

  const domainOptions = domainsQuery.data?.map((d) => d.domain_name).filter(Boolean) as string[] | undefined;

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

  const isDomainAdmin = user?.role === "domainadmin";

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administração de domínio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Equivalente ao painel <strong>/domainadmin</strong> do Mailcow — gerencie caixas do seu domínio.
        </p>
      </div>

      {isDomainAdmin && (
        <div className="flex gap-3 rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            <strong>Registrar um domínio novo</strong> (ex.: <code>outra-empresa.com.br</code>) só pode ser feito
            pelo administrador global em{" "}
            <strong>Administração → Registrar novo domínio</strong>. Como admin de domínio, você gerencia apenas
            as caixas dos domínios atribuídos à sua conta.
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
        ) : mailboxesQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">E-mail</th>
                  <th className="pb-2 pr-4 font-medium">Nome</th>
                  <th className="pb-2 font-medium">Ativo</th>
                </tr>
              </thead>
              <tbody>
                {(mailboxesQuery.data?.mailboxes as { username?: string; name?: string; active?: string }[] | undefined)?.map(
                  (m) => (
                    <tr key={m.username} className="border-b border-border/40">
                      <td className="py-2 pr-4">{m.username}</td>
                      <td className="py-2 pr-4">{m.name ?? "—"}</td>
                      <td className="py-2">{m.active === "1" ? "Sim" : "Não"}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
