"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { type SerializedBriefTemplate } from "@/lib/brief-templates";
import {
  formatBriefTemplateCategory,
  getBriefTemplateCategoryBadgeClass,
} from "@/components/brief-templates/labels";
import { type ShotItem } from "@/lib/validation/briefs";
import {
  Camera,
  Link as LinkIcon,
  FileText,
  Download,
} from "lucide-react";

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: SerializedBriefTemplate | null;
  isManager: boolean;
  onUseTemplate: (template: SerializedBriefTemplate) => void;
}

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  template,
  isManager,
  onUseTemplate,
}: TemplatePreviewDialogProps) {
  if (!template) return null;

  const rawShots = Array.isArray(template.shotList)
    ? (template.shotList as ShotItem[])
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:!max-w-5xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium border ${getBriefTemplateCategoryBadgeClass(
                template.category
              )}`}
            >
              {formatBriefTemplateCategory(template.category)}
            </span>
            <span className="text-xs text-muted-foreground">
              Used {template.usageCount} time{template.usageCount === 1 ? "" : "s"}
            </span>
          </div>
          <DialogTitle className="text-xl">{template.title}</DialogTitle>
          {template.summary && (
            <DialogDescription className="text-sm pt-1">
              {template.summary}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Cover Image banner if present */}
          {template.coverImageUrl && (
            <div className="relative h-48 w-full rounded-lg overflow-hidden border">
              <Image
                src={`/api/brief-templates/file?url=${encodeURIComponent(template.coverImageUrl)}`}
                alt={template.title}
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Guidelines & Deliverables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 p-3.5 rounded-lg border bg-muted/20">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Visual & Lighting Guidelines
              </h4>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {template.guidelines || "No specific guidelines specified."}
              </p>
            </div>
            <div className="space-y-1.5 p-3.5 rounded-lg border bg-muted/20">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Deliverable Specifications
              </h4>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {template.deliverables || "Standard studio deliverable defaults."}
              </p>
            </div>
          </div>

          {/* Shot List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="size-4 text-primary" />
                <h4 className="font-semibold text-sm">
                  Shot List ({rawShots.length} Setup{rawShots.length === 1 ? "" : "s"})
                </h4>
              </div>
            </div>

            {rawShots.length > 0 ? (
              <div className="space-y-2">
                {rawShots.map((shot, idx) => (
                  <div
                    key={shot.id}
                    className="p-3 rounded-lg border bg-card text-card-foreground text-sm space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground font-semibold">
                        #{idx + 1}
                      </span>
                      <span className="font-medium">{shot.title}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-muted text-foreground border">
                        {shot.framing}
                      </span>
                    </div>
                    {shot.description && (
                      <p className="text-xs text-muted-foreground pl-6">
                        {shot.description}
                      </p>
                    )}
                    {shot.props && shot.props.length > 0 && (
                      <div className="pl-6 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">Props:</span>{" "}
                        {shot.props.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No predefined shots in this template.
              </p>
            )}
          </div>

          {/* Reference Links & Attachments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            {/* Links */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <LinkIcon className="size-4 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reference Links
                </h4>
              </div>
              {template.externalLinks && template.externalLinks.length > 0 ? (
                <div className="space-y-1.5">
                  {template.externalLinks.map((link, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded border bg-background text-xs truncate"
                    >
                      <span className="font-medium mr-1.5">{link.label}:</span>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        {link.url}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No external links provided.
                </p>
              )}
            </div>

            {/* Attachment */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reference File
                </h4>
              </div>
              {template.attachmentUrl ? (
                <div className="flex items-center justify-between p-2.5 rounded border bg-background text-xs">
                  <div className="truncate max-w-[200px]">
                    <span className="font-medium">
                      {template.attachmentName ?? "Attached Style Document"}
                    </span>
                  </div>
                  <a
                    href={`/api/brief-templates/file?url=${encodeURIComponent(template.attachmentUrl)}&download=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className={buttonVariants({ variant: "outline", size: "sm" }) + " h-7 text-xs"}
                  >
                    <Download className="size-3 mr-1" />
                    Download
                  </a>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No reference document attached.
                </p>
              )}
            </div>
          </div>

          {/* Source project link if converted from brief */}
          {template.sourceBrief && (
            <div className="p-2.5 rounded bg-muted/40 border text-xs text-muted-foreground flex items-center justify-between">
              <span>
                Derived from project brief:{" "}
                <span className="font-medium text-foreground">
                  {template.sourceBrief.title}
                </span>{" "}
                ({template.sourceBrief.project.name})
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {isManager && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onUseTemplate(template);
              }}
              disabled={template.isArchived}
            >
              Use This Template
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
