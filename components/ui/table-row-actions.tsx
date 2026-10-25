"use client"

import type { ReactNode } from "react"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function TableRowActions({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            className="size-8"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="min-w-40"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
