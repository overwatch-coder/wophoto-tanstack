import { signInWithGoogle } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldSeparator,
} from "@/components/ui/field";

type LoginFormProps = {
  error?: string;
  invitationStatus?: string;
};

export function LoginForm({ error, invitationStatus }: LoginFormProps) {
  const errorMessage = error === "InvitationRequired"
    ? "This Google account does not have an accepted WoPhoto invitation. Accept the invitation sent to this email address before signing in."
    : error === "AccountMismatch" || error === "OAuthAccountNotLinked"
      ? "This Google account is linked to a different WoPhoto account. Ask your manager to resolve the account link before trying again."
      : error === "AccountSuspended"
        ? "Your WoPhoto account is suspended. Contact your manager to restore access."
        : error ? "Google sign-in could not be completed. Choose the invited Google account and try again. If this continues, contact your manager." : undefined;
  return (
    <div className="flex flex-col gap-5">
      <Card className="overflow-hidden rounded-lg p-0 shadow-sm">
        <CardContent className="grid p-0 md:grid-cols-2">
          <div className="flex items-center p-6 sm:p-8 md:p-10">
            <form action={signInWithGoogle} className="w-full">
              <FieldGroup>
                <div className="flex flex-col gap-2 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight">Welcome to WoPhoto</h1>
                  <p className="text-sm text-muted-foreground">
                    Sign in with the Google account your manager invited.
                  </p>
                </div>

                {errorMessage ? (
                  <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {errorMessage}
                  </p>
                ) : null}
                {invitationStatus === "accepted" ? (
                  <p role="status" className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
                    Invitation accepted. Continue with the Google account that received it.
                  </p>
                ) : null}
                {invitationStatus === "invalid" ? (
                  <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    That invitation could not be accepted. It may have expired or already been used. Ask your manager for a new invitation.
                  </p>
                ) : null}

                <Field>
                  <Button
                    type="submit"
                    variant="outline"
                    className="h-11 w-full gap-3 bg-background text-foreground hover:bg-muted"
                  >
                    <GoogleMark />
                    Continue with Google
                  </Button>
                </Field>

                <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                  Invitation required
                </FieldSeparator>

                <FieldDescription className="text-center leading-5">
                  WoPhoto currently supports Google sign in for invited members. Email and password sign in is not available yet.
                </FieldDescription>
              </FieldGroup>
            </form>
          </div>

          <aside className="relative hidden min-h-[32rem] overflow-hidden border-l bg-muted/40 p-8 sm:p-10 md:flex md:items-center md:justify-center">
            <div aria-hidden="true" className="absolute -right-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative w-full max-w-sm">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                A clear path from brief to delivery.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Keep the work, the team, and client feedback connected at every stage.
              </p>

              <ol className="relative mt-8 space-y-0">
                <div aria-hidden="true" className="absolute bottom-8 left-4 top-8 border-l border-border" />
                <li className="relative flex gap-4 pb-6">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-semibold text-card-foreground">01</span>
                  <div className="pt-0.5">
                    <h3 className="text-sm font-semibold">Brief</h3>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">Set the goals and gather the references.</p>
                  </div>
                </li>
                <li className="relative flex gap-4 pb-6">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-semibold text-card-foreground">02</span>
                  <div className="pt-0.5">
                    <h3 className="text-sm font-semibold">Production</h3>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">Assign tasks and follow the work.</p>
                  </div>
                </li>
                <li className="relative flex gap-4 pb-6">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-semibold text-card-foreground">03</span>
                  <div className="pt-0.5">
                    <h3 className="text-sm font-semibold">Review</h3>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">Keep client feedback with the project.</p>
                  </div>
                </li>
                <li className="relative flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-semibold text-card-foreground">04</span>
                  <div className="pt-0.5">
                    <h3 className="text-sm font-semibold">Delivery</h3>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">Bring the finished work together.</p>
                  </div>
                </li>
              </ol>
            </div>
          </aside>
        </CardContent>
      </Card>

      <FieldDescription className="px-6 text-center">
        Need access? Ask your project manager for an invitation.
      </FieldDescription>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.09-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.15a11 11 0 0 0 0 9.9l3.69-2.84Z" />
      <path fill="#EA4335" d="M12 4.36c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0a11 11 0 0 0-9.85 7.05l3.69 2.84C6.71 7.29 9.14 4.36 12 4.36Z" />
    </svg>
  );
}
