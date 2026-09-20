import { Eye, EyeOff, Shuffle } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, type InputProps } from "@/components/ui/input";
import { generatePassword } from "@/lib/generate-password";
import { cn } from "@/lib/utils";

export type PasswordInputProps = InputProps & {
  onGenerate?: (password: string) => void;
};

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, onGenerate, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    const handleGenerate = async () => {
      const password = generatePassword();
      setVisible(true);
      onGenerate?.(password);
      try {
        await navigator.clipboard.writeText(password);
        toast.success("Senha gerada e copiada");
      } catch {
        toast.success("Senha gerada");
      }
    };

    return (
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            ref={ref}
            type={visible ? "text" : "password"}
            className={cn("pr-10", className)}
            {...props}
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {onGenerate ? (
          <Button
            type="button"
            variant="outline"
            className="shrink-0 rounded-xl"
            onClick={() => void handleGenerate()}
          >
            <Shuffle />
            Gerar
          </Button>
        ) : null}
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
