import { Skeleton } from "@/components/ui/skeleton"

type PageLoadingVariant =
  "dashboard" | "tasks" | "projects" | "invitations" | "feedback" | "basic"

export function PageLoadingSkeleton({
  variant,
  label = "Loading page",
}: {
  variant: PageLoadingVariant
  label?: string
}) {
  return (
    <main
      role="status"
      aria-label={label}
      aria-busy="true"
      className="mx-auto w-full max-w-7xl space-y-6"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {variant === "dashboard" ? <DashboardSkeleton /> : null}
        {variant === "tasks" ? <TasksSkeleton /> : null}
        {variant === "projects" ? <ProjectsSkeleton /> : null}
        {variant === "invitations" ? <InvitationsSkeleton /> : null}
        {variant === "feedback" ? <FeedbackSkeleton /> : null}
        {variant === "basic" ? <BasicSkeleton /> : null}
      </div>
    </main>
  )
}

function PageHeading({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {action ? <Skeleton className="h-10 w-36" /> : null}
    </div>
  )
}

function MetricCards({ count = 4 }: { count?: number }) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 ${count === 5 ? "xl:grid-cols-5" : "lg:grid-cols-4"}`}
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-3 rounded-xl border bg-card p-4">
          <Skeleton className="h-4 w-28 max-w-full" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-24 max-w-full" />
        </div>
      ))}
    </div>
  )
}

function TableRows({ columns = 5 }: { columns?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div
            className="grid gap-4 border-b bg-muted/30 px-4 py-3"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: columns }, (_, index) => (
              <Skeleton key={index} className="h-3 w-20 max-w-full" />
            ))}
          </div>
          <div className="divide-y">
            {Array.from({ length: 4 }, (_, row) => (
              <div
                key={row}
                className="grid min-h-16 items-center gap-4 px-4 py-3"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: columns }, (_, column) => (
                  <Skeleton
                    key={column}
                    className={`h-4 max-w-full ${column === 0 ? "w-36" : "w-24"}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <PageHeading action />
      <MetricCards count={5} />
      <div className="grid gap-4 xl:grid-cols-2" aria-hidden="true">
        <div className="space-y-5 rounded-xl border bg-card p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
        <div className="space-y-5 rounded-xl border bg-card p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
      <TableRows columns={4} />
    </>
  )
}

function TasksSkeleton() {
  return (
    <>
      <PageHeading action />
      <MetricCards />
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        aria-hidden="true"
      >
        <div className="flex gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-10 w-64 max-w-full" />
      </div>
      <TableRows columns={7} />
    </>
  )
}

function ProjectsSkeleton() {
  return (
    <>
      <PageHeading action />
      <MetricCards />
      <div
        className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row"
        aria-hidden="true"
      >
        <Skeleton className="h-10 w-full sm:flex-1" />
        <Skeleton className="h-10 w-full sm:w-48" />
      </div>
      <TableRows columns={6} />
    </>
  )
}

function InvitationsSkeleton() {
  return (
    <>
      <PageHeading action />
      <MetricCards />
      <div
        className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        aria-hidden="true"
      >
        <Skeleton className="h-10 w-full sm:max-w-sm" />
        <Skeleton className="h-10 w-full sm:w-80" />
      </div>
      <TableRows columns={5} />
    </>
  )
}

function FeedbackSkeleton() {
  return (
    <>
      <PageHeading action />
      <MetricCards count={3} />
      <div className="flex flex-col gap-4" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-4 rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-5 w-48 max-w-full" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-4 w-3/4 max-w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    </>
  )
}

function BasicSkeleton() {
  return (
    <>
      <PageHeading />
      <div
        className="space-y-4 rounded-xl border bg-card p-5"
        aria-hidden="true"
      >
        <Skeleton className="h-5 w-48 max-w-full" />
        <Skeleton className="h-4 w-2/3 max-w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </>
  )
}
