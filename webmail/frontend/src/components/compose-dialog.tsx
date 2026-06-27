import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replyTo?: { email: string; subject: string };
};

export function ComposeDialog({ open, onOpenChange, replyTo }: Props) {
  const [to, setTo] = useState(replyTo?.email ?? "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(replyTo?.subject ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, "")}` : "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error("Preencha destinatário, assunto e mensagem");
      return;
    }
    setSending(true);
    try {
      await api.send({ to, subject, body, cc: cc || undefined });
      toast.success("E-mail enviado");
      onOpenChange(false);
      setTo("");
      setCc("");
      setSubject("");
      setBody("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova mensagem</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to">Para</Label>
            <Input id="to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="destinatario@dominio.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc">Cc (opcional)</Label>
            <Input id="cc" value={cc} onChange={(e) => setCc(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Assunto</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Mensagem</Label>
            <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[200px]" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="animate-spin" /> : <Send />}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
