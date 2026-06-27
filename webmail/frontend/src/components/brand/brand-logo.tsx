import { cn } from "@/lib/utils";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
};

const sizes = {
  sm: { box: "h-8 w-8 text-sm", title: "text-sm" },
  md: { box: "h-9 w-9 text-sm", title: "text-sm" },
  lg: { box: "h-11 w-11 text-lg", title: "text-lg" },
};

export function BrandLogo({ size = "md", showText = true, className }: BrandLogoProps) {
  const s = sizes[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground",
          s.box
        )}
      >
        N
      </div>
      {showText && (
        <div className="min-w-0">
          <p className={cn("truncate font-semibold leading-tight", s.title)}>Nive Mail</p>
          {size === "lg" && <p className="text-sm text-sidebar-muted">E-mail profissional</p>}
        </div>
      )}
    </div>
  );
}
