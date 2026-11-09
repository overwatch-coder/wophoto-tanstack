
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBriefOption } from "@/components/briefs/labels";
import {
  createCreativeBrief,
  updateCreativeBrief,
} from "@/src/server/actions/briefs";
import {
  SHOT_FRAMING_OPTIONS,
  type ShotItem,
  type ShotFraming,
} from "@/lib/validation/briefs";
import {
  BriefStatus,
} from "@/generated/prisma/browser";
import {
  Loader2,
  Trash2,
  Plus,
  Upload,
  Link as LinkIcon,
  X,
  FileText,
  Camera,
} from "lucide-react";

export interface CreativeBriefFormData {
  id: string;
  projectId: string;
  title: string;
  summary?: string | null;
  status: BriefStatus;
  isPrimary: boolean;
  version: number;
  deliverables?: string | null;
  guidelines?: string | null;
  shotList?: ShotItem[] | null;
  externalUrl?: string | null;
  fileUrl?: string | null;
  fileKey?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileMime?: string | null;
  tags: string[];
}

interface ProjectOption {
  id: string;
  name: string;
  clientId: string;
}

interface BriefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brief?: CreativeBriefFormData | null;
  canDeleteDraft?: boolean;
  projects: ProjectOption[];
  onSuccess?: () => void;
  onDeleteRequest?: (brief: { id: string; title: string }) => void;
}

