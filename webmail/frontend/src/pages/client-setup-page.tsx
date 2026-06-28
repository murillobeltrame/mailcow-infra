import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, Copy, Inbox, Info, KeyRound, Loader2, Smartphone } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CopyField } from "@/components/ui/copy-field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type ClientMailSettings } from "@/lib/api";

function ConfigSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-soft">
      <div className="border-b border-border/60 bg-gradient-to-r from-primary/5 to-transparent px-6 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-6">{children}</div>
    </section>
  );
}

function SettingsFields({ settings, prefix }: { settings: ClientMailSettings; prefix: "incoming" | "outgoing" | "outgoingAlternate" }) {
  const block = settings[prefix];
  const fields: { label: string; value: string; hint?: string }[] = [
    { label: "Servidor", value: block.server },
    { label: "Porta", value: String(block.port) },
    { label: "Segurança", value: block.security },
  ];

  if ("username" in block) {
    fields.push({ label: "Usuário", value: block.username });
  }
  if ("authentication" in block) {
    fields.push({
      label: "Autenticação",
      value: block.authentication,
      hint: "Ative autenticação SMTP no cliente de e-mail",
    });
  }

  return (
    <>
      {fields.map((field) => (
        <CopyField key={`${prefix}-${field.label}`} label={field.label} value={field.value} hint={field.hint} />
      ))}
    </>
  );
}

export function ClientSetupPage() {
  const [copyingAll, setCopyingAll] = useState(false);

  const configQuery = useQuery({
    queryKey: ["account", "client-config"],
    queryFn: () => api.clientMailConfig(),
  });

  const settings = configQuery.data?.settings;
  const summary = configQuery.data?.summary;

  const copyAll = async () => {
    if (!summary) return;
    setCopyingAll(true);
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Configuração completa copiada");
    } catch {
      toast.error("Não foi possível copiar");
    } finally {
      setCopyingAll(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6 pb-12">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Smartphone className="h-3.5 w-3.5" />
          Cliente de e-mail externo
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurar entrada e saída</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Use estes dados no Outlook, Thunderbird, Apple Mail, Gmail (conta externa) ou em qualquer sistema que
          envie e receba e-mail via IMAP e SMTP. Clique no botão ao lado de cada campo para copiar.
        </p>
        {summary ? (
          <Button variant="secondary" className="rounded-xl" disabled={copyingAll} onClick={copyAll}>
            {copyingAll ? <Loader2 className="animate-spin" /> : <Copy />}
            Copiar configuração completa
          </Button>
        ) : null}
      </div>

      {configQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : settings ? (
        <>
          <ConfigSection
            icon={KeyRound}
            title="Sua conta"
            description="Credenciais usadas para autenticar no servidor de e-mail."
          >
            <CopyField label="Endereço de e-mail" value={settings.email} />
            <CopyField
              label="Senha"
              value="Use a senha da sua conta"
              hint="Ou crie uma senha de aplicativo em Minha conta, se o app não aceitar a senha principal."
              mono={false}
            />
          </ConfigSection>

          <ConfigSection
            icon={ArrowDownToLine}
            title="Entrada — receber e-mails"
            description={`${settings.incoming.label}. Recomendado para manter pastas sincronizadas entre dispositivos.`}
          >
            <SettingsFields settings={settings} prefix="incoming" />
          </ConfigSection>

          <ConfigSection
            icon={ArrowUpFromLine}
            title="Saída — enviar e-mails"
            description="Servidor SMTP para envio. A autenticação é obrigatória."
          >
            <SettingsFields settings={settings} prefix="outgoing" />
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alternativa</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Se o cliente não aceitar a porta {settings.outgoing.port} com STARTTLS, use a porta{" "}
                {settings.outgoingAlternate.port} com {settings.outgoingAlternate.security}.
              </p>
              <div className="mt-3 space-y-3">
                <SettingsFields settings={settings} prefix="outgoingAlternate" />
              </div>
            </div>
          </ConfigSection>

          <section className="rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="font-medium text-foreground">Nome de usuário:</strong> sempre o endereço
                  completo de e-mail (ex.: <span className="font-mono">{settings.email}</span>).
                </p>
                <p>
                  <strong className="font-medium text-foreground">Senhas de aplicativo:</strong> alguns programas
                  pedem uma senha dedicada. Você pode criar uma em{" "}
                  <Link to="/account" className="font-medium text-primary underline-offset-2 hover:underline">
                    Minha conta → Senhas de aplicativo
                  </Link>
                  .
                </p>
                <p>
                  <strong className="font-medium text-foreground">Servidor:</strong> use{" "}
                  <span className="font-mono text-foreground">{settings.hostname}</span> tanto na entrada quanto na
                  saída — não use IP nem subdomínios diferentes.
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <Inbox className="h-4 w-4" />
              Voltar ao webmail
            </Link>
            <Link
              to="/account"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Minha conta
            </Link>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Não foi possível carregar as configurações.</p>
      )}
    </div>
  );
}
