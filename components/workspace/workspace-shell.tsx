"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { usePathname } from "next/navigation"
import { Moon, Sun } from "lucide-react"

import { AppSidebar } from "@/components/workspace/app-sidebar"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { getWorkspacePageTitle, type WorkspaceRole } from "@/lib/navigation"
import { HeaderNotificationBell } from "@/components/workspace/header-notification-bell"
import {
  useWorkspacePreferences,
  WorkspacePreferencesProvider,
} from "@/components/workspace/workspace-preferences-context"
import { StudioCopilot } from "@/components/ai/studio-copilot"
import type { NotificationItemView } from "@/lib/notifications"
import type { SettingsDensity } from "@/generated/prisma/browser"

type WorkspaceShellProps = {
  children: React.ReactNode
  defaultSidebarOpen: boolean
  email?: string | null
  image?: string | null
  name?: string | null
  role: WorkspaceRole
  userId: string
  initialNotifications?: NotificationItemView[]
  initialUnreadCount?: number
  initialUnreadActionCount?: number
  initialUnreadUpdateCount?: number
  density: SettingsDensity
  soundAlerts: boolean
  copilotName: string
  copilotEnabled: boolean
}

export function WorkspaceShell(props: WorkspaceShellProps) {
  return (
    <WorkspacePreferencesProvider
      initialDensity={props.density}
      initialSoundAlerts={props.soundAlerts}
    >
      <WorkspaceShellContent {...props} />
    </WorkspacePreferencesProvider>
  )
}

function WorkspaceShellContent({
  children,
  defaultSidebarOpen,
  email,
  image,
  name,
  role,
  userId,
  initialNotifications,
  initialUnreadCount,
  initialUnreadActionCount,
  initialUnreadUpdateCount,
  copilotName,
  copilotEnabled,
}: WorkspaceShellProps) {
  const { density, soundAlerts } = useWorkspacePreferences()
  const pathname = usePathname()
  const title = getWorkspacePageTitle(role, pathname)
  const titleRef = React.useRef<HTMLHeadingElement>(null)
  const previousPathname = React.useRef(pathname)

  React.useEffect(() => {
    if (previousPathname.current === pathname) return

    previousPathname.current = pathname
    const frame = window.requestAnimationFrame(() => titleRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [pathname])

  return (
    <SidebarProvider
      defaultOpen={defaultSidebarOpen}
      className="workspace-shell"
      data-density={density.toLowerCase()}
    >
      <AppSidebar
        email={email}
        image={image}
        name={name}
        role={role}
        userId={userId}
      />
      <SidebarInset className="min-h-svh w-full max-w-full min-w-0 overflow-x-clip rounded-none">
        <header className="flex min-h-16 shrink-0 items-center gap-3 border-b bg-background px-3 sm:px-5">
          <SidebarTrigger
            aria-label="Toggle navigation sidebar"
            className="size-11"
          />
          <h1
            ref={titleRef}
            id="workspace-page-title"
            tabIndex={-1}
            className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-xl"
          >
            {title}
          </h1>
          <HeaderNotificationBell
            role={role}
            initialNotifications={initialNotifications}
            initialUnreadCount={initialUnreadCount}
            initialUnreadActionCount={initialUnreadActionCount}
            initialUnreadUpdateCount={initialUnreadUpdateCount}
            soundAlerts={soundAlerts}
          />
          <ThemeToggle />
        </header>
        <div
          id="workspace-content"
          className="w-full max-w-full min-w-0 flex-1 overflow-x-clip px-3 py-6 sm:px-6 sm:py-8"
        >
          {children}
        </div>
        {copilotEnabled && <StudioCopilot copilotName={copilotName} />}
      </SidebarInset>
    </SidebarProvider>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    () => true,
    () => false
  )

  const label = mounted
    ? `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`
    : "Theme"

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => {
        if (mounted) setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }}
      className="flex size-9 items-center justify-center rounded-full p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {mounted ? (
        resolvedTheme === "dark" ? (
          <Sun aria-hidden="true" className="size-4 shrink-0 text-orange-400" />
        ) : (
          <Moon
            aria-hidden="true"
            className="size-4 shrink-0 text-foreground"
          />
        )
      ) : (
        <span className="size-4 shrink-0" />
      )}
      <span className="sr-only">{label}</span>
    </Button>
  )
}
