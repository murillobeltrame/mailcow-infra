import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-12 w-12 text-base" };

export function BrandMark({ className, size = "md" }: BrandMarkProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground shadow-sm",
        sizes[size],
        className
      )}
      aria-hidden
    >
      N
    </div>
  );
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark size="md" />
      <div>
        <p className="text-sm font-semibold leading-none">Nive Mail</p>
        <p className="mt-1 text-xs text-muted-foreground">Webmail</p>
      </div>
    </div>
  );
}
