import { LoginForm } from "@/components/login-form";
import { Layers3 } from "lucide-react";
import { Suspense } from "react";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; invite?: string }>;
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <a href="/login" className="mb-6 flex w-fit items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Layers3 aria-hidden="true" className="size-5" />
          </span>
          <span className="text-base font-semibold tracking-tight">WoPhoto</span>
        </a>
        <Suspense fallback={<div className="min-h-96 rounded-lg border bg-card" />}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginContent({ searchParams }: LoginPageProps) {
  const { error, invite } = await searchParams;

  return (
    <LoginForm
      blocked={error === "AccessDenied"}
      invitationStatus={invite}
    />
  );
}
