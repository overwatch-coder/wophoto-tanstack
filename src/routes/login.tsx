import { createFileRoute } from "@tanstack/react-router";
import { parseLoginQuery } from "@/lib/validation/queries";
import { LoginForm } from "@/components/login-form";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { error?: string; invite?: string } => ({
    error: typeof search.error === "string" ? search.error : undefined,
    invite: typeof search.invite === "string" ? search.invite : undefined,
  }),
  head: () => ({
    meta: [{ title: "Sign In | WoPhoto" }],
  }),
  component: LoginPageComponent,
});

function LoginPageComponent() {
  const search = Route.useSearch();
  const { error, invite } = parseLoginQuery(search);

  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-6xl">
        <LoginForm error={error} invitationStatus={invite} />
      </div>
    </main>
  );
}

