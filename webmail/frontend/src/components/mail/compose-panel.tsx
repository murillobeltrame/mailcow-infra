import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Paperclip, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";
import { mailKeys } from "@/lib/query-keys";

export type ComposeMode = "new" | "reply" | "reply-all" | "forward";

export type ComposeDefaults = {
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
  mode?: ComposeMode;
};

type ComposePanelProps = {
  defaults?: ComposeDefaults;
  /** Rascunho existente (UID na pasta Rascunhos) a continuar. */
  draftUid?: number | null;
  draftsFolder?: string;
  onClose: () => void;
};

type Fields = { to: string; cc: string; bcc: string; subject: string; body: string };

const AUTOSAVE_MS = 2_000;

function buildReplySubject(subject: string) {
  const cleaned = subject.replace(/^Re:\s*/i, "").trim();
  return cleaned ? `Re: ${cleaned}` : "Re:";
}

function buildForwardSubject(subject: string) {
  const cleaned = subject.replace(/^Fwd:\s*/i, "").replace(/^Fw:\s*/i, "").trim();
  return cleaned ? `Fwd: ${cleaned}` : "Fwd:";
}

function initialFields(defaults: ComposeDefaults | undefined, mode: ComposeMode): Fields {
  const subject = defaults?.subject ?? "";
  if (mode === "forward") {
    return { to: "", cc: "", bcc: "", subject: subject ? buildForwardSubject(subject) : "", body: defaults?.body ?? "" };
  }
  if (mode === "reply" || mode === "reply-all") {
    return {
      to: defaults?.to ?? "",
      cc: mode === "reply-all" ? (defaults?.cc ?? "") : "",
      bcc: "",
      subject: subject ? buildReplySubject(subject) : "",
      body: "",
    };
  }
  return { to: defaults?.to ?? "", cc: "", bcc: "", subject, body: defaults?.body ?? "" };
}

function isEmpty(f: Fields) {
  return !f.to.trim() && !f.cc.trim() && !f.bcc.trim() && !f.subject.trim() && !f.body.trim();
}

