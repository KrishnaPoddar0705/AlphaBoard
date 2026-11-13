import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(29,78,216,0.35)] aria-invalid:ring-destructive/20 board:rounded-2lg board:focus-visible:ring-brand-500/30 board:active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper-light hover:bg-ink/90 border border-ink board:border-transparent board:bg-button-primary board:text-white board:shadow-button-primary",
        destructive:
          "bg-negative text-white hover:bg-negative/90 border border-negative",
        outline:
          "border border-border-editorial bg-paper-light text-ink hover:bg-[rgba(28,27,23,0.04)] shadow-[0_1px_0_rgba(0,0,0,0.06)] board:shadow-card board:hover:bg-paper",
        secondary:
          "bg-paper-alt text-ink hover:bg-[rgba(28,27,23,0.04)] border border-border-editorial board:shadow-card board:hover:bg-paper",
        ghost:
          "hover:bg-[rgba(28,27,23,0.04)] text-ink",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-lg board:rounded-lg gap-1.5 px-3 py-1.5 has-[>svg]:px-2.5",
        lg: "h-10 rounded-lg board:rounded-xl px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
