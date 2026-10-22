"use client"

import * as React from "react"
import Link from "next/link"
import { Layers3, LogOut, Moon, Sun, UserRound } from "lucide-react"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { getProfileImageSrc } from "@/lib/profile-image"

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
  userId,
}: {
  email?: string | null
  image?: string | null
  name?: string | null
  role: WorkspaceRole
  userId: string
}) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const home = getWorkspaceHome(role)
  const navigationGroups = getWorkspaceNavigationGroups(role)
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
              render={<Link href={home} onClick={() => setOpenMobile(false)} />}
              className="gap-3 px-1 group-data-[collapsible=icon]:px-0"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground group-data-[collapsible=icon]:size-8">
                <Layers3 aria-hidden="true" className="size-4" />
              </span>
              <span className="truncate text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
                WoPhoto
              </span>
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
                              href={item.href}
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
                          <span>{item.title}</span>
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

      <SidebarFooter className="gap-3 border-t border-sidebar-border px-2 pt-3 pb-3">
        <ThemeModeToggle />
        <SidebarSeparator className="mx-0" />
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountIdentity email={email} image={image} name={name} role={role} userId={userId} />
          </SidebarMenuItem>
        </SidebarMenu>
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
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={label}
            aria-label={label}
            onClick={() => mounted && setTheme(dark ? "light" : "dark")}
          >
            {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            <span>Theme</span>
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
}: {
  email?: string | null
  image?: string | null
  name?: string | null
  role: WorkspaceRole
  userId: string
}) {
  const displayName = name?.trim() || email?.trim() || "Account"
  const roleLabel = role.charAt(0) + role.slice(1).toLowerCase()

  return (
    <div className="flex items-center gap-1">
      <div
        role="group"
        aria-label={`${displayName}, ${roleLabel}`}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-2 px-2 py-1.5 sm:gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
      >
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
          {image ? (
            <Image
              src={getProfileImageSrc(image, userId) ?? image}
              alt=""
              width={32}
              height={32}
              unoptimized
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
      </div>
      <form action={signOutUser}>
        <SidebarMenuButton
          tooltip="Log out"
          aria-label="Log out"
          render={<button type="submit" />}
          className="size-10 justify-center px-0"
        >
          <LogOut aria-hidden="true" />
        </SidebarMenuButton>
      </form>
    </div>
  )
}