export function BriefDialog({
  open,
  onOpenChange,
  brief,
  canDeleteDraft,
  projects,
  onSuccess,
  onDeleteRequest,
}: BriefDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-5xl max-h-[92dvh] overflow-y-auto p-4 sm:w-[calc(100%-2rem)] sm:max-w-5xl sm:p-6">
        {open && (
          <BriefForm
            key={brief?.id ?? "new"}
            brief={brief}
            canDeleteDraft={canDeleteDraft}
            projects={projects}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
            onDeleteRequest={onDeleteRequest}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BriefForm({
  brief,
  canDeleteDraft,
  projects,
  onOpenChange,
  onSuccess,
  onDeleteRequest,
}: Omit<BriefDialogProps, "open">) {
  const isEditing = Boolean(brief?.id);

  const [projectId, setProjectId] = useState(
    brief?.projectId || (projects[0]?.id ?? "")
  );
  const [title, setTitle] = useState(brief?.title || "");
  const [summary, setSummary] = useState(brief?.summary || "");
  const [isPrimary, setIsPrimary] = useState(brief?.isPrimary ?? false);
  const [deliverables, setDeliverables] = useState(brief?.deliverables || "");
  const [guidelines, setGuidelines] = useState(brief?.guidelines || "");

  const [externalUrl, setExternalUrl] = useState(brief?.externalUrl || "");
  const [fileUrl, setFileUrl] = useState(brief?.fileUrl || "");
  const [fileKey, setFileKey] = useState(brief?.fileKey || "");
  const [fileName, setFileName] = useState(brief?.fileName || "");
  const [fileSize, setFileSize] = useState<number | null>(brief?.fileSize || null);
  const [fileMime, setFileMime] = useState(brief?.fileMime || "");

  const [shotList, setShotList] = useState<ShotItem[]>(
    Array.isArray(brief?.shotList) && brief.shotList.length > 0
      ? brief.shotList
      : []
  );

  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(brief?.tags || []);

  const [majorRevision, setMajorRevision] = useState(false);
  const [revisionSummary, setRevisionSummary] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Shot list item management
  const handleAddShot = () => {
    const newShot: ShotItem = {
      id: `shot-${Date.now()}`,
      title: `Shot ${shotList.length + 1}`,
      description: "",
      props: [],
      framing: "MEDIUM",
      status: "PLANNED",
      order: shotList.length,
    };
    setShotList([...shotList, newShot]);
  };

  const handleUpdateShot = (
    index: number,
    field: keyof ShotItem,
    value: unknown
  ) => {
    const updated = [...shotList];
    updated[index] = { ...updated[index], [field]: value };
    setShotList(updated);
  };

  const handleRemoveShot = (index: number) => {
    setShotList(shotList.filter((_, i) => i !== index));
  };

  // Tag management
  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // File upload handling
  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      if (file.size > 25 * 1024 * 1024) {
        throw new Error("File exceeds maximum allowed size of 25MB.");
      }
      const mimeByExtension: Record<string, string> = {
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        txt: "text/plain",
      };
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      const contentType = file.type || mimeByExtension[extension];
      if (!contentType) throw new Error("Choose a PDF, image, text, Word, Excel, or PowerPoint file.");
      const pathname = `briefs/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/briefs/upload",
        contentType,
      });
      setFileUrl(blob.url);
      setFileKey(blob.pathname);
      setFileName(file.name);
      setFileSize(file.size);
      setFileMime(contentType);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to upload attachment.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage("Please enter a brief title.");
      return;
    }
    if (!projectId) {
      setErrorMessage("Please select a project.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && brief?.id) {
        const res = await updateCreativeBrief({
          id: brief.id,
          title: title.trim(),
          summary: summary.trim() || null,
          isPrimary,
          deliverables: deliverables.trim() || null,
          guidelines: guidelines.trim() || null,
          shotList: shotList.length > 0 ? shotList : null,
          externalUrl: externalUrl.trim() || null,
          fileUrl: fileUrl || null,
          fileKey: fileKey || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          fileMime: fileMime || null,
          tags,
          majorRevision,
          revisionSummary: revisionSummary.trim() || null,
        });

        if (res.error) {
          setErrorMessage(res.error);
          setIsSubmitting(false);
          return;
        }
      } else {
        const res = await createCreativeBrief({
          projectId,
          title: title.trim(),
          summary: summary.trim() || null,
          isPrimary,
          deliverables: deliverables.trim() || null,
          guidelines: guidelines.trim() || null,
          shotList: shotList.length > 0 ? shotList : null,
          externalUrl: externalUrl.trim() || null,
          fileUrl: fileUrl || null,
          fileKey: fileKey || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          fileMime: fileMime || null,
          tags,
        });

        if (res.error) {
          setErrorMessage(res.error);
          setIsSubmitting(false);
          return;
        }
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEditing ? "Edit Creative Brief" : "Create Creative Brief"}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? `Update specifications, shot lists, and creative guidelines (v${brief?.version}).`
            : "Define project shoot requirements, deliverable specifications, visual guidelines, and shot lists."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="min-w-0 space-y-6 py-1">
        {errorMessage && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        {/* Project & Title */}
        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="brief-project">
              Associated Project <span className="text-destructive">*</span>
            </Label>
            <Select
              value={projectId}
              onValueChange={(val) => val && setProjectId(val)}
              disabled={isEditing}
            >
              <SelectTrigger id="brief-project" className="h-11 w-full">
                <SelectValue placeholder="Select project">
                  {projects.find((project) => project.id === projectId)?.name || "Select project"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brief-title">
              Brief Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="brief-title"
              placeholder="e.g. Summer Campaign Studio & Lookbook Brief"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Primary brief toggle */}
        <label
          htmlFor="is-primary"
          className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-muted/20 px-3 py-3 transition-colors hover:bg-muted/40"
        >
          <Checkbox
            id="is-primary"
            checked={isPrimary}
            onCheckedChange={setIsPrimary}
            className="size-5"
          />
          <span className="text-sm font-medium leading-snug">
            Mark as primary brief for this project
          </span>
        </label>

        {/* Summary */}
        <div className="space-y-1.5">
          <Label htmlFor="brief-summary">Executive Summary & Creative Vision</Label>
          <Textarea
            id="brief-summary"
            placeholder="High-level summary of the shoot concept, mood, lighting tone, and client goals..."
            rows={2}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>

        {/* Deliverables & Guidelines */}
        <div className="grid min-w-0 grid-cols-1 gap-5 border-t pt-5 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="brief-deliverables">Deliverable Specifications</Label>
            <Textarea
              id="brief-deliverables"
              placeholder="e.g. 15 high-res retouched TIFFs (300dpi, AdobeRGB), 30 web-ready JPEGs (2000px wide), 3 vertical 9:16 reels..."
              rows={4}
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brief-guidelines">Visual Guidelines & Art Direction</Label>
            <Textarea
              id="brief-guidelines"
              placeholder="e.g. Clean high-key lighting, warm tones, minimal props, natural makeup. No stark shadows on product labels."
              rows={4}
              value={guidelines}
              onChange={(e) => setGuidelines(e.target.value)}
            />
          </div>
        </div>

        {/* Interactive Shot List Builder */}
        <div className="space-y-4 border-t pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Label className="text-base flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-primary" />
                Structured Shot List ({shotList.length} items)
              </Label>
              <p className="text-xs text-muted-foreground">
                Plan exact setups, angles, and framing. Workers can check off items during production.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddShot}
              className="min-h-10 w-full gap-2 sm:w-auto md:h-auto md:min-h-0 md:rounded-none md:border-0 md:bg-transparent md:dark:bg-transparent md:px-1 md:py-1 md:shadow-none md:ring-0 md:dark:ring-0 md:hover:bg-transparent md:dark:hover:bg-transparent md:hover:text-foreground md:hover:no-underline md:hover:shadow-none md:hover:ring-0 md:dark:hover:ring-0 md:hover:translate-y-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Shot
            </Button>
          </div>

          <div className="space-y-3">
            {shotList.map((shot, idx) => (
              <div
                key={shot.id || idx}
                className="min-w-0 space-y-3 rounded-lg border bg-card p-3 sm:p-4"
              >
                <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                  <span className="w-fit rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
                    #{idx + 1}
                  </span>
                  <Input
                    placeholder="Shot title (e.g. Model Hero Lockup with Product)"
                    value={shot.title}
                    onChange={(e) =>
                      handleUpdateShot(idx, "title", e.target.value)
                    }
                    className="h-10 min-w-0 w-full text-sm font-medium"
                  />

                  <Select
                    value={shot.framing || "MEDIUM"}
                    onValueChange={(val) =>
                      val && handleUpdateShot(idx, "framing", val as ShotFraming)
                    }
                  >
                    <SelectTrigger className="h-10 w-full min-w-0 text-sm md:data-[size=default]:h-10">
                      <SelectValue placeholder="Framing">{formatBriefOption(shot.framing)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SHOT_FRAMING_OPTIONS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveShot(idx)}
                    aria-label={`Remove shot ${idx + 1}`}
                    className="h-10 w-full text-muted-foreground hover:text-destructive md:size-10 md:p-0"
                  >
                    <X className="h-4 w-4" />
                    <span className="md:hidden">Remove shot</span>
                  </Button>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Description & lighting notes..."
                    value={shot.description || ""}
                    onChange={(e) =>
                      handleUpdateShot(idx, "description", e.target.value)
                    }
                    className="min-h-10 text-sm"
                  />
                  <Input
                    placeholder="Props (e.g. vintage stool, glass beaker)"
                    value={Array.isArray(shot.props) ? shot.props.join(", ") : ""}
                    onChange={(e) =>
                      handleUpdateShot(
                        idx,
                        "props",
                        e.target.value
                          .split(",")
                          .map((p) => p.trim())
                          .filter((p) => p.length > 0)
                      )
                    }
                    className="min-h-10 text-sm"
                  />
                </div>
              </div>
            ))}

            {shotList.length === 0 && (
              <div className="text-center py-6 border border-dashed rounded-lg text-xs text-muted-foreground">
                No shot list items added. Click &quot;Add Shot&quot; to define shots for this session.
              </div>
            )}
          </div>
        </div>

        {/* External Links and Attachments */}
        <div className="space-y-5 border-t pt-5">
          <div className="space-y-1.5">
            <Label htmlFor="external-url" className="flex items-center gap-1.5">
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
              External Tool Link (Figma, Notion, Docs)
            </Label>
            <Input
              id="external-url"
              placeholder="https://www.figma.com/file/... or Notion"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              className="h-11 w-full"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Upload className="h-4 w-4 text-muted-foreground" />
              PDF or Document Attachment
            </Label>
            {fileUrl ? (
              <div className="flex min-h-14 items-center justify-between gap-3 rounded-md border bg-muted/20 p-3 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">{fileName || "Uploaded File"}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFileUrl("");
                    setFileKey("");
                    setFileName("");
                    setFileSize(null);
                    setFileMime("");
                  }}
                  aria-label="Remove attachment"
                  className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div>
                <FileDropzone
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  onFiles={handleFileUpload}
                  disabled={isUploading}
                  title={isUploading ? "Uploading attachment…" : "Drop a brief attachment here, or browse"}
                  description="PDF, image, text, Word, Excel, or PowerPoint · Up to 25MB"
                  className="min-h-40 px-5 py-7 sm:min-h-44"
                />
                {isUploading && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Uploading file...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-3 border-t pt-5">
          <Label htmlFor="brief-tags">Tags & Categories</Label>
          <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
            <Input
              id="brief-tags"
              placeholder="Add a tag (e.g. editorial, lookbook, studio)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="md:h-10"
            />
            <Button type="button" variant="outline" size="sm" onClick={handleAddTag} className="min-h-10 w-full sm:w-auto md:h-10 md:min-h-10">
              Add
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Major Revision Toggle (Only when editing an active/published brief) */}
        {isEditing && brief?.status !== BriefStatus.DRAFT && (
          <div className="space-y-3 rounded-lg border bg-amber-500/10 p-3 pt-4 dark:bg-amber-500/15">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Label htmlFor="major-rev" className="font-semibold text-sm cursor-pointer">
                  Publish as Major Revision (v{(brief?.version ?? 1) + 1})
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bumps the version, resets status to In Review, and requests re-acknowledgment from the crew.
                </p>
              </div>
              <Checkbox
                id="major-rev"
                checked={majorRevision}
                onCheckedChange={setMajorRevision}
                className="mt-0.5"
              />
            </div>

            {majorRevision && (
              <Input
                placeholder="Summary of changes (e.g. Added 5 product detail shots, updated lighting tone)"
                value={revisionSummary}
                onChange={(e) => setRevisionSummary(e.target.value)}
                className="text-xs"
              />
            )}
          </div>
        )}

        <DialogFooter className="sticky bottom-[-1rem] z-10 -mx-4 -mb-4 grid grid-cols-1 gap-2 border-t bg-popover pt-4 sm:bottom-[-1.5rem] sm:-mx-6 sm:-mb-6 sm:grid-cols-[auto_1fr] sm:items-center sm:justify-between">
          {isEditing && canDeleteDraft ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (brief?.id) {
                  onDeleteRequest?.({ id: brief.id, title: brief.title });
                }
              }}
              disabled={isSubmitting}
              className="min-h-11 w-full gap-2 sm:w-auto md:h-auto md:min-h-0 md:rounded-none md:border-0 md:bg-transparent md:dark:bg-transparent md:px-1 md:py-1 md:shadow-none md:ring-0 md:dark:ring-0 md:hover:bg-transparent md:dark:hover:bg-transparent md:hover:text-destructive md:hover:no-underline md:hover:shadow-none md:hover:ring-0 md:dark:hover:ring-0 md:hover:translate-y-0"
            >
              <Trash2 className="h-4 w-4" />
              Delete Brief
            </Button>
          ) : (
            <div />
          )}

          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-self-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="min-h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="min-h-11 gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Save Brief" : "Create Brief"}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </>
  );
}
