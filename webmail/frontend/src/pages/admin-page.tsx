import { useQuery } from "@tanstack/react-query";
import { Activity, HardDrive, Server } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Server }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function AdminPage() {
  const hostQuery = useQuery({
    queryKey: ["admin", "host"],
    queryFn: () => api.hostStatus(),
  });

  const domainsQuery = useQuery({
    queryKey: ["admin", "domains"],
    queryFn: () => api.adminDomains().then((r) => r.domains),
  });

  const mailboxesQuery = useQuery({
    queryKey: ["admin", "mailboxes"],
    queryFn: () => api.adminMailboxes().then((r) => r.mailboxes),
  });

  const host = hostQuery.data as Record<string, unknown> | undefined;
  const memUsed = host?.mem_used as string | undefined;
  const memTotal = host?.mem_total as string | undefined;
  const diskUsed = host?.disk_used as string | undefined;
  const diskTotal = host?.disk_total as string | undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="mt-1 text-sm text-muted-foreground">Status do host, domínios e caixas postais</p>
      </div>

      {hostQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Memória" value={memUsed && memTotal ? `${memUsed} / ${memTotal}` : "—"} icon={Activity} />
          <StatCard label="Disco" value={diskUsed && diskTotal ? `${diskUsed} / ${diskTotal}` : "—"} icon={HardDrive} />
          <StatCard label="Domínios" value={String(domainsQuery.data?.length ?? "—")} icon={Server} />
        </div>
      )}

      <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
        <h2 className="mb-4 text-lg font-medium">Domínios</h2>
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
                {(domainsQuery.data as { domain_name?: string; active?: string }[] | undefined)?.map((d) => (
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
        <h2 className="mb-4 text-lg font-medium">Caixas postais</h2>
        {mailboxesQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">E-mail</th>
                  <th className="pb-2 pr-4 font-medium">Nome</th>
                  <th className="pb-2 font-medium">Quota</th>
                </tr>
              </thead>
              <tbody>
                {(mailboxesQuery.data as { username?: string; name?: string; quota_used?: string; quota?: string }[] | undefined)?.slice(0, 50).map((m) => (
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
          </div>
        )}
      </section>
    </div>
  );
}
