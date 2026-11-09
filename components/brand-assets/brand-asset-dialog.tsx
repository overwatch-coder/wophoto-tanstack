import { useEffect, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandAssetType } from "@/generated/prisma/browser";
import { upload } from "@vercel/blob/client";
import { FileDropzone } from "@/components/ui/file-dropzone";
import {
  BRAND_ASSET_TYPE_LABELS,
  formatFileSize,
} from "@/components/brand-assets/labels";
import {
  createBrandAsset,
  createBrandAssets,
  discardUnusedBrandAssetUploads,
  updateBrandAsset,
  deleteBrandAsset,
} from "@/app/actions/brand-assets";
import {
  Loader2,
  Trash2,
  Plus,
  Save,
  Upload,
  Link as LinkIcon,
  Palette,
  X,
  FileText,
} from "lucide-react";

export interface ColorSwatchItem {
  name: string;
  hex: string;
  rgb?: string | null;
  pantone?: string | null;
}

export interface BrandAssetDialogData {
  id: string;
  title: string;
  description?: string | null;
  assetType: BrandAssetType;
  fileUrl?: string | null;
  fileKey?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileMime?: string | null;
  externalUrl?: string | null;
  colorPalette?: ColorSwatchItem[] | null;
  tags: string[];
  clientId?: string | null;
  projectId?: string | null;
}

interface ClientOption {
  id: string;
  name: string | null;
  email: string | null;
}

interface ProjectOption {
  id: string;
  name: string;
  clientId?: string | null;
}

interface BrandAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: BrandAssetDialogData | null;
  clients: ClientOption[];
  projects: ProjectOption[];
  onSuccess?: () => void;
}

type SourceMode = "file" | "url" | "palette";

interface QueuedBrandAssetFile {
  file: File;
  previewUrl: string;
  title: string;
}

function resolveBrandAssetMime(file: File) {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  const fallbackTypes: Record<string, string> = {
    svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    webp: "image/webp", pdf: "application/pdf", zip: "application/zip",
    eps: "application/postscript", ai: "application/postscript", ps: "application/postscript",
    psd: "image/vnd.adobe.photoshop", woff: "font/woff", woff2: "font/woff2",
    ttf: "font/ttf", otf: "font/otf",
  };
  return extension ? fallbackTypes[extension] || "" : "";
}

