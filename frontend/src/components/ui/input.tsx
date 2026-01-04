import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-[#1C1B17] placeholder:text-[#6F6A60] selection:bg-[rgba(29,78,216,0.2)] selection:text-[#1C1B17]",
        "border-[#D7D0C2] h-9 w-full min-w-0 rounded-[10px] border bg-[#F7F2E6] px-3 py-1 text-sm",
        "shadow-[0_1px_0_rgba(0,0,0,0.06)] transition-[color,box-shadow] outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-[3px] focus-visible:ring-[rgba(29,78,216,0.35)]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-[#B23B2A]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
