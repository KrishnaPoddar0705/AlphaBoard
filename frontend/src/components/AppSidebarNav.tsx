import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import {
  BarChart3, CalendarDays, ChevronRight, Clock, Gauge, LayoutGrid, LineChart, PenLine, Radio,
  Stethoscope, Table2, Target, TrendingUp, Users,
} from "lucide-react"
import {
  SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

type Icon = React.ComponentType<{ className?: string }>

/**
 * The Command Center's views, as sidebar links. They used to be a tab bar above every
 * Command Center page; each is still just `?view=` on /command-center, so links and
 * bookmarks to a view keep working.
 */
const COMMAND_CENTER: Array<{ view: string | null; title: string; icon: Icon }> = [
  { view: null, title: "Today", icon: Gauge },
  { view: "board", title: "Coverage", icon: LayoutGrid },
  { view: "matrix", title: "Matrix", icon: Table2 },
  { view: "thinking", title: "Thinking Board", icon: PenLine },
  { view: "calendar", title: "Calendar", icon: CalendarDays },
  { view: "activity", title: "Activity", icon: Radio },
  // Dev only: import.meta.env.DEV is statically replaced, so this is dropped from builds.
  ...(import.meta.env.DEV ? [{ view: "diagnostics", title: "Diagnostics", icon: Stethoscope }] : []),
]

const PERFORMANCE: Array<{ title: string; url: string; icon: Icon }> = [
  { title: "Community", url: "/community", icon: Users },
  { title: "Leaderboard", url: "/leaderboard", icon: BarChart3 },
  { title: "Recommendations", url: "/recommendations", icon: TrendingUp },
  { title: "Watchlist", url: "/watchlist", icon: Clock },
  { title: "My Performance", url: "/performance", icon: Target },
]

const onPath = (pathname: string, url: string) => pathname === url || pathname.startsWith(url + "/")

/** On a phone the sidebar is a sheet; close it once a link is chosen. */
function useCloseOnMobile() {
  const { isMobile, setOpenMobile } = useSidebar()
  return React.useCallback(() => { if (isMobile) setOpenMobile(false) }, [isMobile, setOpenMobile])
}

export function CommandCenterNav() {
  const { pathname, search } = useLocation()
  const close = useCloseOnMobile()
  const current = new URLSearchParams(search).get("view")
  // A stock page lives under Coverage, as it did under the old tab bar.
  const onStock = pathname.startsWith("/command-center/stock/")

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Command Center</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {COMMAND_CENTER.map((item) => {
            const active = onStock
              ? item.view === "board"
              : pathname === "/command-center" && (current ?? null) === item.view
            const url = item.view ? `/command-center?view=${item.view}` : "/command-center"
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={active}>
                  <Link to={url} onClick={close}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/**
 * Community, leaderboard, recommendations, watchlist and personal performance, folded
 * under one "Performance" item. Closed by default; it opens by itself only when the page
 * you are on is inside it, so the highlighted item is never hidden.
 */
export function PerformanceNav() {
  const { pathname } = useLocation()
  const close = useCloseOnMobile()
  const containsActive = PERFORMANCE.some((item) => onPath(pathname, item.url))
  const [open, setOpen] = React.useState(containsActive)

  // Arriving on one of its pages from elsewhere (a link, the back button) opens it.
  React.useEffect(() => { if (containsActive) setOpen(true) }, [containsActive])

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={containsActive && !open} aria-label="Performance">
            <LineChart className="h-4 w-4" />
            <span>Performance</span>
            <ChevronRight className={`ml-auto h-4 w-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {PERFORMANCE.map((item) => (
              <SidebarMenuSubItem key={item.title}>
                <SidebarMenuSubButton asChild isActive={onPath(pathname, item.url)}>
                  <Link to={item.url} onClick={close}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
