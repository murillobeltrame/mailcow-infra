import { Loader2, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

export type ComposeMode = "new" | "reply" | "forward";

export type ComposeDefaults = {
  to?: string;
  subject?: string;
  body?: string;
  mode?: ComposeMode;
};

type ComposeSheetProps = {
  open: boolean;
  onClose: () => void;
  defaults?: ComposeDefaults;
  onSent?: () => void;
};

function buildReplySubject(subject: string) {
  const cleaned = subject.replace(/^Re:\s*/i, "").trim();
  return cleaned ? `Re: ${cleaned}` : "Re:";
}

function buildForwardSubject(subject: string) {
  const cleaned = subject.replace(/^Fwd:\s*/i, "").replace(/^Fw:\s*/i, "").trim();
  return cleaned ? `Fwd: ${cleaned}` : "Fwd:";
}

export function ComposeSheet({ open, onClose, defaults, onSent }: ComposeSheetProps) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  const mode = defaults?.mode ?? (defaults?.to ? "reply" : "new");

  useEffect(() => {
    if (!open) return;
    if (mode === "forward") {
      setTo("");
      setCc("");
      setBcc("");
      setSubject(defaults?.subject ? buildForwardSubject(defaults.subject) : "");
      setBody(defaults?.body ?? "");
    } else if (mode === "reply") {
      setTo(defaults?.to ?? "");
      setCc("");
      setBcc("");
      setSubject(defaults?.subject ? buildReplySubject(defaults.subject) : "");
      setBody("");
    } else {
      setTo(defaults?.to ?? "");
      setCc("");
      setBcc("");
      setSubject(defaults?.subject ?? "");
      setBody(defaults?.body ?? "");
    }
  }, [open, defaults?.to, defaults?.subject, defaults?.body, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const title =
    mode === "forward" ? "Encaminhar" : mode === "reply" ? "Responder" : "Nova mensagem";

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error("Preencha destinatário, assunto e mensagem");
      return;
    }
    setSending(true);
    try {
      await api.send({
        to: to.trim(),
        subject: subject.trim(),
        body,
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
      });
      toast.success("E-mail enviado");
      onClose();
      onSent?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar"
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-border/60 bg-surface shadow-float animate-slide-in-right",
          "sm:rounded-l-2xl",
        )}
        role="dialog"
        aria-modal
        aria-labelledby="compose-title"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-4">
          <div>
            <h2 id="compose-title" className="text-lg font-semibold">
              {title}
            </h2>
            <p className="text-xs text-muted-foreground">Escreva e envie seu e-mail</p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </header>

        <form onSubmit={handleSend} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-thin p-5">
            <div className="space-y-2">
              <Label htmlFor="compose-to">Para</Label>
              <Input id="compose-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compose-cc">Cc</Label>
              <Input id="compose-cc" type="email" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Opcional" />
            </div>
            {showBcc ? (
              <div className="space-y-2">
                <Label htmlFor="compose-bcc">Cco</Label>
                <Input id="compose-bcc" type="email" value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="Opcional" />
              </div>
            ) : (
              <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setShowBcc(true)}>
                Adicionar Cco
              </button>
            )}
            <div className="space-y-2">
              <Label htmlFor="compose-subject">Assunto</Label>
              <Input id="compose-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compose-body">Mensagem</Label>
              <Textarea
                id="compose-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[240px] resize-none rounded-xl"
                required
              />
            </div>
          </div>

          <footer className="flex shrink-0 justify-end gap-2 border-t border-border/60 p-4">
            <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={sending}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-xl" disabled={sending}>
              {sending ? <Loader2 className="animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </footer>
        </form>
      </aside>
    </>
  );
}
