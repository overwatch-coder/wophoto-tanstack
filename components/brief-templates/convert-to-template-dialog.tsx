"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { convertBriefToTemplate } from "@/app/actions/brief-templates";
import { BriefTemplateCategory } from "@/generated/prisma/browser";
import {
  BRIEF_TEMPLATE_CATEGORY_LABELS,
  formatBriefTemplateCategory,
} from "@/components/brief-templates/labels";
import { Loader2, X } from "lucide-react";

interface ConvertToTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brief: { id: string; title: string; tags?: string[] } | null;
  onSuccess?: (templateId: string) => void;
}

export function ConvertToTemplateDialog({
  open,
  onOpenChange,
  brief,
  onSuccess,
}: ConvertToTemplateDialogProps) {
  const [title, setTitle] = useState(brief?.title ?? "");
  const [category, setCategory] = useState<BriefTemplateCategory>(
    BriefTemplateCategory.COMMERCIAL
  );
  const [tags, setTags] = useState<string[]>(brief?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!brief) return null;

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 20) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Please enter a template title.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await convertBriefToTemplate({
        briefId: brief.id,
        title: title.trim(),
        category,
        tags,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else if (res.templateId) {
        onSuccess?.(res.templateId);
        onOpenChange(false);
      }
    } catch {
      setErrorMessage("Failed to convert brief to template.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:!max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert to Studio Template</DialogTitle>
          <DialogDescription>
            Turn &quot;{brief.title}&quot; into a reusable studio template. All
            guidelines, deliverables, reference links, and shot items will be
            copied into the template with shot statuses reset to planned.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMessage && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5 md:w-1/2">
            <Label htmlFor="convert-title">
              Template Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="convert-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Master E-Commerce Lookbook Template"
              required
              maxLength={150}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="convert-category">Category</Label>
            <Select
              value={category}
              onValueChange={(val) => setCategory(val as BriefTemplateCategory)}
            >
              <SelectTrigger id="convert-category" className="w-full">
                <SelectValue>{formatBriefTemplateCategory(category)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.keys(BRIEF_TEMPLATE_CATEGORY_LABELS).map((catKey) => (
                  <SelectItem key={catKey} value={catKey}>
                    {formatBriefTemplateCategory(catKey as BriefTemplateCategory)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="convert-tags">Tags</Label>
            <div className="flex items-center gap-2">
              <Input
                id="convert-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tags..."
                maxLength={30}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
              >
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted text-foreground border border-border"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Converting...
                </>
              ) : (
                "Save as Template"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
