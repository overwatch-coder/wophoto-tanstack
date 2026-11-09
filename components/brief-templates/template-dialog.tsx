import { useState } from "react";
import { upload } from "@vercel/blob/client";
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
import { Textarea } from "@/components/ui/textarea";
import { FileDropzone } from "@/components/ui/file-dropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBriefTemplate,
  updateBriefTemplate,
} from "@/app/actions/brief-templates";
import {
  SHOT_FRAMING_OPTIONS,
  type ShotItem,
  type ShotFraming,
} from "@/lib/validation/briefs";
import { BriefTemplateCategory } from "@/generated/prisma/browser";
import {
  BRIEF_TEMPLATE_CATEGORY_LABELS,
  formatBriefTemplateCategory,
} from "@/components/brief-templates/labels";
import {
  Loader2,
  Trash2,
  Plus,
  Link as LinkIcon,
  X,
  FileText,
  Camera,
} from "lucide-react";

export interface BriefTemplateFormData {
  id?: string;
  title: string;
  summary?: string | null;
  category: BriefTemplateCategory;
  tags: string[];
  deliverables?: string | null;
  guidelines?: string | null;
  externalLinks?: Array<{ label: string; url: string }> | null;
  shotList?: ShotItem[] | null;
  coverImageUrl?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  isArchived?: boolean;
}

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: BriefTemplateFormData | null;
  onSuccess?: (templateId: string) => void;
}

