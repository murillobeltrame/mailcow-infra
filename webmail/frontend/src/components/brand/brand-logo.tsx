import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "soft";
};

const containerSizes = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
};

const iconSizes = {
  sm: "h-[18px] w-[18px]",
  md: "h-[22px] w-[22px]",
  lg: "h-7 w-7",
};

const variants = {
  solid: "bg-primary text-primary-foreground shadow-sm",
  soft: "border border-primary/15 bg-accent/70 text-primary shadow-sm dark:border-primary/25 dark:bg-accent/50",
};

function NiveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <rect x="4" y="4" width="16" height="10" rx="3" fill="currentColor" />
      <rect x="4" y="18" width="16" height="26" rx="3" fill="currentColor" />
      <rect x="24" y="4" width="20" height="26" rx="3" fill="currentColor" />
      <rect x="24" y="34" width="20" height="10" rx="3" fill="currentColor" />
    </svg>
  );
}

export function BrandMark({ className, size = "md", variant = "solid" }: BrandMarkProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        containerSizes[size],
        variants[variant],
        className,
      )}
      aria-hidden
    >
      <NiveIcon className={iconSizes[size]} />
    </div>
  );
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark size="md" variant="soft" />
      <div>
        <p className="text-sm font-semibold leading-none">Nive Mail</p>
        <p className="mt-1 text-xs text-muted-foreground">Webmail</p>
      </div>
    </div>
  );
}