export function BrandAssetDialog({
  open,
  onOpenChange,
  asset,
  clients,
  projects,
  onSuccess,
}: BrandAssetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[calc(100dvh-1.5rem)] overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:max-w-2xl sm:p-6">
        {open && (
          <BrandAssetForm
            key={asset?.id ?? "new"}
            asset={asset}
            clients={clients}
            projects={projects}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BrandAssetForm({
  asset,
  clients,
  projects,
  onOpenChange,
  onSuccess,
}: Omit<BrandAssetDialogProps, "open">) {
  const isEditing = Boolean(asset?.id);

  const [title, setTitle] = useState(asset?.title || "");
  const [description, setDescription] = useState(asset?.description || "");
  const [assetType, setAssetType] = useState<BrandAssetType>(
    asset?.assetType || BrandAssetType.LOGO
  );
  const [clientId, setClientId] = useState<string>(asset?.clientId || "");
  const [projectId, setProjectId] = useState<string>(asset?.projectId || "");

  const initialSourceMode: SourceMode =
    asset?.colorPalette && asset.colorPalette.length > 0
      ? "palette"
      : asset?.externalUrl
      ? "url"
      : "file";

  const [sourceMode, setSourceMode] = useState<SourceMode>(initialSourceMode);
  const [fileUrl, setFileUrl] = useState<string>(asset?.fileUrl || "");
  const [fileKey, setFileKey] = useState<string>(asset?.fileKey || "");
  const [fileName, setFileName] = useState<string>(asset?.fileName || "");
  const [fileSize, setFileSize] = useState<number | null>(asset?.fileSize || null);
  const [fileMime, setFileMime] = useState<string>(asset?.fileMime || "");
  const [selectedFiles, setSelectedFiles] = useState<QueuedBrandAssetFile[]>([]);
  const selectedFilesRef = useRef(selectedFiles);
  const [uploadProgress, setUploadProgress] = useState("");
  const [externalUrl, setExternalUrl] = useState<string>(
    asset?.externalUrl || ""
  );
  const [colorPalette, setColorPalette] = useState<ColorSwatchItem[]>(
    Array.isArray(asset?.colorPalette) && asset?.colorPalette.length > 0
      ? asset.colorPalette
      : [
          { name: "Primary", hex: "#111827" },
          { name: "Accent", hex: "#2563EB" },
        ]
  );

  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(asset?.tags || []);

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(() => () => {
    selectedFilesRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
  }, []);

  // Handle Project selection: auto-sync client
  const handleProjectChange = (selectedProjectId: string) => {
    setProjectId(selectedProjectId);
    if (selectedProjectId) {
      const proj = projects.find((p) => p.id === selectedProjectId);
      if (proj?.clientId) {
        setClientId(proj.clientId);
      }
    }
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

  // Color Swatch management
  const handleAddSwatch = () => {
    if (colorPalette.length >= 20) return;
    setColorPalette([
      ...colorPalette,
      { name: `Color ${colorPalette.length + 1}`, hex: "#4F46E5" },
    ]);
  };

  const handleUpdateSwatch = (
    index: number,
    field: keyof ColorSwatchItem,
    value: string
  ) => {
    const updated = [...colorPalette];
    updated[index] = { ...updated[index], [field]: value };
    setColorPalette(updated);
  };

  const handleRemoveSwatch = (index: number) => {
    setColorPalette(colorPalette.filter((_, i) => i !== index));
  };

  const handleFilesSelected = (files: File[]) => {
    setErrorMessage(null);
    try {
      files.forEach((file) => {
        if (file.size > 25 * 1024 * 1024) {
          throw new Error(`${file.name} exceeds the 25MB per-file limit.`);
        }
        const contentType = resolveBrandAssetMime(file);
        if (!contentType) {
          throw new Error(`${file.name} is not a supported brand asset file.`);
        }
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The selected file is not supported.");
      return;
    }
    const additions = files.map((file) => {
      const titleFromName = file.name.replace(/\.[^.]+$/, "").slice(0, 120);
      return {
        file,
        previewUrl: URL.createObjectURL(file),
        title: titleFromName || file.name.slice(0, 120),
      };
    });

    const next = isEditing ? additions.slice(0, 1) : [...selectedFiles, ...additions];
    if (next.length > 20) {
      additions.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      setErrorMessage("You can add up to 20 assets at a time.");
      return;
    }
    if (next.reduce((total, entry) => total + entry.file.size, 0) > 100 * 1024 * 1024) {
      additions.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      setErrorMessage("The selected files exceed the 100MB total batch limit.");
      return;
    }
    if (isEditing) {
      selectedFiles.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      setFileUrl("");
      setFileKey("");
      setFileName("");
      setFileSize(null);
      setFileMime("");
    }
    setSelectedFiles(next);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((current) => {
      const removed = current[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const updateSelectedFileTitle = (index: number, nextTitle: string) => {
    setSelectedFiles((current) => current.map((entry, itemIndex) =>
      itemIndex === index ? { ...entry, title: nextTitle } : entry
    ));
  };

  const uploadSelectedFile = async (file: File) => {
    const contentType = resolveBrandAssetMime(file);
    const pathname = `brand-assets/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const blob = await upload(pathname, file, {
      access: "private",
      handleUploadUrl: "/api/brand-assets/upload",
      contentType,
    });
    return {
      fileUrl: blob.url,
      fileKey: blob.pathname,
      fileName: file.name,
      fileSize: file.size,
      fileMime: contentType,
    };
  };

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const isFileBatch = sourceMode === "file" && !isEditing && selectedFiles.length > 0;
    if (!title.trim() && !isFileBatch) {
      setErrorMessage("Please enter an asset title.");
      return;
    }

    // Source validation based on active mode
    if (sourceMode === "file" && !fileUrl && selectedFiles.length === 0) {
      setErrorMessage("Please upload a file or switch to an external link.");
      return;
    }
    if (sourceMode === "url" && !externalUrl.trim()) {
      setErrorMessage("Please enter a valid external link (http:// or https://).");
      return;
    }
    if (sourceMode === "palette" && colorPalette.length === 0) {
      setErrorMessage("Please add at least one color swatch to the palette.");
      return;
    }

    setIsSubmitting(true);
    setIsUploading(false);
    const uploadedFiles: Array<Awaited<ReturnType<typeof uploadSelectedFile>>> = [];

    try {
      if (isEditing && asset?.id) {
        if (selectedFiles[0]) {
          setIsUploading(true);
          setUploadProgress("Uploading replacement file…");
          uploadedFiles.push(await uploadSelectedFile(selectedFiles[0].file));
        }
        const res = await updateBrandAsset({
          id: asset.id,
          title: title.trim(),
          description: description.trim() || null,
          assetType,
          clientId: clientId || null,
          projectId: projectId || null,
          fileUrl: sourceMode === "file" ? (uploadedFiles[0]?.fileUrl ?? fileUrl) : null,
          fileKey: sourceMode === "file" ? (uploadedFiles[0]?.fileKey ?? fileKey) : null,
          fileName: sourceMode === "file" ? (uploadedFiles[0]?.fileName ?? fileName) : null,
          fileSize: sourceMode === "file" ? (uploadedFiles[0]?.fileSize ?? fileSize) : null,
          fileMime: sourceMode === "file" ? (uploadedFiles[0]?.fileMime ?? fileMime) : null,
          externalUrl: sourceMode === "url" ? externalUrl.trim() : null,
          colorPalette: sourceMode === "palette" ? colorPalette : null,
          tags,
        });

        if (res.error) {
          await discardUnusedBrandAssetUploads(uploadedFiles);
          setErrorMessage(res.error);
          return;
        }
      } else if (isFileBatch) {
        setIsUploading(true);
        for (let index = 0; index < selectedFiles.length; index += 1) {
          setUploadProgress(`Uploading ${index + 1} of ${selectedFiles.length}…`);
          uploadedFiles.push(await uploadSelectedFile(selectedFiles[index].file));
        }
        const res = await createBrandAssets(selectedFiles.map((entry, index) => ({
          title: entry.title.trim(),
          description: description.trim() || null,
          assetType,
          clientId: clientId || null,
          projectId: projectId || null,
          ...uploadedFiles[index],
          tags,
        })));
        if (res.error) {
          await discardUnusedBrandAssetUploads(uploadedFiles);
          setErrorMessage(res.error);
          return;
        }
      } else {
        const res = await createBrandAsset({
          title: title.trim(),
          description: description.trim() || null,
          assetType,
          clientId: clientId || null,
          projectId: projectId || null,
          fileUrl: sourceMode === "file" ? fileUrl : null,
          fileKey: sourceMode === "file" ? fileKey : null,
          fileName: sourceMode === "file" ? fileName : null,
          fileSize: sourceMode === "file" ? fileSize : null,
          fileMime: sourceMode === "file" ? fileMime : null,
          externalUrl: sourceMode === "url" ? externalUrl.trim() : null,
          colorPalette: sourceMode === "palette" ? colorPalette : null,
          tags,
        });

        if (res.error) {
          setErrorMessage(res.error);
          return;
        }
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      if (uploadedFiles.length) await discardUnusedBrandAssetUploads(uploadedFiles);
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setIsUploading(false);
      setUploadProgress("");
      setIsSubmitting(false);
    }
  };

  // Delete handling
  const handleDelete = async () => {
    if (!asset?.id) return;
    if (!confirm(`Are you sure you want to delete "${asset.title}"?`)) return;

    setIsDeleting(true);
    setErrorMessage(null);

    const res = await deleteBrandAsset({ id: asset.id });
    setIsDeleting(false);

    if (res.error) {
      setErrorMessage(res.error);
      return;
    }

    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEditing ? "Edit Brand Asset" : "Add Brand Asset"}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Update digital brand material, vector assets, color palettes, or external design guidelines."
            : "Upload or link brand guidelines, logos, typography, and color palettes for studio and client production."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="min-w-0 w-full space-y-5 py-2">
        {errorMessage && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        {/* Title & Asset Type */}
        <div className={`grid min-w-0 grid-cols-1 gap-4 ${isEditing || sourceMode !== "file" ? "md:grid-cols-2" : ""}`}>
          {(isEditing || sourceMode !== "file") && (
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="asset-title">
                Asset Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="asset-title"
                placeholder="e.g. Acme Primary Lockup (SVG)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
          )}
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="asset-type">Asset Category</Label>
            <Select
              value={assetType}
              onValueChange={(val) => {
                if (val) {
                  const newType = val as BrandAssetType;
                  setAssetType(newType);
                  if (newType === BrandAssetType.COLOR_PALETTE) {
                    setSourceMode("palette");
                  }
                }
              }}
            >
              <SelectTrigger id="asset-type" className="h-11 w-full min-w-0">
                <SelectValue className="min-w-0 truncate">{BRAND_ASSET_TYPE_LABELS[assetType]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BRAND_ASSET_TYPE_LABELS).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="asset-description">Description & Usage Notes</Label>
          <Textarea
            id="asset-description"
            placeholder="e.g. Master vector file for all dark backgrounds. Do not compress or stretch."
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Scope Selection: Client & Project */}
        <div className="grid min-w-0 grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="asset-client">Client Kit Scope</Label>
            <Select
              value={clientId || "studio"}
              onValueChange={(val) =>
                setClientId(!val || val === "studio" ? "" : val)
              }
            >
              <SelectTrigger id="asset-client" className="h-11 w-full min-w-0">
                <SelectValue className="min-w-0 truncate">{clientId ? (clients.find((c) => c.id === clientId)?.name || clients.find((c) => c.id === clientId)?.email || "Selected client") : "General Studio Asset"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="studio">General Studio Asset</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name || c.email || c.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="asset-project">Specific Project (Optional)</Label>
            <Select
              value={projectId || "none"}
              onValueChange={(val) =>
                handleProjectChange(!val || val === "none" ? "" : val)
              }
            >
              <SelectTrigger id="asset-project" className="h-11 w-full min-w-0">
                <SelectValue className="min-w-0 truncate">{projectId ? projects.find((p) => p.id === projectId)?.name || "Selected project" : "No specific project"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Source Selector Tabs */}
        <div className="min-w-0 space-y-3 border-t pt-4">
          <Label>Asset Source</Label>
          <div className="sm:hidden">
            <Select
              value={sourceMode}
              onValueChange={(value) => value && setSourceMode(value as SourceMode)}
            >
              <SelectTrigger id="asset-source-mobile" className="h-11 w-full min-w-0">
                <SelectValue className="min-w-0 truncate">
                  {sourceMode === "file" ? "Upload File" : sourceMode === "url" ? "External Link" : "Color Palette"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="file">Upload File</SelectItem>
                <SelectItem value="url">External Link</SelectItem>
                <SelectItem value="palette">Color Palette</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="hidden flex-wrap gap-2 sm:flex">
            <Button
              type="button"
              variant={sourceMode === "file" ? "default" : "outline"}
              size="default"
              aria-pressed={sourceMode === "file"}
              onClick={() => setSourceMode("file")}
              className="min-h-11 gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload File
            </Button>
            <Button
              type="button"
              variant={sourceMode === "url" ? "default" : "outline"}
              size="default"
              aria-pressed={sourceMode === "url"}
              onClick={() => setSourceMode("url")}
              className="min-h-11 gap-2"
            >
              <LinkIcon className="h-4 w-4" />
              External Link
            </Button>
            <Button
              type="button"
              variant={sourceMode === "palette" ? "default" : "outline"}
              size="default"
              aria-pressed={sourceMode === "palette"}
              onClick={() => setSourceMode("palette")}
              className="min-h-11 gap-2"
            >
              <Palette className="h-4 w-4" />
              Color Palette
            </Button>
          </div>

          {/* Mode 1: File Upload */}
          {sourceMode === "file" && (
            <div className="min-w-0 space-y-3 rounded-lg border bg-muted/20 p-3 sm:p-4">
              {fileUrl && selectedFiles.length === 0 && (
                <div className="flex min-w-0 items-center justify-between gap-2 border rounded-md bg-card p-3">
                  <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                    <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="truncate">
                      <div className="font-medium text-sm truncate">
                        {fileName || "Uploaded File"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(fileSize)}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFileUrl("");
                      setFileName("");
                      setFileSize(null);
                      setFileMime("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <FileDropzone
                accept=".svg,.png,.jpg,.jpeg,.webp,.eps,.ai,.ps,.psd,.pdf,.woff,.woff2,.ttf,.otf,.zip"
                multiple={!isEditing}
                disabled={isUploading || isSubmitting}
                title={isEditing ? "Drop a replacement file here, or browse" : "Drop brand asset files here, or browse"}
                description={isEditing
                  ? "SVG, PNG, JPG, WebP, EPS, PDF, WOFF2, TTF, OTF, or ZIP. Up to 25MB."
                  : "Select several files to create a set of assets. Up to 20 files, 25MB each (100MB total)."}
                onFiles={handleFilesSelected}
              />
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Review assets ({selectedFiles.length})</p>
                    {!isEditing && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={() => {
                          selectedFiles.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
                          setSelectedFiles([]);
                        }}
                      >
                        Clear all
                      </Button>
                    )}
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {selectedFiles.map((entry, index) => {
                      const mime = resolveBrandAssetMime(entry.file);
                      const isImage = mime.startsWith("image/");
                      const isPdf = mime === "application/pdf";
                      return (
                        <div key={`${entry.file.name}-${index}`} className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-card p-2 sm:grid-cols-[6rem_minmax(0,1fr)_auto]">
                          <div className="flex h-16 w-[4.5rem] items-center justify-center overflow-hidden rounded border bg-muted/30 sm:w-24">
                            {isImage ? (
                              <img src={entry.previewUrl} alt={`Preview of ${entry.file.name}`} width={96} height={64} className="h-full w-full object-contain" />
                            ) : isPdf ? (
                              <iframe src={entry.previewUrl} title={`Preview of ${entry.file.name}`} className="h-full w-full bg-white" />
                            ) : (
                              <div className="flex flex-col items-center gap-1 px-1 text-center text-muted-foreground">
                                <FileText className="size-5 text-primary" />
                                <span className="text-[10px]">{entry.file.name.split(".").pop()?.toUpperCase() || "FILE"}</span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 space-y-1.5">
                            <Input
                              aria-label={`Asset title for ${entry.file.name}`}
                              value={entry.title}
                              maxLength={120}
                              onChange={(event) => updateSelectedFileTitle(index, event.target.value)}
                              placeholder="Asset title"
                              required
                            />
                            <p className="truncate text-xs text-muted-foreground" title={entry.file.name}>
                              {entry.file.name} · {formatFileSize(entry.file.size)}
                            </p>
                          </div>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${entry.file.name}`} disabled={isSubmitting} onClick={() => removeSelectedFile(index)}>
                            <X className="size-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {isUploading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
                  <Loader2 className="size-3.5 animate-spin" />
                  {uploadProgress || "Uploading asset to secure storage…"}
                </div>
              )}
            </div>
          )}

          {/* Mode 2: External Link */}
          {sourceMode === "url" && (
            <div className="space-y-2 rounded-lg border p-4 bg-muted/20">
              <Label htmlFor="external-url">External Design / Resource Link</Label>
              <Input
                id="external-url"
                placeholder="https://www.figma.com/file/... or Google Drive"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Link to live Figma components, Google Drive folders, Canva kits, or font foundries.
              </p>
            </div>
          )}

          {/* Mode 3: Color Palette Builder */}
          {sourceMode === "palette" && (
            <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Palette Swatches</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSwatch}
                  disabled={colorPalette.length >= 20}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Color
                </Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {colorPalette.map((swatch, idx) => (
                  <div
                    key={idx}
                    className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border bg-card p-2 sm:grid-cols-[auto_7rem_minmax(0,1fr)_auto]"
                  >
                    <input
                      type="color"
                      value={swatch.hex.startsWith("#") ? swatch.hex : `#${swatch.hex}`}
                      onChange={(e) =>
                        handleUpdateSwatch(idx, "hex", e.target.value.toUpperCase())
                      }
                      className="h-8 w-8 rounded border cursor-pointer p-0 bg-transparent"
                    />
                    <Input
                      placeholder="Hex code (e.g. #FF5733)"
                      value={swatch.hex}
                      onChange={(e) =>
                        handleUpdateSwatch(idx, "hex", e.target.value.toUpperCase())
                      }
                      className="w-full min-w-0 font-mono text-xs uppercase"
                    />
                    <Input
                      placeholder="Label (e.g. Primary Coral)"
                      value={swatch.name}
                      onChange={(e) =>
                        handleUpdateSwatch(idx, "name", e.target.value)
                      }
                      className="col-span-3 min-w-0 text-sm sm:col-span-1 sm:text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSwatch(idx)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {colorPalette.length === 0 && (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    No swatches added yet. Click &quot;Add Color&quot; to begin building your palette.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="border-t pt-4 space-y-2">
          <Label htmlFor="asset-tags">Tags & Metadata</Label>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <Input
              id="asset-tags"
              placeholder="Add a tag (e.g. dark-mode)"
              value={tagInput}
              className="min-w-0 flex-1"
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleAddTag}
              className="min-h-11 gap-1.5 px-3"
            >
              <Plus className="size-4" />
              Add tag
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Press Enter or tap Add tag to apply it.</p>
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

        <DialogFooter className="-mx-4 -mb-4 grid grid-cols-2 gap-2 border-t pt-4 sm:-mx-6 sm:-mb-6 sm:flex sm:items-center sm:justify-between">
          {isEditing ? (
            <Button
              type="button"
              variant="destructive"
              size="default"
              onClick={handleDelete}
              disabled={isSubmitting || isDeleting}
              className="col-span-2 min-h-11 w-full gap-1.5 sm:col-span-1 sm:w-auto"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete Asset
            </Button>
          ) : (
            <div className="hidden sm:block" />
          )}

          <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:ml-auto sm:flex">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isDeleting}
              className="min-h-11 w-full px-2 sm:w-auto sm:px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isUploading || isDeleting}
              className="min-h-11 w-full gap-1.5 px-2 sm:w-auto sm:px-4"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {!isSubmitting && (isEditing ? <Save className="size-4" /> : <Plus className="size-4" />)}
              {isEditing ? "Save Changes" : "Create Asset"}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </>
  );
}
