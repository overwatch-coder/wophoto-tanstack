import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DEMO_ROLES, type DemoRole } from "@/lib/demo"
import type { WorkspaceRole } from "@/lib/navigation"

const ROLE_LABELS: Record<DemoRole, string> = {
  MANAGER: "Manager",
  WORKER: "Worker",
  CLIENT: "Client",
}

type DemoModeBarProps = {
  role: WorkspaceRole
}

export function DemoModeBar({ role }: DemoModeBarProps) {
  return (
    <div
      role="region"
      aria-label="Demo studio controls"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs sm:px-5"
    >
      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <span className="size-2 shrink-0 rounded-full bg-orange-500" aria-hidden="true" />
        <span className="truncate font-medium text-foreground">
          Demo Studio
        </span>
        <span className="hidden text-muted-foreground sm:inline">
          · Interactive preview (Studio Lumière)
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 hidden text-muted-foreground md:inline">Switch role:</span>
        {DEMO_ROLES.map((demoRole) => {
          const active = role === demoRole
          return (
            <form key={demoRole} action="/auth/demo" method="POST">
              <input type="hidden" name="role" value={demoRole} />
              <Button
                type="submit"
                size="sm"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                className="h-7 px-2.5 text-xs"
              >
                {ROLE_LABELS[demoRole]}
              </Button>
            </form>
          )
        })}

        <form action="/auth/demo" method="POST" className="ml-1">
          <input type="hidden" name="action" value="reset" />
          <input type="hidden" name="role" value={DEMO_ROLES.includes(role as DemoRole) ? role : "MANAGER"} />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            title="Reset demo studio data to its initial state"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>Reset Demo</span>
          </Button>
        </form>
      </div>
    </div>
  )
}
