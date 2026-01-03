import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-[10px] border border-[#D7D0C2] bg-[#F7F2E6] px-3 py-2 text-sm",
        "text-[#1C1B17] placeholder:text-[#6F6A60]",
        "shadow-[0_1px_0_rgba(0,0,0,0.06)]",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(29,78,216,0.35)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }

