import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-[10px] border border-border-editorial bg-paper-light px-3 py-2 text-sm",
        "text-ink placeholder:text-ink-muted",
        "shadow-[0_1px_0_rgba(0,0,0,0.06)]",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(29,78,216,0.35)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "board:rounded-lg board:shadow-card board:focus-visible:border-brand-500 board:focus-visible:ring-brand-500/25",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }

