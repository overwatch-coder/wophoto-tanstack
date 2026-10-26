import { LoginForm } from "@/components/login-form";
import { Suspense } from "react";
import { parseLoginQuery } from "@/lib/validation/queries";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; invite?: string }>;
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-6xl">
        <Suspense
          fallback={
            <div className="min-h-160 w-full rounded-2xl border border-border bg-card animate-pulse" />
          }
        >
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginContent({ searchParams }: LoginPageProps) {
  const { error, invite } = parseLoginQuery(await searchParams);

  return <LoginForm error={error} invitationStatus={invite} />;
}
