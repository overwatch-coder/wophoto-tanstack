import * as React from "react"
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DEMO_PERSONAS, type DemoRole } from "@/lib/demo"

export type DemoActionKind = "signin" | "switch" | "reset"

export type DemoTransitionState = {
  kind: DemoActionKind
  role: DemoRole
  stage: "preparing" | "authenticating" | "loading"
  error: string | null
}

const STEP_LABELS: Record<DemoActionKind, [string, string, string]> = {
  signin: [
    "Preparing Studio Lumière demo workspace",
    "Creating demo session & loading permissions",
    "Opening your dashboard",
  ],
  switch: [
    "Closing current demo session",
    "Switching role permissions",
    "Loading updated workspace",
  ],
  reset: [
    "Clearing modified demo records",
    "Re-seeding Studio Lumière projects & tasks",
    "Opening fresh demo workspace",
  ],
}

export function useDemoAccessTransition() {
  const [transition, setTransition] = React.useState<DemoTransitionState | null>(null)
  const timerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const trigger = React.useCallback(
    async (kind: DemoActionKind, role: DemoRole) => {
      if (transition && !transition.error) return
      clearTimer()
      setTransition({ kind, role, stage: "preparing", error: null })

      timerRef.current = window.setTimeout(() => {
        setTransition((prev) =>
          prev && prev.stage === "preparing" && !prev.error
            ? { ...prev, stage: "authenticating" }
            : prev,
        )
      }, 450)

      try {
        const body = new URLSearchParams({ role })
        if (kind === "reset") body.set("action", "reset")

        const response = await fetch("/auth/demo", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: body.toString(),
        })

        clearTimer()

        if (!response.ok) {
          const message = (await response.text().catch(() => "")).trim()
          setTransition((prev) =>
            prev
              ? {
                  ...prev,
                  error: message || "Could not start the demo session. Please try again.",
                }
              : null,
          )
          return
        }

        const payload = (await response.json().catch(() => null)) as {
          redirectTo?: string
        } | null
        const target = payload?.redirectTo || "/"

        setTransition((prev) => (prev ? { ...prev, stage: "loading" } : null))
        window.location.assign(target)
      } catch {
        clearTimer()
        setTransition((prev) =>
          prev
            ? {
                ...prev,
                error: "Network error while connecting to the Demo Studio. Please try again.",
              }
            : null,
        )
      }
    },
    [clearTimer, transition],
  )

  const dismiss = React.useCallback(() => {
    clearTimer()
    setTransition(null)
  }, [clearTimer])

  return {
    transition,
    isPending: Boolean(transition && !transition.error),
    trigger,
    dismiss,
  }
}

export function DemoTransitionModal({
  transition,
  onDismiss,
}: {
  transition: DemoTransitionState | null
  onDismiss: () => void
}) {
  if (!transition) return null

  const persona = DEMO_PERSONAS[transition.role]
  const steps = STEP_LABELS[transition.kind]
  const activeStepIndex =
    transition.stage === "preparing" ? 0 : transition.stage === "authenticating" ? 1 : 2

  const title =
    transition.kind === "reset"
      ? "Resetting Studio Lumière"
      : transition.kind === "switch"
        ? `Switching to ${persona.label}`
        : `Signing in as ${persona.label}`

  const subtitle =
    transition.error
      ? "Something went wrong while preparing the demo."
      : `${steps[activeStepIndex]} — please wait a moment.`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-transition-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
            {transition.error ? (
              <AlertCircle className="size-5 text-destructive" aria-hidden="true" />
            ) : (
              <Loader2 className="size-5 animate-spin text-orange-600 dark:text-orange-400" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="demo-transition-title" className="text-base font-semibold text-foreground">
              {title}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>

        {transition.error ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              {transition.error}
            </div>
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <ol className="mt-5 space-y-2.5 border-t border-border/60 pt-4">
            {steps.map((stepLabel, idx) => {
              const completed = idx < activeStepIndex
              const active = idx === activeStepIndex
              return (
                <li key={stepLabel} className="flex items-center gap-2.5 text-xs">
                  {completed ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : active ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-orange-600 dark:text-orange-400" aria-hidden="true" />
                  ) : (
                    <span className="size-4 shrink-0 rounded-full border border-border" aria-hidden="true" />
                  )}
                  <span
                    className={
                      active
                        ? "font-medium text-foreground"
                        : completed
                          ? "text-muted-foreground"
                          : "text-muted-foreground/60"
                    }
                  >
                    {stepLabel}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
