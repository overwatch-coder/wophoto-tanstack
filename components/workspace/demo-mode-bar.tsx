import { RotateCcw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DemoTransitionModal,
  useDemoAccessTransition,
} from "@/components/workspace/demo-transition-modal"
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
  const { transition, isPending, trigger, dismiss } = useDemoAccessTransition()
  const activeDemoRole: DemoRole = DEMO_ROLES.includes(role as DemoRole)
    ? (role as DemoRole)
    : "MANAGER"

  return (
    <>
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
            const switchingToThis =
              isPending && transition?.kind === "switch" && transition.role === demoRole
            return (
              <form
                key={demoRole}
                action="/auth/demo"
                method="POST"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!active) void trigger("switch", demoRole)
                }}
              >
                <input type="hidden" name="role" value={demoRole} />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || active}
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  className="h-7 gap-1.5 px-2.5 text-xs"
                >
                  {switchingToThis ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  ) : null}
                  <span>{ROLE_LABELS[demoRole]}</span>
                </Button>
              </form>
            )
          })}

          <form
            action="/auth/demo"
            method="POST"
            className="ml-1"
            onSubmit={(event) => {
              event.preventDefault()
              void trigger("reset", activeDemoRole)
            }}
          >
            <input type="hidden" name="action" value="reset" />
            <input type="hidden" name="role" value={activeDemoRole} />
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              variant="ghost"
              title="Reset demo studio data to its initial state"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {isPending && transition?.kind === "reset" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="size-3.5" aria-hidden="true" />
              )}
              <span>Reset Demo</span>
            </Button>
          </form>
        </div>
      </div>

      <DemoTransitionModal transition={transition} onDismiss={dismiss} />
    </>
  )
}
