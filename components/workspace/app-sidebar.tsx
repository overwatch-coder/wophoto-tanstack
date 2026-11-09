import * as React from "react"
import { Link, useLocation, useRouter } from "@tanstack/react-router"
import { LogOut, Moon, Sun, UserRound } from "lucide-react"
import { useTheme } from "next-themes"
import { getProfileImageSrc } from "@/lib/profile-image"
import { WoPhotoLogo, WoPhotoMark } from "@/components/brand/logo"

import { signOutUser } from "@/app/actions/auth"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  getWorkspaceNavigationGroups,
  getWorkspaceHome,
  matchesWorkspacePath,
  type WorkspaceRole,
} from "@/lib/navigation"

export function AppSidebar({
  email,
  image,
  name,
  role,
  allowedAreas,
  userId,
}: {
  email?: string | null
  image?: string | null
  name?: string | null
  role: WorkspaceRole
  allowedAreas?: readonly string[] | null
  userId: string
}) {
  const { pathname } = useLocation()
  const router = useRouter()
  const { setOpenMobile } = useSidebar()
  const home = getWorkspaceHome(role)
  const navigationGroups = getWorkspaceNavigationGroups(role, allowedAreas)
  const prefetchOnIntent = React.useCallback((href: string) => {
    void router.preloadRoute({ href } as any)
  }, [router])
  const groupTitles: Record<(typeof navigationGroups)[number][number]["group"], string> = {
    primary: "Overview",
    work: "Work",
    resources: "Resources",
    operations: "Inventory",
    archive: "Archive",
    communication: "Updates",
    admin: "Team",
    account: "Account",
  }

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setOpenMobile(false)
    }

    mediaQuery.addEventListener("change", handleViewportChange)
    return () => mediaQuery.removeEventListener("change", handleViewportChange)
  }, [setOpenMobile])

  return (
    <Sidebar collapsible="icon" side="left" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border px-2 pt-4 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="WoPhoto home"
              render={
                <Link
                  to={home as any}
                  preload={false}
                  onPointerEnter={() => prefetchOnIntent(home)}
                  onFocus={() => prefetchOnIntent(home)}
                  onTouchStart={() => prefetchOnIntent(home)}
                  onClick={() => setOpenMobile(false)}
                />
              }
              className="gap-3 px-1 group-data-[collapsible=icon]:px-0"
            >
              <WoPhotoLogo
                compact
                priority
                className="group-data-[collapsible=icon]:hidden"
              />
              <WoPhotoMark
                priority
                className="hidden group-data-[collapsible=icon]:block"
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <nav aria-label="Primary navigation" className="flex flex-col gap-2">
          {navigationGroups.map((items) => (
            <React.Fragment key={items[0]?.group}>
              <SidebarGroup className="p-0">
                <h2 className="mb-1 px-2 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground group-data-[collapsible=icon]:sr-only">
                  {groupTitles[items[0].group]}
                </h2>
                <SidebarMenu className="gap-1">
                  {items.map((item) => {
                    const Icon = item.icon

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          isActive={matchesWorkspacePath(pathname, item.href)}
                          className="dark:data-active:bg-primary dark:data-active:text-primary-foreground dark:data-active:hover:bg-primary"
                          tooltip={item.title}
                          render={
                            <Link
                              to={item.href as any}
                              preload={false}
                              onPointerEnter={() => prefetchOnIntent(item.href)}
                              onFocus={() => prefetchOnIntent(item.href)}
                              onTouchStart={() => prefetchOnIntent(item.href)}
                              aria-current={
                                matchesWorkspacePath(pathname, item.href)
                                  ? "page"
                                  : undefined
                              }
                              onClick={() => setOpenMobile(false)}
                            />
                          }
                        >
                          <Icon aria-hidden="true" />
                          <span className="group-data-[collapsible=icon]:hidden">
                            {item.title}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroup>
            </React.Fragment>
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-sidebar-border px-2 pt-2.5 pb-2.5 group-data-[collapsible=icon]:px-1.5">
        <ThemeModeToggle />
        <SidebarSeparator className="mx-0" />
        <AccountIdentity
          email={email}
          image={image}
          name={name}
          role={role}
          userId={userId}
          prefetchOnIntent={prefetchOnIntent}
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function ThemeModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const { state, isMobile } = useSidebar()
  const mounted = React.useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    () => true,
    () => false
  )
  const dark = resolvedTheme === "dark"
  const compact = state === "collapsed" && !isMobile

  if (compact) {
    const label = dark ? "Switch to light mode" : "Switch to dark mode"
    return (
      <SidebarMenu className="items-center">
        <SidebarMenuItem className="flex justify-center">
          <SidebarMenuButton
            tooltip={label}
            aria-label={label}
            onClick={() => mounted && setTheme(dark ? "light" : "dark")}
            className="flex size-8 items-center justify-center p-0 rounded-full"
          >
            {dark ? (
              <Sun aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <Moon aria-hidden="true" className="size-4 shrink-0" />
            )}
            <span className="sr-only">{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <div
      role="group"
      aria-label="Appearance"
      className="flex w-full items-center rounded-full bg-muted p-1"
    >
      <button
        type="button"
        aria-pressed={mounted && !dark}
        onClick={() => mounted && setTheme("light")}
        className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mounted && !dark ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
      >
        <Sun aria-hidden="true" className="size-4" />
        <span>Light</span>
      </button>
      <button
        type="button"
        aria-pressed={mounted && dark}
        onClick={() => mounted && setTheme("dark")}
        className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mounted && dark ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
      >
        <Moon aria-hidden="true" className="size-4" />
        <span>Dark</span>
      </button>
    </div>
  )
}

function AccountIdentity({
  email,
  image,
  name,
  role,
  userId,
  prefetchOnIntent,
}: {
  email?: string | null
  image?: string | null
  name?: string | null
  role: WorkspaceRole
  userId: string
  prefetchOnIntent: (href: string) => void
}) {
  const { state, isMobile } = useSidebar()
  const compact = state === "collapsed" && !isMobile
  const displayName = name?.trim() || email?.trim() || "Account"
  const roleLabel = role.charAt(0) + role.slice(1).toLowerCase()

  if (compact) {
    return (
      <SidebarMenu className="gap-1.5">
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={`${displayName} (${roleLabel})`}
            aria-label={`${displayName}, ${roleLabel}`}
            render={
              <Link
                to="/settings"
                preload={false}
                onPointerEnter={() => prefetchOnIntent("/settings")}
                onFocus={() => prefetchOnIntent("/settings")}
                onTouchStart={() => prefetchOnIntent("/settings")}
              />
            }
            className="size-8 justify-center p-0 rounded-full hover:bg-sidebar-accent"
          >
            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
              {image ? (
                <img
                  src={getProfileImageSrc(image, userId) ?? image}
                  alt=""
                  width={32}
                  height={32}
                  className="size-full object-cover"
                />
              ) : (
                <UserRound aria-hidden="true" className="size-4" />
              )}
            </span>
            <span className="sr-only">{displayName}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <form action={signOutUser} className="w-full">
            <SidebarMenuButton
              tooltip="Log out"
              aria-label="Log out"
              render={<button type="submit" />}
              className="size-8 justify-center p-0 rounded-full hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
            >
              <LogOut aria-hidden="true" className="size-4" />
              <span className="sr-only">Log out</span>
            </SidebarMenuButton>
          </form>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <div className="flex w-full items-center justify-between gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
      <Link
        to="/settings"
        preload={false}
        onPointerEnter={() => prefetchOnIntent("/settings")}
        onFocus={() => prefetchOnIntent("/settings")}
        onTouchStart={() => prefetchOnIntent("/settings")}
        role="group"
        aria-label={`${displayName}, ${roleLabel}`}
        title={`${displayName} (${roleLabel})`}
        className="flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
      >
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
          {image ? (
            <img
              src={getProfileImageSrc(image, userId) ?? image}
              alt=""
              width={32}
              height={32}
              className="size-full object-cover"
            />
          ) : (
            <UserRound aria-hidden="true" className="size-4" />
          )}
        </span>
        <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
          <span className="truncate text-sm font-medium">{displayName}</span>
          <span className="text-xs text-muted-foreground">{roleLabel}</span>
        </span>
      </Link>
      <form action={signOutUser} className="shrink-0 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
        <SidebarMenuButton
          tooltip="Log out"
          aria-label="Log out"
          render={<button type="submit" />}
          className="size-8 justify-center p-0 rounded-full text-muted-foreground hover:text-foreground"
        >
          <LogOut aria-hidden="true" className="size-4" />
        </SidebarMenuButton>
      </form>
    </div>
  )
}
