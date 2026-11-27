"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// A short explanation on hover and keyboard focus. Wrap any inline element, or a block with `block`.
export function Tip({ text, children, block = false, side = "top" }: { text: string; children: React.ReactNode; block?: boolean; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip>
      <TooltipTrigger render={block ? <div className="w-full" /> : <span className="inline-flex" />}>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-64 text-center">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
