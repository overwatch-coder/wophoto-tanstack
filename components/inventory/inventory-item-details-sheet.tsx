"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { CatalogItem } from "@/components/inventory/inventory-catalog-view"

function dateLabel(value: Date | string | null) {
  if (!value) return "Not recorded"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
}

function Detail({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="min-w-0 border-b border-border/70 py-3 last:border-b-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm break-words text-foreground">
        {value || "Not recorded"}
      </dd>
    </div>
  )
}

export function InventoryItemDetailsSheet({
  item,
  onOpenChange,
}: {
  item: CatalogItem | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={Boolean(item)} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[min(96vw,36rem)] data-[side=right]:sm:max-w-xl"
      >
        {item && (
          <>
            <SheetHeader className="shrink-0 border-b border-border px-5 py-5 pr-14 text-left sm:px-6">
              <SheetTitle className="break-words">{item.name}</SheetTitle>
              <SheetDescription>
                Asset {item.assetTag} ·{" "}
                {item.status.replaceAll("_", " ").toLowerCase()}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
              <dl>
                <Detail label="Category" value={item.category} />
                <Detail label="Model / Brand" value={item.model} />
                <Detail label="Serial number" value={item.serialNumber} />
                <Detail
                  label="Condition"
                  value={item.condition.replaceAll("_", " ").toLowerCase()}
                />
                <Detail label="Storage location" value={item.location} />
                <Detail
                  label="Purchase date"
                  value={dateLabel(item.purchaseDate)}
                />
                <Detail label="Notes and instructions" value={item.notes} />
                {item.activeLoan && (
                  <>
                    <Detail
                      label="Borrower"
                      value={
                        item.activeLoan.borrower.name ||
                        item.activeLoan.borrower.email
                      }
                    />
                    <Detail
                      label="Checked out"
                      value={dateLabel(item.activeLoan.checkedOutAt)}
                    />
                    <Detail
                      label="Expected return"
                      value={dateLabel(item.activeLoan.expectedReturnAt)}
                    />
                  </>
                )}
              </dl>
              {item.metadata && Object.keys(item.metadata).length > 0 && (
                <section className="mt-5">
                  <h3 className="text-sm font-semibold text-foreground">
                    Custom attributes
                  </h3>
                  <dl className="mt-2">
                    {Object.entries(item.metadata).map(([key, value]) => (
                      <Detail
                        key={key}
                        label={key}
                        value={
                          typeof value === "string"
                            ? value
                            : JSON.stringify(value)
                        }
                      />
                    ))}
                  </dl>
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
