import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "@/auth/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

export function DomainPage() {
  const { user } = useAuth();
  const defaultDomain = user?.domains?.[0] ?? "";
  const [domain, setDomain] = useState(defaultDomain);

  const mailboxesQuery = useQuery({
    queryKey: ["domain", "mailboxes", domain],
    queryFn: () => api.domainMailboxes(domain),
    enabled: !!domain,
  });

  const domainOptions = useMemo(() => user?.domains ?? [], [user?.domains]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administração de domínio</h1>
        <p className="mt-1 text-sm text-muted-foreground">Caixas e aliases do seu domínio</p>
      </div>

      {domainOptions.length > 1 && (
        <div>
          <label htmlFor="domain-select" className="text-sm font-medium">
            Domínio
          </label>
          <select
            id="domain-select"
            className="mt-1 block w-full max-w-xs rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          >
            {domainOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
        <h2 className="mb-4 text-lg font-medium">Caixas — {domain || "…"}</h2>
        {!domain ? (
          <p className="text-sm text-muted-foreground">Nenhum domínio atribuído à sua conta.</p>
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
                {(mailboxesQuery.data?.mailboxes as { username?: string; name?: string; active?: string }[] | undefined)?.map((m) => (
                  <tr key={m.username} className="border-b border-border/40">
                    <td className="py-2 pr-4">{m.username}</td>
                    <td className="py-2 pr-4">{m.name ?? "—"}</td>
                    <td className="py-2">{m.active === "1" ? "Sim" : "Não"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