export function ComposePanel({ defaults, draftUid, draftsFolder, onClose }: ComposePanelProps) {
  const queryClient = useQueryClient();
  const mode: ComposeMode = defaults?.mode ?? (defaults?.to ? "reply" : "new");
  const [fields, setFields] = useState<Fields>(() => initialFields(defaults, mode));
  const [sending, setSending] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [attachments, setAttachments] = useState<
    { filename: string; contentBase64: string; contentType?: string }[]
  >([]);

  // Rascunho: o que está na tela, o que já foi gravado e o UID atual na pasta Rascunhos.
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const savedSnapshot = useRef(JSON.stringify(fields));
  const savedUid = useRef<number | null>(draftUid ?? null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  /** Enviado ou descartado: nada mais deve ser gravado. */
  const finished = useRef(false);

  /** Atualiza só o que está na tela (listas e contadores); o rascunho antigo sai do cache. */
  const syncLists = useCallback(
    (staleDraftUid?: number | null) => {
      if (staleDraftUid != null && draftsFolder) {
        queryClient.removeQueries({ queryKey: mailKeys.message(draftsFolder, staleDraftUid) });
      }
      void queryClient.invalidateQueries({ queryKey: ["mail", "messages"] });
      void queryClient.invalidateQueries({ queryKey: mailKeys.folders });
    },
    [draftsFolder, queryClient],
  );

  const loadingDraft = draftUid != null;
  const [draftLoaded, setDraftLoaded] = useState(!loadingDraft);
  // Lido uma única vez: depois de gravar/enviar, esse UID deixa de existir no servidor.
  const draftQuery = useQuery({
    queryKey: mailKeys.message(draftsFolder ?? "", draftUid ?? 0),
    queryFn: () => api.message(draftsFolder!, draftUid!),
    enabled: loadingDraft && !!draftsFolder && !draftLoaded,
    staleTime: Infinity,
    retry: 1,
  });

  useEffect(() => {
    if (draftLoaded || !draftQuery.data) return;
    const d = draftQuery.data;
    const join = (list?: { address: string }[]) => (list ?? []).map((a) => a.address).join(", ");
    const loaded: Fields = {
      to: join(d.toList),
      cc: join(d.ccList),
      bcc: join(d.bccList),
      subject: d.subject === "(Sem assunto)" ? "" : d.subject,
      body: (d.text ?? "").replace(/\n$/, ""),
    };
    savedSnapshot.current = JSON.stringify(loaded);
    setFields(loaded);
    setShowBcc(!!loaded.bcc);
    setDraftLoaded(true);
  }, [draftLoaded, draftQuery.data]);

  /** Grava o rascunho se houver mudança. As gravações são encadeadas: cada uma substitui a anterior. */
  const saveDraft = useCallback((keepalive = false): Promise<void> => {
    const current = fieldsRef.current;
    const snapshot = JSON.stringify(current);
    if (finished.current || snapshot === savedSnapshot.current || isEmpty(current)) {
      return saveChain.current;
    }
    const previousSnapshot = savedSnapshot.current;
    savedSnapshot.current = snapshot;
    setDraftStatus("saving");
    saveChain.current = saveChain.current.then(async () => {
      if (finished.current) return;
      try {
        const replaced = savedUid.current;
        const res = await api.saveDraft({ ...current, replaceUid: replaced ?? undefined }, keepalive);
        savedUid.current = res.uid;
        setDraftStatus("saved");
        syncLists(replaced);
      } catch {
        if (savedSnapshot.current === snapshot) savedSnapshot.current = previousSnapshot;
        setDraftStatus("error");
      }
    });
    return saveChain.current;
  }, [syncLists]);

  // Grava sozinho pouco depois de parar de digitar…
  useEffect(() => {
    if (!draftLoaded) return;
    const timer = window.setTimeout(() => void saveDraft(), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [fields, draftLoaded, saveDraft]);

  // …e sempre que a tela é abandonada: trocar de página, voltar, fechar/recarregar a aba.
  useEffect(() => {
    const onPageHide = () => void saveDraft(true);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      void saveDraft(true);
    };
  }, [saveDraft]);

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((prev) => ({ ...prev, [key]: e.target.value }));

  const title =
    draftUid != null
      ? "Rascunho"
      : mode === "forward"
        ? "Encaminhar"
        : mode === "reply-all"
          ? "Responder a todos"
          : mode === "reply"
            ? "Responder"
            : "Nova mensagem";

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const next: typeof attachments = [];
    for (const file of Array.from(files)) {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      next.push({ filename: file.name, contentBase64, contentType: file.type || undefined });
    }
    setAttachments((prev) => [...prev, ...next]);
  };

  const handleBack = () => {
    const willSave = !finished.current && !isEmpty(fields) && JSON.stringify(fields) !== savedSnapshot.current;
    if (willSave || draftStatus === "saved" || draftStatus === "saving") toast.success("Rascunho salvo");
    onClose(); // desmontar grava o que estiver pendente
  };

  const handleDiscard = async () => {
    finished.current = true;
    onClose();
    await saveChain.current;
    const uid = savedUid.current;
    if (uid != null) {
      try {
        await api.deleteDraft(uid);
        toast.success("Rascunho descartado");
      } catch {
        toast.error("Não foi possível apagar o rascunho");
      }
      syncLists(uid);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fields.to.trim() || !fields.subject.trim() || !fields.body.trim()) {
      toast.error("Preencha destinatário, assunto e mensagem");
      return;
    }
    setSending(true);
    finished.current = true;
    try {
      await saveChain.current;
      await api.send({
        to: fields.to.trim(),
        subject: fields.subject.trim(),
        body: fields.body,
        cc: fields.cc.trim() || undefined,
        bcc: fields.bcc.trim() || undefined,
        draftUid: savedUid.current ?? undefined,
        attachments: attachments.length ? attachments : undefined,
      });
      toast.success("E-mail enviado");
      syncLists(savedUid.current);
      onClose();
    } catch (err) {
      finished.current = false;
      toast.error(err instanceof ApiError ? err.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  const draftLabel =
    draftStatus === "saving"
      ? "Salvando rascunho…"
      : draftStatus === "saved"
        ? "Rascunho salvo"
        : draftStatus === "error"
          ? "Não foi possível salvar o rascunho"
          : "";

  return (
    <section className="mail-surface min-w-0 flex-1 flex-col" aria-labelledby="compose-title">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-2">
        <Button variant="ghost" size="sm" className="rounded-lg" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <h2 id="compose-title" className="text-sm font-semibold">
          {title}
        </h2>
        <span
          className={`ml-auto text-xs ${draftStatus === "error" ? "text-destructive" : "text-muted-foreground"}`}
          aria-live="polite"
        >
          {draftLabel}
        </span>
      </div>

      {!draftLoaded ? (
        <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
          {draftQuery.isError ? (
            <p className="text-sm text-muted-foreground">
              Não foi possível abrir este rascunho. Ele pode ter sido enviado ou apagado.
            </p>
          ) : (
            <>
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </>
          )}
        </div>
      ) : (
        <form onSubmit={handleSend} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
              <div className="space-y-2">
                <Label htmlFor="compose-to">Para</Label>
                <Input id="compose-to" type="email" multiple value={fields.to} onChange={set("to")} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-cc">Cc</Label>
                <Input id="compose-cc" type="email" multiple value={fields.cc} onChange={set("cc")} placeholder="Opcional" />
              </div>
              {showBcc ? (
                <div className="space-y-2">
                  <Label htmlFor="compose-bcc">Cco</Label>
                  <Input id="compose-bcc" type="email" multiple value={fields.bcc} onChange={set("bcc")} placeholder="Opcional" />
                </div>
              ) : (
                <button
                  type="button"
                  className="self-start text-xs font-medium text-primary hover:underline"
                  onClick={() => setShowBcc(true)}
                >
                  Adicionar Cco
                </button>
              )}
              <div className="space-y-2">
                <Label htmlFor="compose-subject">Assunto</Label>
                <Input id="compose-subject" value={fields.subject} onChange={set("subject")} required />
              </div>
              <div className="flex min-h-[260px] flex-1 flex-col space-y-2">
                <Label htmlFor="compose-body">Mensagem</Label>
                <Textarea
                  id="compose-body"
                  value={fields.body}
                  onChange={set("body")}
                  className="min-h-[220px] flex-1 resize-none rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Anexos</Label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:bg-muted/40">
                  <Paperclip className="h-4 w-4" />
                  Adicionar arquivos
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      void handleFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                {attachments.length > 0 && (
                  <>
                    <ul className="space-y-1 text-xs">
                      {attachments.map((a, i) => (
                        <li
                          key={`${a.filename}-${i}`}
                          className="flex items-center justify-between rounded-lg bg-muted/50 px-2 py-1"
                        >
                          <span className="truncate">{a.filename}</span>
                          <button
                            type="button"
                            className="text-destructive hover:underline"
                            onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">Anexos não são guardados no rascunho.</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <footer className="shrink-0 border-t border-border/60">
            <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 p-4 sm:px-6">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl text-muted-foreground"
                onClick={() => void handleDiscard()}
                disabled={sending}
              >
                <Trash2 className="h-4 w-4" />
                Descartar
              </Button>
              <Button type="submit" className="rounded-xl" disabled={sending}>
                {sending ? <Loader2 className="animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </Button>
            </div>
          </footer>
        </form>
      )}
    </section>
  );
}
