import { cn } from "@/lib/utils"

interface WoPhotoLogoProps {
  className?: string
  imageClassName?: string
  showSubtitle?: boolean
  subtitle?: string
  priority?: boolean
  compact?: boolean
}

interface WoPhotoMarkProps {
  className?: string
  priority?: boolean
}

export function WoPhotoMark({ className }: WoPhotoMarkProps) {
  return (
    <img
      src="/assets/logo-mark.png"
      alt="WoPhoto"
      width={512}
      height={512}
      className={cn("size-8 shrink-0 object-contain", className)}
    />
  )
}

/** The supplied WoPhoto wordmark, trimmed for clean display at app sizes. */
export function WoPhotoLogo({
  className,
  imageClassName,
  showSubtitle = false,
  subtitle = "Studio Workspace",
  compact = false,
}: WoPhotoLogoProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          compact ? "h-8 w-28" : "h-11 w-40",
          imageClassName,
        )}
      >
        <img
          src="/assets/logo-trimmed.png"
          alt="WoPhoto"
          width={1606}
          height={453}
          className="h-full w-full object-contain"
        />
      </span>
      {showSubtitle && (
        <span className="truncate text-[11px] font-medium text-muted-foreground">
          {subtitle}
        </span>
      )}
    </div>
  )
}
