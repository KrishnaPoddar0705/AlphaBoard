import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-[3px] focus-visible:ring-[rgba(29,78,216,0.35)] transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#1C1B17] text-[#F7F2E6] [a&]:hover:bg-[#1C1B17]/90",
        secondary:
          "border-transparent bg-[#FBF7ED] text-[#1C1B17] [a&]:hover:bg-[rgba(28,27,23,0.04)]",
        destructive:
          "border-transparent bg-[#B23B2A] text-white [a&]:hover:bg-[#B23B2A]/90",
        outline:
          "text-[#1C1B17] border-[#D7D0C2] [a&]:hover:bg-[rgba(28,27,23,0.04)]",
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
