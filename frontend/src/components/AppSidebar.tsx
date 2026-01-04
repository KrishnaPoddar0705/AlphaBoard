"use client"

import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useUser, useClerk } from "@clerk/clerk-react"
import {
  Users,
  TrendingUp,
  Clock,
  Target,
  Building2,
  Settings,
  User,
  // Play, // Unused
  // Music, // Unused
  History,
  BarChart3,
  FileText,
  ChevronDown,
  LogOut,
  LogIn,
  UserPlus,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// import { Button } from "@/components/ui/button" // Unused
import { SignedOut, SignInButton, SignUpButton } from "@clerk/clerk-react"

const navItems = {
  discover: [
    {
      title: "Community",
      url: "/community",
      icon: Users,
      isActive: false,
    },
    {
      title: "Leaderboard",
      url: "/leaderboard",
      icon: BarChart3,
      isActive: false,
    },
    {
      title: "Recommendations",
      url: "/recommendations",
      icon: TrendingUp,
      isActive: false,
    },
    {
      title: "Watchlist",
      url: "/watchlist",
      icon: Clock,
      isActive: false,
    },
    {
      title: "History",
      url: "/history",
      icon: History,
      isActive: false,
    },
    {
      title: "My Performance",
      url: "/performance",
      icon: Target,
      isActive: false,
    },
  ],
  organization: [
    {
      title: "Institutional Memory",
      url: "/research",
      icon: FileText,
      isActive: false,
    },
    {
      title: "Admin Dashboard",
      url: "/organization/admin",
      icon: Building2,
      isActive: false,
    },
  ],
  settings: [
    {
      title: "Profile Settings",
      url: "/profile",
      icon: User,
      isActive: false,
    },
    {
      title: "App Settings",
      url: "/settings/privacy",
      icon: Settings,
      isActive: false,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [showUserMenu, setShowUserMenu] = React.useState(false)
  const userMenuRef = React.useRef<HTMLDivElement>(null)

  // Update active state based on current location
  const updateActiveState = (items: typeof navItems.discover) => {
    return items.map((item) => ({
      ...item,
      isActive: location.pathname === item.url || location.pathname.startsWith(item.url + "/"),
    }))
  }

  const discoverItems = updateActiveState(navItems.discover)
  const orgItems = updateActiveState(navItems.organization)
  const settingsItems = updateActiveState(navItems.settings)

  // Close user menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserMenu])

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
    }
  }

  const userInitials = user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress[0] || "U"

  return (
    <Sidebar {...props} className="border-r border-[#D7D0C2] bg-[#F1EEE0]">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1C1B17] text-[#F7F2E6]">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[#1C1B17]">AlphaBoard</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Discover</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {discoverItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={item.isActive}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Organization</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {orgItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={item.isActive}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={item.isActive}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        {user ? (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2 w-full rounded-lg hover:bg-[#F7F2E6] transition-colors"
            >
              <Avatar className="h-8 w-8 border border-[#D7D0C2]">
                <AvatarImage src={user.imageUrl} alt={user.fullName || "User"} />
                <AvatarFallback className="bg-[#FBF7ED] text-[#1C1B17] font-mono border border-[#D7D0C2]">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col min-w-0">
                <span className="text-sm font-mono font-medium truncate text-[#1C1B17]">
                  {user.fullName || user.emailAddresses[0]?.emailAddress || "User"}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 text-[#6F6A60] transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="py-1">
                  <Link
                    to="/profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-mono text-[#1C1B17] hover:bg-[#F7F2E6] transition-colors"
                  >
                    <User className="h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-mono text-[#1C1B17] hover:bg-[#F7F2E6] transition-colors w-full text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <SignedOut>
            <div className="space-y-2">
              <SignInButton mode="modal">
                <button className="flex items-center gap-2 px-3 py-2 w-full rounded-lg bg-[#1C1B17] text-[#F7F2E6] hover:bg-[#1C1B17]/90 transition-colors font-mono text-sm">
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="flex items-center gap-2 px-3 py-2 w-full rounded-lg border border-[#D7D0C2] text-[#1C1B17] hover:bg-[#F7F2E6] transition-colors font-mono text-sm">
                  <UserPlus className="h-4 w-4" />
                  <span>Create Account</span>
                </button>
              </SignUpButton>
            </div>
          </SignedOut>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

