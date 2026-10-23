import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_PAGE_SIZE, getPageItems, makePageHref, type SearchParamsRecord } from "@/lib/pagination";

export function Pagination({
  pathname,
  searchParams,
  page,
  totalPages,
  totalItems,
}: {
  pathname: string;
  searchParams: SearchParamsRecord;
  page: number;
  totalPages: number;
  totalItems: number;
}) {
  if (totalItems === 0 || totalPages <= 1) return null;

  const first = (page - 1) * DEFAULT_PAGE_SIZE + 1;
  const last = Math.min(page * DEFAULT_PAGE_SIZE, totalItems);
  const itemClass = "size-9 rounded-md";
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p className="text-sm text-muted-foreground">Showing {first}–{last} of {totalItems}</p>
      <div className="flex items-center gap-1">
        <Button nativeButton={false} render={<Link href={makePageHref(pathname, searchParams, Math.max(1, page - 1))} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} />} variant="outline" size="icon" className={`${itemClass} ${page <= 1 ? "pointer-events-none opacity-50" : ""}`} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Button>
        {getPageItems(page, totalPages).map((item, index) => item === "ellipsis" ? (
          <span key={`ellipsis-${index}`} aria-hidden="true" className="flex size-9 items-center justify-center text-muted-foreground"><MoreHorizontal className="size-4" /></span>
        ) : (
          <Button key={item} nativeButton={false} render={<Link href={makePageHref(pathname, searchParams, item)} aria-current={item === page ? "page" : undefined} />} variant={item === page ? "default" : "outline"} size="icon" className={itemClass} aria-label={`Page ${item}`}>
            {item}
          </Button>
        ))}
        <Button nativeButton={false} render={<Link href={makePageHref(pathname, searchParams, Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages} tabIndex={page >= totalPages ? -1 : undefined} />} variant="outline" size="icon" className={`${itemClass} ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
