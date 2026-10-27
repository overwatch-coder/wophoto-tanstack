import { Skeleton } from "@/components/ui/skeleton";
import { DelayedLoadingFallback } from "@/components/workspace/delayed-loading-fallback";

export function WorkspaceShellLoading() {
  return (
    <DelayedLoadingFallback>
      <div className="flex min-h-svh bg-background" role="status" aria-label="Loading workspace" aria-busy="true">
        <aside className="hidden w-64 shrink-0 border-r bg-sidebar p-4 text-sidebar-foreground md:block">
          <Skeleton className="mb-8 h-9 w-36" />
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-9 w-11/12" />
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <header className="flex h-16 items-center justify-between border-b px-4 sm:px-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-36" />
          </header>
          <div className="p-4 sm:p-6">
            <Skeleton className="h-24 w-full max-w-3xl" />
          </div>
        </main>
      </div>
    </DelayedLoadingFallback>
  );
}
