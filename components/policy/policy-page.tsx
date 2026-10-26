import type { ReactNode } from "react"
import Link from "next/link"
import { WoPhotoLogo } from "@/components/brand/logo"

export function PolicyPage({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <main className="min-h-svh bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <WoPhotoLogo compact priority />
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:underline"
          >
            Back to sign in
          </Link>
        </header>

        <article className="policy-copy">
          <h1>{title}</h1>
          <p className="policy-updated">Last updated: October 26, 2026</p>
          {children}
        </article>

        <nav aria-label="Legal policies" className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
          <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">Privacy</Link>
          <Link href="/terms" className="underline-offset-4 hover:text-foreground hover:underline">Terms</Link>
          <Link href="/login" className="underline-offset-4 hover:text-foreground hover:underline">Sign in</Link>
        </nav>
      </div>
    </main>
  )
}
