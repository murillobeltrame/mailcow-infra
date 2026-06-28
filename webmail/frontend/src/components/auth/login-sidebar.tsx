import { BrandLogo } from "@/components/brand/brand-logo";

export function LoginSidebar() {
  return (
    <aside className="relative hidden w-[min(100%,17.5rem)] shrink-0 flex-col justify-between bg-[hsl(209,61%,18%)] p-8 text-white lg:flex">
      <div>
        <div className="[&_p]:text-white [&_p.text-muted-foreground]:text-white/70">
          <BrandLogo className="[&_div:first-child]:bg-white/15 [&_div:first-child]:text-white" />
        </div>
        <p className="mt-10 text-sm leading-relaxed text-white/80">
          Servidor de e-mail. Gerencie domínios, caixas postais e políticas de entrega.
        </p>
      </div>
      <p className="text-xs text-white/50">© Nive Sistemas</p>
    </aside>
  );
}
