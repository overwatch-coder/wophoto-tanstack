"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { usePathname } from "next/navigation"
import { Moon, Sun } from "lucide-react"

import { AppSidebar } from "@/components/workspace/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { getWorkspacePageTitle, type WorkspaceRole } from "@/lib/navigation"

type WorkspaceShellProps = {
  children: React.ReactNode
  defaultSidebarOpen: boolean
  email?: string | null
  name?: string | null
  role: WorkspaceRole
}

export function WorkspaceShell({
  children,
  defaultSidebarOpen,
  email,
  name,
  role,
}: WorkspaceShellProps) {
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
    >
      <AppSidebar email={email} name={name} role={role} />
      <SidebarInset className="min-h-svh rounded-none">
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
          <ThemeToggle />
        </header>
        <div
          id="workspace-content"
          className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8"
        >
          {children}
        </div>
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
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        if (mounted) setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md border bg-background px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
    >
      {mounted ? (
        resolvedTheme === "dark" ? (
          <Sun aria-hidden="true" className="size-4" />
        ) : (
          <Moon aria-hidden="true" className="size-4" />
        )
      ) : (
        <span className="px-2 text-sm">Theme</span>
      )}
    </button>
  )
}
