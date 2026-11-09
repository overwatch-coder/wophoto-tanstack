import { type SerializedBriefTemplate } from "@/lib/brief-templates";
import { getProfileImageSrc } from "@/lib/profile-image";
import {
  formatBriefTemplateCategory,
  getBriefTemplateCategoryBadgeClass,
} from "@/components/brief-templates/labels";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Camera,
  Layers,
  MoreVertical,
  Edit2,
  Archive,
  RefreshCw,
  Eye,
} from "lucide-react";

interface TemplateCardProps {
  template: SerializedBriefTemplate;
  isManager: boolean;
  onPreview: (template: SerializedBriefTemplate) => void;
  onUseTemplate: (template: SerializedBriefTemplate) => void;
  onEdit?: (template: SerializedBriefTemplate) => void;
  onArchiveToggle?: (template: SerializedBriefTemplate) => void;
}

export function TemplateCard({
  template,
  isManager,
  onPreview,
  onUseTemplate,
  onEdit,
  onArchiveToggle,
}: TemplateCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden hover:border-primary/40 transition-colors">
      <div>
        {/* Cover Image or Category Placeholder */}
        <div className="relative h-36 w-full bg-muted/60 overflow-hidden flex items-center justify-center">
          {template.coverImageUrl ? (
            <img
              src={`/api/brief-templates/file?url=${encodeURIComponent(template.coverImageUrl)}`}
              alt={template.title}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground/70">
              <Camera className="size-8 stroke-[1.5]" />
              <span className="text-[11px] font-medium tracking-wide uppercase">
                {formatBriefTemplateCategory(template.category)}
              </span>
            </div>
          )}

          {/* Category Chip in Top-Left */}
          <div className="absolute top-2.5 left-2.5">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-medium border shadow-xs ${getBriefTemplateCategoryBadgeClass(
                template.category
              )}`}
            >
              {formatBriefTemplateCategory(template.category)}
            </span>
          </div>

          {/* Archived indicator */}
          {template.isArchived && (
            <div className="absolute top-2.5 right-2.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-destructive/85 text-destructive-foreground">
                Archived
              </span>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <h3
              onClick={() => onPreview(template)}
              className="font-semibold text-base leading-snug line-clamp-1 hover:text-primary cursor-pointer transition-colors"
              title={template.title}
            >
              {template.title}
            </h3>
            {template.summary ? (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {template.summary}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No description provided.
              </p>
            )}
          </div>

          {/* Metrics row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
            <div className="flex items-center gap-1">
              <Layers className="size-3.5 text-primary shrink-0" />
              <span>
                {template.shotStats.total} shot{template.shotStats.total === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <RefreshCw className="size-3.5 text-muted-foreground shrink-0" />
              <span>
                Used {template.usageCount} time{template.usageCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {/* Tags */}
          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {template.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground"
                >
                  #{tag}
                </span>
              ))}
              {template.tags.length > 3 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                  +{template.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="p-4 pt-0 border-t flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {(() => {
            const avatarUrl = getProfileImageSrc(
              template.createdBy.image,
              template.createdBy.id
            );
            return avatarUrl ? (
              <div className="relative size-6 rounded-full overflow-hidden border">
                <img
                  src={avatarUrl}
                  alt={template.createdBy.name ?? "Creator"}
                  className="size-full object-cover"
                />
              </div>
            ) : (
              <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                {template.createdBy.name?.slice(0, 1) ?? "U"}
              </div>
            );
          })()}
          <span className="text-xs text-muted-foreground line-clamp-1 max-w-[100px]">
            {template.createdBy.name ?? "Studio"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPreview(template)}
            className="size-8 p-0"
            title="Preview Template"
          >
            <Eye className="size-4" />
          </Button>

          {isManager && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUseTemplate(template)}
                className="text-xs h-8 px-2.5"
                disabled={template.isArchived}
              >
                Use Template
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="sm" className="size-8 p-0">
                      <MoreVertical className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit?.(template)}>
                    <Edit2 className="size-3.5 mr-2" />
                    Edit Template
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onArchiveToggle?.(template)}
                    className={template.isArchived ? "" : "text-destructive"}
                  >
                    <Archive className="size-3.5 mr-2" />
                    {template.isArchived ? "Restore Template" : "Archive Template"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
