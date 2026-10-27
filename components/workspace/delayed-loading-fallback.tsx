"use client"

import { useEffect, useState, type ReactNode } from "react"

/** Keep fast server responses from flashing a loading placeholder. */
export function DelayedLoadingFallback({
  children,
  delay = 250,
}: {
  children: ReactNode
  delay?: number
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(true), delay)
    return () => window.clearTimeout(timeout)
  }, [delay])

  return visible ? children : null
}
