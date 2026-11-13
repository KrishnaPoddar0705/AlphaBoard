import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-ink placeholder:text-ink-muted selection:bg-[rgba(29,78,216,0.2)] selection:text-ink",
        "border-border-editorial h-9 w-full min-w-0 rounded-[10px] border bg-paper-light px-3 py-1 text-sm",
        "shadow-[0_1px_0_rgba(0,0,0,0.06)] transition-[color,box-shadow] outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-[3px] focus-visible:ring-[rgba(29,78,216,0.35)]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-negative",
        "board:rounded-lg board:shadow-card board:hover:border-border-strong board:focus-visible:border-brand-500 board:focus-visible:ring-brand-500/25",
        className
      )}
      {...props}
    />
  )
}

export { Input }
