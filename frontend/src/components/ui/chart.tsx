"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"
import { cn } from "@/lib/utils"

// Chart container wrapper
const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    config: Record<string, { label?: React.ReactNode; color?: string }>
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"]
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = React.useState(false)

  // Combine refs
  const combinedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    },
    [ref]
  )

  // Wait for container to have dimensions before rendering chart
  React.useEffect(() => {
    let rafId: number
    let retryId: number | null = null

    const checkDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          setIsReady(true)
          return true
        }
      }
      return false
    }

    // Use requestAnimationFrame to ensure layout is complete
    rafId = requestAnimationFrame(() => {
      if (!checkDimensions()) {
        // If still not ready, check again on next frame
        retryId = requestAnimationFrame(() => {
          checkDimensions()
        })
      }
    })

    // Use ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(() => {
      checkDimensions()
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (retryId) cancelAnimationFrame(retryId)
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div
      data-chart={chartId}
      ref={combinedRef}
      className={cn(
        "relative w-full min-w-[200px] min-h-[200px] text-xs [&_.recharts-cartesian-axis-tick_text]:fill-[#6F6A60] [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-[#E3DDCF] [&_.recharts-curve.recharts-tooltip-cursor]:stroke-[#D7D0C2] [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-[#E3DDCF] [&_.recharts-radial-bar-background-sector]:fill-[#F7F2E6] [&_.recharts-reference-line-line]:stroke-[#D7D0C2] [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
        className
      )}
      style={{ width: '100%', minWidth: '200px', minHeight: '200px', ...props.style }}
      {...props}
    >
      <ChartStyle id={chartId} config={config} />
      {isReady && (
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={200}>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      )}
    </div>
  )
})
ChartContainer.displayName = "Chart"

const ChartStyle = ({ id, config }: { id: string; config: Record<string, { label?: React.ReactNode; color?: string }> }) => {
  const colorConfig = Object.entries(config).filter(([_, config]) => config.color)

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(config)
          .filter(([_, config]) => config.color)
          .map(([key, item]) => `[data-chart=${id}] .color-${key} { color: ${item.color}; }`)
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

interface TooltipPayload {
  name?: string;
  value?: any;
  dataKey?: string;
  color?: string;
  [key: string]: any;
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.HTMLAttributes<HTMLDivElement> & {
      hideLabel?: boolean
      hideIndicator?: boolean
      indicator?: "line" | "dot" | "dashed"
      nameKey?: string
      labelKey?: string
      payload?: TooltipPayload[]
      label?: string | number
    }
>(
  (
    {
      active,
      payload = [],
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null
      }

      const [item] = payload
      const key = `${labelKey || item.dataKey || item.name || "value"}`
      const itemConfig = item.payload?.chartConfig?.[key]

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>
            {labelFormatter(label, payload)}
          </div>
        )
      }

      if (!label && !itemConfig?.label) {
        return null
      }

      return <div className={cn("font-medium", labelClassName)}>{itemConfig?.label || label}</div>
    }, [label, labelFormatter, payload, hideLabel, labelClassName, labelKey])

    if (!active || !payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] px-2.5 py-1.5 text-xs shadow-md",
          className
        )}
      >
        {tooltipLabel}
        <div className="grid gap-1.5">
          {payload.map((item: TooltipPayload, index: number) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`
            const itemConfig = item.payload?.chartConfig?.[key]
            const indicatorColor = color || item.payload.fill || item.color

            return (
              <div
                key={item.dataKey}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-[#6F6A60]",
                  indicator === "dot" && "items-center"
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {!hideIndicator && (
                      <div
                        className={cn(
                          "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                          {
                            "h-2.5 w-2.5": indicator === "dot",
                            "w-1": indicator === "line",
                            "w-1 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                            "my-0.5": indicator === "dashed",
                          }
                        )}
                        style={
                          {
                            "--color": indicatorColor,
                            "--color-bg": indicatorColor,
                            "--color-border": indicatorColor,
                          } as React.CSSProperties
                        }
                      />
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        "gap-2"
                      )}
                    >
                      <div className={cn("text-[#6F6A60]")}>
                        {itemConfig?.label || item.name}
                      </div>
                      {item.value && (
                        <div className={cn("font-mono tabular-nums font-medium text-[#1C1B17]")}>
                          {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltip"

const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Legend> &
    React.HTMLAttributes<HTMLDivElement> & {
      hideIcon?: boolean
      nameKey?: string
      payload?: TooltipPayload[]
    }
>(({ payload = [], className, hideIcon = false, nameKey, ...props }, ref) => {
  if (!payload?.length) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn("flex items-center justify-center gap-4", className)}
      {...props}
    >
      {payload.map((item: TooltipPayload) => {
        const key = `${nameKey || item.dataKey || "value"}`
        const itemConfig = item.payload?.chartConfig?.[key]

        return (
          <div
            key={item.dataKey}
            className={cn(
              "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-[#6F6A60]"
            )}
          >
            {!hideIcon && (
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: item.color,
                }}
              />
            )}
            {itemConfig?.label}
          </div>
        )
      })}
    </div>
  )
})
ChartLegendContent.displayName = "ChartLegend"

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
}

