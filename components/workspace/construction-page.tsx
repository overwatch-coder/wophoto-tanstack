import { Hammer } from "lucide-react";

export function ConstructionPage({ title }: { title: string }) {
  return (
    <section className="mx-auto flex min-h-[min(28rem,65vh)] w-full max-w-4xl flex-col items-center justify-center rounded-md border bg-card px-6 py-12 text-center shadow-sm sm:px-10">
      <span className="mb-5 flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Hammer aria-hidden="true" className="size-5" />
      </span>
      <h2 className="text-xl font-semibold tracking-tight">Under construction</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        The {title} section is being built and will be available here when it is ready.
      </p>
    </section>
  );
}
