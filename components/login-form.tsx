import * as React from "react"
import { Link } from "@tanstack/react-router"
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  HelpCircle,
  Loader2,
  ArrowRight,
  Briefcase,
  Camera,
  UserCheck,
  Sun,
  Moon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { WoPhotoLogo } from "@/components/brand/logo"
import { useTheme } from "@/components/theme-provider"
import {
  DemoTransitionModal,
  useDemoAccessTransition,
} from "@/components/workspace/demo-transition-modal"
import { DEMO_PERSONAS, DEMO_ROLES, type DemoRole } from "@/lib/demo"

type LoginFormProps = {
  error?: string
  invitationStatus?: string
  demoEnabled?: boolean
}

export function LoginForm({ error, invitationStatus, demoEnabled = false }: LoginFormProps) {
  const { transition, isPending: demoPending, trigger, dismiss } = useDemoAccessTransition()
  const [googlePending, setGooglePending] = React.useState(false)
  const anyPending = demoPending || googlePending
  const errorMessage =
    error === "InvitationRequired"
      ? "This Google account does not have an accepted WoPhoto invitation. Accept the invitation sent to this email address before signing in."
      : error === "AccountMismatch" || error === "OAuthAccountNotLinked"
        ? "This Google account is linked to a different WoPhoto account. Ask your manager to resolve the account link before trying again."
        : error === "AccountSuspended"
          ? "Your WoPhoto account is suspended. Contact your manager to restore access."
          : error
            ? "Google sign-in could not be completed. Choose the invited Google account and try again. If this continues, contact your manager."
            : undefined

  return (
    <div className="flex w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xl lg:min-h-160">
      {/* Left Side: Editorial Photography Canvas */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex">
        {/* Subtle Background Photography */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-luminosity transition-transform duration-700 hover:scale-105"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=1600&q=80')",
          }}
        />
        {/* Gradient Scrim */}
        <div className="absolute inset-0 bg-linear-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/30" />

        {/* Camera metadata stays on the photography panel; branding sits with sign-in. */}
        <div className="relative z-10 flex justify-end">
          <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-zinc-300 backdrop-blur-xs">
            50mm ƒ/1.4 · 1/250s · ISO 100
          </div>
        </div>

        {/* Center Visual Element */}
        <div className="relative z-10 my-auto max-w-md py-8">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-white">
            Precision workflow for high-volume studio productions.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            From creative briefs and shoot schedules to multi-role daily task
            logs and direct client approvals.
          </p>
        </div>

        {/* Bottom Quote */}
        <div className="relative z-10 border-t border-white/10 pt-6">
          <blockquote className="text-xs leading-relaxed text-zinc-300 italic">
            &ldquo;WoPhoto replaced messy email chains and ad-hoc spreadsheets
            with one crystal-clear production pipeline.&rdquo;
          </blockquote>
          <p className="mt-2 text-[11px] font-medium text-zinc-400">
            Marcus Chen — Head of Photography, Studio Lumière
          </p>
        </div>
      </div>

      {/* Right Side: Clean Sign-In Form */}
      <div className="flex flex-1 flex-col justify-between p-6 sm:p-10 lg:p-12">
        {/* Keep the full logo with the sign-in action at every breakpoint. */}
        <div className="flex items-center justify-between gap-4">
          <WoPhotoLogo
            priority
            imageClassName="h-9 w-32 sm:h-10 sm:w-36"
          />
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Studio Access
            </span>
            <LoginThemeSwitcher />
          </div>
        </div>

        {/* Center Form Content */}
        <div className="mx-auto my-auto w-full max-w-md py-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Sign in to Studio
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Welcome back. Access your active shoots, team tasks, and asset
              deliveries.
            </p>
          </div>

          {/* Alert Messages */}
          {invitationStatus === "accepted" && (
            <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-900 dark:text-emerald-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold">Invitation Accepted</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-800 dark:text-emerald-300">
                    Your invitation has been registered. Continue with your
                    invited Google account to access your studio workspace.
                  </p>
                </div>
              </div>
            </div>
          )}

          {invitationStatus === "invalid" && (
            <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-semibold">
                    Invalid or Expired Invitation
                  </p>
                  <p className="mt-1 text-xs leading-relaxed opacity-90">
                    That invitation could not be accepted. It may have expired
                    or already been used. Ask your manager for a new invitation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error === "AccountSuspended" ? (
            <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-semibold">Account Suspended</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          ) : errorMessage ? (
            <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-semibold">Sign-In Notice</p>
                  <p className="mt-1 text-xs leading-relaxed opacity-90">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Real Form using signInWithGoogle */}
          <form
            action="/auth/google"
            method="GET"
            className="space-y-4"
            onSubmit={() => setGooglePending(true)}
          >
            <GoogleSubmitButton pending={googlePending} disabled={anyPending} />

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-3 text-muted-foreground">
                  Private Studio Access
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 text-xs leading-relaxed text-muted-foreground">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <HelpCircle className="size-3.5 text-orange-600 dark:text-orange-400" />
                <span>Invitation Required</span>
              </div>
              WoPhoto currently supports Google sign-in for invited members.
              Email and password sign-in is not available yet.
            </div>
          </form>

          {demoEnabled && (
            <div className="mt-6 space-y-3 border-t border-border/60 pt-6">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Explore Interactive Demo
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Enter the pre-populated Studio Lumière workspace instantly—no account needed.
                </p>
              </div>

              <div className="grid gap-2">
                {DEMO_ROLES.map((demoRole) => {
                  const persona = DEMO_PERSONAS[demoRole]
                  return (
                    <DemoRoleFormButton
                      key={demoRole}
                      role={demoRole}
                      label={persona.label}
                      summary={persona.summary}
                      disabled={anyPending}
                      pending={demoPending && transition?.role === demoRole}
                      onTrigger={(selectedRole) => void trigger("signin", selectedRole)}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <DemoTransitionModal transition={transition} onDismiss={dismiss} />

        {/* Bottom Security & Help Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4 text-xs text-muted-foreground">
          <span>© 2026 WoPhoto Studio</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="transition-colors hover:text-foreground focus-visible:underline">
              Privacy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-foreground focus-visible:underline">
              Terms
            </Link>
            <span className="cursor-default transition-colors hover:text-foreground">
              Support
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoginThemeSwitcher() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    () => true,
    () => false,
  )
  const isDark = mounted ? resolvedTheme === "dark" : true

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center rounded-full border border-border bg-muted/50 p-0.5"
    >
      <button
        type="button"
        aria-label="Light theme"
        aria-pressed={mounted && !isDark}
        onClick={() => mounted && setTheme("light")}
        className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          mounted && !isDark
            ? "bg-background text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Sun className="size-3.5" aria-hidden="true" />
        <span>Light</span>
      </button>
      <button
        type="button"
        aria-label="Dark theme"
        aria-pressed={mounted && isDark}
        onClick={() => mounted && setTheme("dark")}
        className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          mounted && isDark
            ? "bg-background text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Moon className="size-3.5" aria-hidden="true" />
        <span>Dark</span>
      </button>
    </div>
  )
}

function DemoRoleFormButton({
  role,
  label,
  summary,
  disabled,
  pending,
  onTrigger,
}: {
  role: DemoRole
  label: string
  summary: string
  disabled: boolean
  pending: boolean
  onTrigger: (role: DemoRole) => void
}) {
  const Icon = role === "MANAGER" ? Briefcase : role === "WORKER" ? Camera : UserCheck

  return (
    <form
      action="/auth/demo"
      method="POST"
      onSubmit={(event) => {
        event.preventDefault()
        onTrigger(role)
      }}
    >
      <input type="hidden" name="role" value={role} />
      <button
        type="submit"
        disabled={disabled}
        className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-2.5 text-left transition-colors hover:border-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-foreground">
            {pending ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
            ) : (
              <Icon className="size-4 text-orange-600 dark:text-orange-400" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-foreground">
              {pending ? `Opening ${label}...` : `Try as ${label}`}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {summary}
            </span>
          </span>
        </div>
        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
          aria-hidden="true"
        />
      </button>
    </form>
  )
}

function GoogleSubmitButton({
  pending,
  disabled,
}: {
  pending: boolean
  disabled: boolean
}) {
  return (
    <Button
      type="submit"
      variant="outline"
      disabled={disabled}
      className="h-11 w-full gap-3 border-border bg-card text-sm font-medium text-foreground shadow-xs transition-all duration-150 hover:bg-muted"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <span>Connecting to Google...</span>
        </>
      ) : (
        <>
          <GoogleMark />
          <span>Continue with Google</span>
        </>
      )}
    </Button>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.09-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.15a11 11 0 0 0 0 9.9l3.69-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.36c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0a11 11 0 0 0-9.85 7.05l3.69 2.84C6.71 7.29 9.14 4.36 12 4.36Z"
      />
    </svg>
  )
}
