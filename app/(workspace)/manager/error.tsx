"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ManagerError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[manager-page] Route failed to load:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center px-4 py-12">
      <section className="w-full rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <AlertTriangle aria-hidden="true" className="size-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
          This studio page could not load
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          WoPhoto could not load this page right now. Try again, or return to your studio dashboard.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs text-muted-foreground">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => retry()}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Try again
          </Button>
          <Button variant="outline" render={<Link href="/manager" />}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to dashboard
          </Button>
        </div>
      </section>
    </main>
  );
}
