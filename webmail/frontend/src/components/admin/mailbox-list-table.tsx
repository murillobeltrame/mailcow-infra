import { useMutation } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import {
  formatQuotaMb,
  formatQuotaUsage,
  formatStorageMb,
  isUnlimitedQuotaMb,
  parseQuotaToMb,
  quotaUsagePercent,
} from "@/lib/quota-utils";

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
  const [passwordConfirm, setPasswordConfirm] = useState("");

  useEffect(() => {
    if (!editing) return;
    setName(editing.name ?? "");
    const quotaMb = parseQuotaToMb(editing.quota);
    setQuota(isUnlimitedQuotaMb(quotaMb) ? "0" : String(quotaMb));
    setActive(editing.active !== "0");
    setPassword("");
    setPasswordConfirm("");
  }, [editing]);

  const editingUsage = useMemo(() => {
    if (!editing) return null;
    const usedMb = parseQuotaToMb(editing.quota_used);
    const totalMb = parseQuotaToMb(editing.quota);
    return {
      usedMb,
      totalMb,
      percent: quotaUsagePercent(usedMb, totalMb),
    };
  }, [editing]);

  const quotaPreviewMb = useMemo(() => {
    const n = Number(quota.trim());
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n);
  }, [quota]);

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.username) return;

    const quotaTrimmed = quota.trim();
    const quotaNum = Number(quotaTrimmed);
    if (!quotaTrimmed || !Number.isFinite(quotaNum) || quotaNum < 0) {
      toast.error("Informe uma quota válida em MB (0 = ilimitada).");
      return;
    }

    if (password && password !== passwordConfirm) {
      toast.error("As senhas não coincidem.");
      return;
    }

    updateMailbox.mutate({
      email: editing.username,
      name: name.trim(),
      quota: String(Math.round(quotaNum)),
      active,
      ...(password ? { password } : {}),
    });
  }

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
                <td className="py-2 pr-4 tabular-nums">{formatQuotaUsage(m.quota_used, m.quota)}</td>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar caixa postal</DialogTitle>
            <DialogDescription className="font-mono text-xs">{editing?.username}</DialogDescription>
          </DialogHeader>
          <form className="space-y-5 pt-1" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="mb-edit-name">Nome exibido</Label>
              <Input
                id="mb-edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do remetente"
                required
              />
            </div>

            <fieldset className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
              <legend className="px-1 text-sm font-medium">Armazenamento</legend>

              {editingUsage && (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Uso atual</span>
                    <span className="tabular-nums font-medium">
                      {formatStorageMb(editingUsage.usedMb)}
                      {!isUnlimitedQuotaMb(editingUsage.totalMb) && (
                        <span className="text-muted-foreground">
                          {" "}
                          de {formatQuotaMb(editingUsage.totalMb)}
                        </span>
                      )}
                    </span>
                  </div>
                  {!isUnlimitedQuotaMb(editingUsage.totalMb) && editingUsage.percent != null && (
                    <div className="space-y-1">
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${editingUsage.percent}%` }}
                        />
                      </div>
                      <p className="text-right text-xs tabular-nums text-muted-foreground">
                        {editingUsage.percent}% utilizado
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="mb-edit-quota">Quota (MB)</Label>
                <Input
                  id="mb-edit-quota"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={quota}
                  onChange={(e) => setQuota(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {quotaPreviewMb != null && Number.isFinite(quotaPreviewMb) ? (
                    isUnlimitedQuotaMb(quotaPreviewMb) ? (
                      <>0 MB = quota ilimitada</>
                    ) : (
                      <>
                        Equivale a <span className="font-medium">{formatQuotaMb(quotaPreviewMb)}</span>
                        . Use 0 para ilimitada.
                      </>
                    )
                  ) : (
                    <>Informe o limite em megabytes. Use 0 para ilimitada.</>
                  )}
                </p>
              </div>
            </fieldset>

            <div className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2.5">
              <input
                id="mb-edit-active"
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <Label htmlFor="mb-edit-active" className="cursor-pointer font-normal">
                Caixa ativa
              </Label>
            </div>

            <fieldset className="space-y-3 rounded-xl border border-border/60 p-4">
              <legend className="px-1 text-sm font-medium">Senha</legend>
              <p className="text-xs text-muted-foreground">
                Deixe em branco para manter a senha atual.
              </p>
              <div className="space-y-2">
                <Label htmlFor="mb-edit-pass">Nova senha</Label>
                <PasswordInput
                  id="mb-edit-pass"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Opcional"
                  autoComplete="new-password"
                />
              </div>
              {password.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="mb-edit-pass2">Confirmar senha</Label>
                  <PasswordInput
                    id="mb-edit-pass2"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                  />
                  {passwordConfirm.length > 0 && password !== passwordConfirm && (
                    <p className="text-xs text-destructive">As senhas não coincidem.</p>
                  )}
                </div>
              )}
            </fieldset>

            <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  updateMailbox.isPending ||
                  (password.length > 0 && password !== passwordConfirm)
                }
              >
                {updateMailbox.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
