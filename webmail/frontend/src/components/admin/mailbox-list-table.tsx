import { useMutation } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api, type MailboxRow } from "@/lib/api";

type MailboxScope = "admin" | "domain";

type Props = {
  mailboxes: MailboxRow[];
  loading?: boolean;
  scope: MailboxScope;
  emptyMessage?: string;
  onChanged: () => void;
};

export function MailboxListTable({ mailboxes, loading, scope, emptyMessage, onChanged }: Props) {
  const [editing, setEditing] = useState<MailboxRow | null>(null);
  const [name, setName] = useState("");
  const [quota, setQuota] = useState("");
  const [active, setActive] = useState(true);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!editing) return;
    setName(editing.name ?? "");
    setQuota(editing.quota ?? "3072");
    setActive(editing.active !== "0");
    setPassword("");
  }, [editing]);

  const updateMailbox = useMutation({
    mutationFn: (data: {
      email: string;
      name?: string;
      quota?: string;
      active?: boolean;
      password?: string;
    }) => (scope === "admin" ? api.adminUpdateMailbox(data) : api.domainUpdateMailbox(data)),
    onSuccess: () => {
      toast.success("Caixa atualizada");
      setEditing(null);
      onChanged();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro ao atualizar caixa"),
  });

  const deleteMailbox = useMutation({
    mutationFn: (email: string) =>
      scope === "admin" ? api.adminDeleteMailbox(email) : api.domainDeleteMailbox(email),
    onSuccess: () => {
      toast.success("Caixa removida");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro ao remover caixa"),
  });

  if (loading) return <Skeleton className="h-24 w-full" />;

  if (mailboxes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyMessage ?? "Nenhuma caixa postal neste domínio."}
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">E-mail</th>
              <th className="pb-2 pr-4 font-medium">Nome</th>
              <th className="pb-2 pr-4 font-medium">Quota</th>
              <th className="pb-2 pr-4 font-medium">Ativo</th>
              <th className="pb-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {mailboxes.map((m) => (
              <tr key={m.username} className="border-b border-border/40">
                <td className="py-2 pr-4 font-mono text-xs">{m.username}</td>
                <td className="py-2 pr-4">{m.name ?? "—"}</td>
                <td className="py-2 pr-4 tabular-nums">
                  {m.quota_used ?? "0"} / {m.quota ?? "∞"} MB
                </td>
                <td className="py-2 pr-4">{m.active === "0" ? "Não" : "Sim"}</td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => setEditing(m)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="rounded-lg"
                      disabled={deleteMailbox.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Excluir a caixa "${m.username}"? Todas as mensagens serão removidas.`,
                          )
                        ) {
                          deleteMailbox.mutate(m.username!);
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

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar caixa postal</DialogTitle>
            <DialogDescription>{editing?.username}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing?.username) return;
              updateMailbox.mutate({
                email: editing.username,
                name: name.trim(),
                quota: quota.trim(),
                active,
                ...(password ? { password } : {}),
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="mb-edit-name">Nome exibido</Label>
              <Input
                id="mb-edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mb-edit-quota">Quota (MB)</Label>
              <Input
                id="mb-edit-quota"
                type="number"
                min={0}
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="mb-edit-active"
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <Label htmlFor="mb-edit-active">Caixa ativa</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mb-edit-pass">Nova senha (opcional)</Label>
              <PasswordInput
                id="mb-edit-pass"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Deixe em branco para manter"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMailbox.isPending}>
                {updateMailbox.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
