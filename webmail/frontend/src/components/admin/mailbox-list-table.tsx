import { useMutation } from "@tanstack/react-query";
import { HardDrive, KeyRound, Mail, Pencil, Trash2, UserRound } from "lucide-react";
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
import { cn } from "@/lib/utils";

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
          <h3 className="text-sm font-medium leading-none">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="pl-12">{children}</div>
    </section>
  );
}

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
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="space-y-3 border-b border-border/60 bg-muted/20 px-6 py-5 pr-12">
            <DialogTitle>Editar caixa postal</DialogTitle>
            <DialogDescription asChild>
              <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background px-3 py-2">
                <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-xs text-foreground">{editing?.username}</span>
              </div>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="max-h-[min(60vh,520px)] space-y-6 overflow-y-auto px-6 py-5">
              <FormSection icon={UserRound} title="Identidade" description="Nome exibido ao enviar e-mails">
                <div className="space-y-2">
                  <Label htmlFor="mb-edit-name" className="sr-only">
                    Nome exibido
                  </Label>
                  <Input
                    id="mb-edit-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do remetente"
                    required
                  />
                </div>
              </FormSection>

              <div className="border-t border-border/40" />

              <FormSection icon={HardDrive} title="Armazenamento" description="Uso atual e limite da caixa">
                {editingUsage && (
                  <div className="mb-4 rounded-xl border border-border/50 bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Uso atual</span>
                      <span className="tabular-nums font-medium">
                        {formatStorageMb(editingUsage.usedMb)}
                        {!isUnlimitedQuotaMb(editingUsage.totalMb) && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            / {formatQuotaMb(editingUsage.totalMb)}
                          </span>
                        )}
                      </span>
                    </div>
                    {!isUnlimitedQuotaMb(editingUsage.totalMb) && editingUsage.percent != null ? (
                      <div className="mt-2.5 space-y-1.5">
                        <div className="h-1.5 overflow-hidden rounded-full bg-background">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              editingUsage.percent >= 90 ? "bg-destructive" : "bg-primary",
                            )}
                            style={{ width: `${Math.max(editingUsage.percent, 2)}%` }}
                          />
                        </div>
                        <p className="text-right text-xs tabular-nums text-muted-foreground">
                          {editingUsage.percent}% utilizado
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted-foreground">Quota ilimitada</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="mb-edit-quota">Limite de quota</Label>
                  <div className="relative">
                    <Input
                      id="mb-edit-quota"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={quota}
                      onChange={(e) => setQuota(e.target.value)}
                      className="pr-12 tabular-nums"
                      required
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                      MB
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {quotaPreviewMb != null && Number.isFinite(quotaPreviewMb) ? (
                      isUnlimitedQuotaMb(quotaPreviewMb) ? (
                        <>Use <span className="font-medium text-foreground">0</span> para quota ilimitada.</>
                      ) : (
                        <>
                          Equivale a{" "}
                          <span className="font-medium text-foreground">{formatQuotaMb(quotaPreviewMb)}</span>.
                          Use 0 para ilimitada.
                        </>
                      )
                    ) : (
                      <>Informe o limite em megabytes. Use 0 para ilimitada.</>
                    )}
                  </p>
                </div>
              </FormSection>

              <div className="border-t border-border/40" />

              <label
                htmlFor="mb-edit-active"
                className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border/50 px-4 py-3 transition hover:bg-muted/30"
              >
                <div>
                  <p className="text-sm font-medium">Caixa ativa</p>
                  <p className="text-xs text-muted-foreground">Permite enviar e receber e-mails</p>
                </div>
                <input
                  id="mb-edit-active"
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
              </label>

              <div className="border-t border-border/40" />

              <FormSection
                icon={KeyRound}
                title="Alterar senha"
                description="Deixe em branco para manter a senha atual"
              >
                <div className="space-y-3">
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
                        aria-invalid={passwordConfirm.length > 0 && password !== passwordConfirm}
                      />
                      {passwordConfirm.length > 0 && password !== passwordConfirm && (
                        <p className="text-xs text-destructive">As senhas não coincidem.</p>
                      )}
                    </div>
                  )}
                </div>
              </FormSection>
            </div>

            <div className="flex justify-end gap-2 border-t border-border/60 bg-muted/10 px-6 py-4">
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
                {updateMailbox.isPending ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
