import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactElement } from "react";

export const TooltipProvider = TooltipPrimitive.Provider;

/** Balão com o nome do botão ao passar o mouse ou focar pelo teclado. */
export function Tooltip({
  label,
  side = "right",
  children,
}: {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactElement;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className="z-[60] select-none rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-float animate-in fade-in-0 zoom-in-95"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
