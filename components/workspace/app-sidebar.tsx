"use client"

import * as React from "react"
import Link from "next/link"
import { Layers3, LogOut, UserRound } from "lucide-react"
import { usePathname } from "next/navigation"

import { signOutUser } from "@/app/actions/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  useSidebar,
} from "@/components/ui/sidebar"
import {
  getWorkspaceHome,
  matchesWorkspacePath,
  workspaceNavigation,
  type WorkspaceRole,
} from "@/lib/navigation"

export function AppSidebar({
  email,
  name,
  role,
}: {
  email?: string | null
  name?: string | null
  role: WorkspaceRole
}) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const home = getWorkspaceHome(role)

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
      <SidebarHeader className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="WoPhoto home"
              render={<Link href={home} onClick={() => setOpenMobile(false)} />}
              className="gap-3"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Layers3 aria-hidden="true" className="size-4" />
              </span>
              <span className="truncate font-semibold tracking-tight">
                WoPhoto
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <nav aria-label="Primary navigation">
          <SidebarGroup className="p-0">
            <SidebarMenu>
              {workspaceNavigation[role].map((item) => {
                const Icon = item.icon

                return (
                  <SidebarMenuItem key={item.title}>
                    {item.status === "available" && item.href ? (
                      <SidebarMenuButton
                        isActive={matchesWorkspacePath(pathname, item.href)}
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
                    ) : (
                      <SidebarMenuButton
                        aria-label={`${item.title}, Coming soon`}
                        tooltip={`${item.title}, Coming soon`}
                        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
                        aria-disabled="true"
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.title}</span>
                        <span className="ml-auto truncate text-xs font-normal text-muted-foreground group-data-[collapsible=icon]:hidden">
                          Coming soon
                        </span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter className="gap-1 px-2 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountMenu email={email} name={name} role={role} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function AccountMenu({
  email,
  name,
  role,
}: {
  email?: string | null
  name?: string | null
  role: WorkspaceRole
}) {
  const displayName = name?.trim() || email?.trim() || "Account"
  const roleLabel = role.charAt(0) + role.slice(1).toLowerCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            tooltip={`${displayName}, ${roleLabel}`}
            aria-label={`Account menu for ${displayName}, ${roleLabel}`}
            className="h-auto min-h-12 gap-2 border border-transparent px-2 py-1.5 data-popup-open:border-sidebar-border data-popup-open:bg-sidebar-accent sm:gap-3"
          />
        }
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground">
          <UserRound aria-hidden="true" className="size-4" />
        </span>
        <span className="grid min-w-0 flex-1 text-left leading-tight">
          <span className="truncate text-sm font-medium">{displayName}</span>
          <span className="text-xs text-muted-foreground">{roleLabel}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right" className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate font-medium text-foreground">
              {displayName}
            </span>
            <span className="block text-xs text-muted-foreground">
              {roleLabel}
            </span>
            {email ? (
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {email}
              </span>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <form action={signOutUser}>
            <DropdownMenuItem
              variant="destructive"
              render={<button type="submit" />}
              className="w-full"
            >
              <LogOut aria-hidden="true" />
              <span>Log out</span>
            </DropdownMenuItem>
          </form>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