export function TemplateDialog({
  open,
  onOpenChange,
  template,
  onSuccess,
}: TemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:!max-w-5xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template?.id ? "Edit Brief Template" : "Create Brief Template"}
          </DialogTitle>
          <DialogDescription>
            {template?.id
              ? "Update standard creative guidelines, shot items, and reference assets for this template."
              : "Define a reusable blueprint for photography or video shoots across your studio."}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <TemplateForm
            template={template}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateForm({
  template,
  onClose,
  onSuccess,
}: Omit<TemplateDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const isEditing = Boolean(template?.id);

  const [title, setTitle] = useState(template?.title ?? "");
  const [summary, setSummary] = useState(template?.summary ?? "");
  const [category, setCategory] = useState<BriefTemplateCategory>(
    template?.category ?? BriefTemplateCategory.COMMERCIAL
  );
  const [tags, setTags] = useState<string[]>(template?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [deliverables, setDeliverables] = useState(template?.deliverables ?? "");
  const [guidelines, setGuidelines] = useState(template?.guidelines ?? "");

  // External Links
  const [externalLinks, setExternalLinks] = useState<
    Array<{ label: string; url: string }>
  >(template?.externalLinks ?? []);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  // Shot list
  const [shots, setShots] = useState<ShotItem[]>(
    template?.shotList ? [...template.shotList] : []
  );
  const [newShotTitle, setNewShotTitle] = useState("");
  const [newShotFraming, setNewShotFraming] = useState<ShotFraming>("MEDIUM");
  const [newShotDesc, setNewShotDesc] = useState("");
  const [newShotProps, setNewShotProps] = useState("");

  // Files & Covers
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    template?.coverImageUrl ?? null
  );
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(
    template?.attachmentUrl ?? null
  );
  const [attachmentName, setAttachmentName] = useState<string | null>(
    template?.attachmentName ?? null
  );

  // Loading & error
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleAddLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return;
    try {
      const url = new URL(newLinkUrl.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      setExternalLinks([
        ...externalLinks,
        { label: newLinkLabel.trim(), url: newLinkUrl.trim() },
      ]);
      setNewLinkLabel("");
      setNewLinkUrl("");
    } catch {
      // Invalid URL
    }
  };

  const handleRemoveLink = (index: number) => {
    setExternalLinks(externalLinks.filter((_, i) => i !== index));
  };

  const handleAddShot = () => {
    if (!newShotTitle.trim()) return;
    const propsList = newShotProps
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const newShot: ShotItem = {
      id: crypto.randomUUID(),
      title: newShotTitle.trim(),
      framing: newShotFraming,
      description: newShotDesc.trim() || null,
      props: propsList,
      status: "PLANNED",
      order: shots.length,
    };

    setShots([...shots, newShot]);
    setNewShotTitle("");
    setNewShotDesc("");
    setNewShotProps("");
    setNewShotFraming("MEDIUM");
  };

  const handleRemoveShot = (id: string) => {
    setShots(shots.filter((s) => s.id !== id));
  };

  const handleCoverUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsUploadingCover(true);
    setErrorMessage(null);
    try {
      const pathname = `brief-templates/covers/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/brief-templates/upload",
        contentType: file.type,
      });
      setCoverImageUrl(blob.url);
    } catch {
      setErrorMessage("Failed to upload cover image.");
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleAttachmentUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsUploadingAttachment(true);
    setErrorMessage(null);
    try {
      const pathname = `brief-templates/attachments/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/brief-templates/upload",
        contentType: file.type,
      });
      setAttachmentUrl(blob.url);
      setAttachmentName(file.name);
    } catch {
      setErrorMessage("Failed to attach file.");
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Please enter a template title.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      title: title.trim(),
      summary: summary.trim() || null,
      category,
      tags,
      deliverables: deliverables.trim() || null,
      guidelines: guidelines.trim() || null,
      externalLinks: externalLinks.length > 0 ? externalLinks : null,
      shotList: shots.length > 0 ? shots : null,
      coverImageUrl,
      attachmentUrl,
      attachmentName,
    };

    try {
      if (isEditing && template?.id) {
        const res = await updateBriefTemplate({
          ...payload,
          id: template.id,
        });
        if (res.error) {
          setErrorMessage(res.error);
        } else {
          onSuccess?.(template.id);
          onClose();
        }
      } else {
        const res = await createBriefTemplate(payload);
        if (res.error) {
          setErrorMessage(res.error);
        } else if (res.templateId) {
          onSuccess?.(res.templateId);
          onClose();
        }
      }
    } catch {
      setErrorMessage("Failed to save template.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-2">
      {errorMessage && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
          {errorMessage}
        </div>
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="template-title">
            Template Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="template-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. E-Commerce White Seamless Apparel Setup"
            required
            maxLength={150}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="template-category">Category</Label>
          <Select
            value={category}
            onValueChange={(val) => setCategory(val as BriefTemplateCategory)}
          >
            <SelectTrigger id="template-category" className="w-full">
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

        <div className="space-y-2">
          <Label htmlFor="template-cover">Cover Image (Optional)</Label>
          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            {coverImageUrl ? (
              <div className="relative size-12 rounded border overflow-hidden shrink-0">
                <img
                  src={`/api/brief-templates/file?url=${encodeURIComponent(coverImageUrl)}`}
                  alt="Cover Preview"
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setCoverImageUrl(null)}
                  className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-white"
                  title="Remove cover"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <FileDropzone
                accept="image/jpeg,image/png,image/webp,image/avif"
                onFiles={handleCoverUpload}
                disabled={isUploadingCover}
                title={isUploadingCover ? "Uploading cover image…" : "Drop a cover image here, or browse"}
                description="JPEG, PNG, WebP, or AVIF. Maximum size 10MB."
                className="min-h-24"
              />
            </div>
            {isUploadingCover && <Loader2 className="size-4 animate-spin shrink-0" />}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-2">
        <Label htmlFor="template-summary">Summary Overview</Label>
        <Textarea
          id="template-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Brief summary of what this shoot template covers, typical duration, and studio requirements."
          rows={2}
          maxLength={1000}
        />
      </div>

      {/* Tags Input */}
      <div className="space-y-2">
        <Label htmlFor="template-tags">Studio Tags</Label>
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            id="template-tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder="Type tag (e.g. seamless, high key, apparel) and press Enter"
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
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-muted text-foreground border border-border"
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

      {/* Guidelines & Deliverables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="template-guidelines">Visual & Lighting Guidelines</Label>
          <Textarea
            id="template-guidelines"
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            placeholder="Key lighting ratios, color temperature, background rolls, mood references, and camera lenses."
            rows={4}
            maxLength={5000}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-deliverables">Deliverable Specifications</Label>
          <Textarea
            id="template-deliverables"
            value={deliverables}
            onChange={(e) => setDeliverables(e.target.value)}
            placeholder="File dimensions, aspect ratios, sRGB/AdobeRGB profiles, color grading targets, and delivery deadlines."
            rows={4}
            maxLength={5000}
          />
        </div>
      </div>

      {/* Structured Shot List Builder */}
      <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="size-4 text-primary" />
            <span className="font-semibold text-sm">Default Shot List Items</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {shots.length} setup{shots.length === 1 ? "" : "s"} defined
          </span>
        </div>

        {/* Existing Shots */}
        {shots.length > 0 && (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {shots.map((shot, idx) => (
              <div
                key={shot.id}
                className="flex items-start justify-between p-2.5 rounded bg-background border text-sm gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <span className="font-medium">{shot.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-muted text-muted-foreground">
                      {shot.framing}
                    </span>
                  </div>
                  {shot.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {shot.description}
                    </p>
                  )}
                  {shot.props && shot.props.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Props: {shot.props.join(", ")}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveShot(shot.id)}
                  className="size-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add New Shot */}
        <div className="pt-2 border-t space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="md:col-span-2">
              <Input
                placeholder="Setup name (e.g. Front 3/4 hero crop)"
                value={newShotTitle}
                onChange={(e) => setNewShotTitle(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <Select
                value={newShotFraming}
                onValueChange={(v) => setNewShotFraming(v as ShotFraming)}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Framing">
                    {newShotFraming.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SHOT_FRAMING_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt} className="text-xs">
                      {opt.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input
              placeholder="Notes, pose or lighting instructions"
              value={newShotDesc}
              onChange={(e) => setNewShotDesc(e.target.value)}
              className="text-xs"
            />
            <Input
              placeholder="Props, styling items (comma separated)"
              value={newShotProps}
              onChange={(e) => setNewShotProps(e.target.value)}
              className="text-xs"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddShot}
            disabled={!newShotTitle.trim()}
            className="w-full text-xs"
          >
            <Plus className="size-3.5 mr-1" /> Add Shot Item
          </Button>
        </div>
      </div>

      {/* External Reference Links */}
      <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
        <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
            <LinkIcon className="size-4 text-primary" />
            <span className="font-semibold text-sm">Reference Links</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {externalLinks.length} link{externalLinks.length === 1 ? "" : "s"}
          </span>
        </div>

        {externalLinks.length > 0 && (
          <div className="space-y-1.5">
            {externalLinks.map((link, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded bg-background border text-xs"
              >
                <div className="truncate max-w-[80%]">
                  <span className="font-medium mr-2">{link.label}:</span>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate"
                  >
                    {link.url}
                  </a>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveLink(idx)}
                  className="size-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 border-t pt-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:items-center">
          <Input
            placeholder="Label (e.g. Figma Board)"
            value={newLinkLabel}
            onChange={(e) => setNewLinkLabel(e.target.value)}
            className="w-full text-xs"
          />
          <Input
            placeholder="https://..."
            value={newLinkUrl}
            onChange={(e) => setNewLinkUrl(e.target.value)}
            className="w-full text-xs"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddLink}
            disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
            className="w-full text-xs md:w-auto md:shrink-0"
          >
            Add Link
          </Button>
        </div>
      </div>

      {/* Attachment File */}
      <div className="space-y-2">
        <Label htmlFor="template-attachment">Style Guide PDF or Manual</Label>
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          {attachmentUrl ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded border bg-muted/40 text-xs text-foreground">
              <FileText className="size-4 text-primary shrink-0" />
              <span className="truncate max-w-[200px]">
                {attachmentName ?? "Attached Document"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAttachmentUrl(null);
                  setAttachmentName(null);
                }}
                className="text-muted-foreground hover:text-destructive ml-1"
                title="Remove attachment"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : null}
          <FileDropzone
            accept=".pdf,.zip,.doc,.docx,application/pdf,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onFiles={handleAttachmentUpload}
            disabled={isUploadingAttachment}
            title={isUploadingAttachment ? "Uploading attachment…" : "Drop a style guide here, or browse"}
            description="PDF, ZIP, or Word document. Maximum size 25MB."
            className="min-h-24"
          />
          {isUploadingAttachment && <Loader2 className="size-4 animate-spin shrink-0" />}
        </div>
      </div>

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin mr-2" />
              Saving...
            </>
          ) : isEditing ? (
            "Save Changes"
          ) : (
            "Create Template"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
