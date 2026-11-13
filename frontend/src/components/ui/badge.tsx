import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-[3px] focus-visible:ring-[rgba(29,78,216,0.35)] transition-[color,box-shadow] overflow-hidden board:rounded-md board:px-1.5",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-ink text-paper-light [a&]:hover:bg-ink/90 board:bg-brand-100 board:text-brand-700",
        secondary:
          "border-transparent bg-paper-alt text-ink [a&]:hover:bg-[rgba(28,27,23,0.04)] board:bg-border-editorial board:text-ink-soft",
        destructive:
          "border-transparent bg-negative text-white [a&]:hover:bg-negative/90 board:bg-rose-100 board:text-rose-700",
        outline:
          "text-ink border-border-editorial [a&]:hover:bg-[rgba(28,27,23,0.04)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
