import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api, type AliasRow } from "@/lib/api";
import { asArray } from "@/lib/utils";

type AliasScope = "admin" | "domain";

type Props = {
  domain: string;
  scope: AliasScope;
};

export function AliasListPanel({ domain, scope }: Props) {
  const qc = useQueryClient();
  const [address, setAddress] = useState("");
  const [goto, setGoto] = useState("");
  const [editing, setEditing] = useState<AliasRow | null>(null);
  const [editGoto, setEditGoto] = useState("");

  const queryKey = scope === "admin" ? ["admin", "aliases", domain] : ["domain", "aliases", domain];

  const aliasesQuery = useQuery({
    queryKey,
    queryFn: () =>
      scope === "admin"
        ? api.adminAliases(domain).then((r) => r.aliases)
        : api.domainAliases(domain).then((r) => r.aliases),
    enabled: !!domain,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const createAlias = useMutation({
    mutationFn: () => {
      const payload = { address: address.trim(), goto: goto.trim(), active: "1" };
      return scope === "admin" ? api.adminCreateAlias(payload) : api.domainCreateAlias(payload);
    },
    onSuccess: () => {
      toast.success("Alias criado");
      setAddress("");
      setGoto("");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro ao criar alias"),
  });

  const updateAlias = useMutation({
    mutationFn: () => {
      const payload = { items: [editing!.address!], attr: { goto: editGoto.trim(), active: "1" } };
      return scope === "admin" ? api.adminUpdateAlias(payload) : api.domainUpdateAlias(payload);
    },
    onSuccess: () => {
      toast.success("Alias atualizado");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro ao atualizar alias"),
  });

  const deleteAlias = useMutation({
    mutationFn: (addr: string) =>
      scope === "admin" ? api.adminDeleteAlias(addr) : api.domainDeleteAlias(addr),
    onSuccess: () => {
      toast.success("Alias removido");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro ao remover alias"),
  });

  const aliases = asArray<AliasRow>(aliasesQuery.data);

  if (!domain) {
    return <p className="text-sm text-muted-foreground">Selecione um domínio.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="alias-address">Endereço alias</Label>
          <Input
            id="alias-address"
            placeholder={`vendas@${domain}`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alias-goto">Encaminhar para</Label>
          <Input
            id="alias-goto"
            placeholder="usuario@dominio.com"
            value={goto}
            onChange={(e) => setGoto(e.target.value)}
          />
        </div>
      </div>
      <Button
        className="rounded-xl"
        disabled={!address.trim() || !goto.trim() || createAlias.isPending}
        onClick={() => createAlias.mutate()}
      >
        <Plus className="mr-2 h-4 w-4" />
        Criar alias
      </Button>

      <div className="overflow-x-auto">
        <h3 className="mb-3 text-sm font-medium">Aliases em {domain} ({aliases.length})</h3>
        {aliasesQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : aliases.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum alias neste domínio.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Endereço</th>
                <th className="pb-2 pr-4 font-medium">Destino</th>
                <th className="pb-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {aliases.map((row) => (
                <tr key={row.address} className="border-b border-border/40">
                  <td className="py-2 pr-4 font-mono text-xs">{row.address}</td>
                  <td className="py-2 pr-4">{row.goto ?? "—"}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => {
                          setEditing(row);
                          setEditGoto(row.goto ?? "");
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="rounded-lg"
                        disabled={deleteAlias.isPending}
                        onClick={() => {
                          if (window.confirm(`Remover alias ${row.address}?`)) {
                            deleteAlias.mutate(row.address!);
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
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar alias</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{editing?.address}</p>
          <div className="space-y-2">
            <Label htmlFor="edit-goto">Encaminhar para</Label>
            <Input id="edit-goto" value={editGoto} onChange={(e) => setEditGoto(e.target.value)} />
          </div>
          <Button
            className="rounded-xl"
            disabled={!editGoto.trim() || updateAlias.isPending}
            onClick={() => updateAlias.mutate()}
          >
            Salvar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
