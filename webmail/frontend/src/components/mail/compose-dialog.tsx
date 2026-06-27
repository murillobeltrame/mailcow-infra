import { Loader2, Send } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";

export type ComposeDefaults = {
  to?: string;
  subject?: string;
};

type ComposeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: ComposeDefaults;
  onSent?: () => void;
};

function buildReplySubject(subject: string) {
  const cleaned = subject.replace(/^Re:\s*/i, "").trim();
  return cleaned ? `Re: ${cleaned}` : "Re:";
}

export function ComposeDialog({ open, onOpenChange, defaults, onSent }: ComposeDialogProps) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTo(defaults?.to ?? "");
    setCc("");
    setSubject(defaults?.subject ? buildReplySubject(defaults.subject) : "");
    setBody("");
  }, [open, defaults?.to, defaults?.subject]);

  const resetAndClose = () => {
    onOpenChange(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error("Preencha destinatário, assunto e mensagem");
      return;
    }
    setSending(true);
    try {
      await api.send({ to: to.trim(), subject: subject.trim(), body, cc: cc.trim() || undefined });
      toast.success("E-mail enviado");
      resetAndClose();
      onSent?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle>Nova mensagem</DialogTitle>
          <DialogDescription>Preencha os campos abaixo para enviar.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSend} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="compose-to">Para</Label>
              <Input
                id="compose-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="destinatario@dominio.com"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compose-cc">Cc (opcional)</Label>
              <Input id="compose-cc" type="email" value={cc} onChange={(e) => setCc(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compose-subject">Assunto</Label>
              <Input
                id="compose-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compose-body">Mensagem</Label>
              <Textarea
                id="compose-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[180px] resize-y"
                required
              />
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={sending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? <Loader2 className="animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
