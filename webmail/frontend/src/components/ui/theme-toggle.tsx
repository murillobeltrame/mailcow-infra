import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  variant?: "ghost" | "outline";
};

export function ThemeToggle({ className, variant = "ghost" }: ThemeToggleProps) {
  const { dark, toggle } = useTheme();

  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      className={cn("shrink-0", className)}
      onClick={toggle}
      aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
