import { BrandMark } from "@/components/brand/brand-logo";

export function PageLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <BrandMark size="lg" className="animate-pulse" />
      <p className="text-sm text-muted-foreground">Carregando…</p>
    </div>
  );
}
