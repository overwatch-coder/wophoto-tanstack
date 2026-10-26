"use client";

import { useState, useTransition, useMemo, useEffect, useCallback } from "react";
import { useDebounce } from "@uidotdev/usehooks";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Image from "next/image";
import { BrandAssetType } from "@/generated/prisma/browser";
import {
  formatBrandAssetType,
  formatFileSize,
} from "@/components/brand-assets/labels";
import {
  BrandAssetDialog,
  type BrandAssetDialogData,
  type ColorSwatchItem,
} from "@/components/brand-assets/brand-asset-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { TableRowActions } from "@/components/ui/table-row-actions";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  ExternalLink,
  Download,
  Copy,
  Check,
  FileText,
  Type,
  Layers,
  Edit2,
  X,
  Eye,
  Grid2X2,
  List,
  Trash2,
} from "lucide-react";
import { deleteBrandAsset, queryBrandAssets } from "@/app/actions/brand-assets";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function getSafeExternalUrl(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

export interface SerializedBrandAsset {
  id: string;
  title: string;
  description: string | null;
  assetType: BrandAssetType;
  fileUrl: string | null;
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileMime: string | null;
  externalUrl: string | null;
  colorPalette: unknown;
  tags: string[];
  clientId: string | null;
  client: { id: string; name: string | null; email: string | null } | null;
  projectId: string | null;
  project: { id: string; name: string } | null;
  createdById: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  createdAt: string;
  updatedAt: string;
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

interface BrandAssetWorkspaceProps {
  initialAssets: SerializedBrandAsset[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  stats: {
    total: number;
    logos: number;
    colorPalettes: number;
    typography: number;
    guidelines: number;
    mediaReference: number;
    templates: number;
  };
  clients: ClientOption[];
  projects: ProjectOption[];
  canManage?: boolean;
}

export function BrandAssetWorkspace({
  initialAssets,
  pagination,
  stats,
  clients,
  projects,
  canManage = false,
}: BrandAssetWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState({ assets: initialAssets, pagination, stats });
  const [filterError, setFilterError] = useState<string | null>(null);

  const currentTab = searchParams.get("type") || "ALL";
  const currentScope = searchParams.get("scope") || "ALL";
  const [currentClient, setCurrentClient] = useState("ALL");
  const [currentProject, setCurrentProject] = useState("ALL");
  const currentSearch = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [lastSearchParam, setLastSearchParam] = useState(currentSearch);
  const debouncedSearch = useDebounce(searchInput, 300);

  if (currentSearch !== lastSearchParam) {
    setLastSearchParam(currentSearch);
    setSearchInput(currentSearch);
  }

  useEffect(() => {
    if (!searchParams.has("clientId") && !searchParams.has("projectId")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("clientId");
    params.delete("projectId");
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname);
  }, [pathname, router, searchParams]);

  const loadResults = useCallback((
    params: URLSearchParams,
    clientId = currentClient,
    projectId = currentProject,
  ) => {
    setFilterError(null);
    const query = Object.fromEntries(params.entries());
    // The URL uses `type` for shareable category tabs, while the data query
    // schema names the same filter `assetType`.
    query.assetType = query.type || "";
    delete query.type;
    startTransition(async () => {
      try {
        const next = await queryBrandAssets({
          ...query,
          clientId: clientId === "ALL" ? null : clientId,
          projectId: projectId === "ALL" ? null : projectId,
          pageSize: 24,
        });
        setResults(next);
        const requestedPage = Number(params.get("page") || 1);
        if (Number.isFinite(requestedPage) && requestedPage > next.pagination.page) {
          const normalizedParams = new URLSearchParams(params);
          if (next.pagination.page === 1) normalizedParams.delete("page");
          else normalizedParams.set("page", String(next.pagination.page));
          router.replace(
            normalizedParams.size
              ? `${pathname}?${normalizedParams.toString()}`
              : pathname,
          );
        }
      } catch {
        setFilterError("Filters could not be applied. Please try again.");
      }
    });
  }, [currentClient, currentProject, pathname, router]);

  useEffect(() => {
    const search = debouncedSearch.trim();
    if (search === currentSearch) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("clientId");
    params.delete("projectId");
    params.delete("page");
    if (search) params.set("search", search);
    else params.delete("search");

    startTransition(() => {
      router.replace(params.size ? `${pathname}?${params.toString()}` : pathname);
    });
    // This effect synchronizes the debounced search with the server query.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadResults(params);
  }, [currentSearch, debouncedSearch, loadResults, pathname, router, searchParams]);

  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] =
    useState<BrandAssetDialogData | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [previewAsset, setPreviewAsset] = useState<SerializedBrandAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SerializedBrandAsset | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("clientId");
    params.delete("projectId");
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === "" || val === "ALL") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    }
    // Reset to page 1 on filter changes unless page itself is updated
    if (!updates.page) {
      params.delete("page");
    }

    startTransition(() => {
      router.push(params.size ? `${pathname}?${params.toString()}` : pathname);
    });
    loadResults(params);
  };

  const updateClientFilter = (selectedClientId: string | null) => {
    const clientId = selectedClientId || "ALL";
    const nextScope = clientId !== "ALL" && currentScope === "STUDIO" ? "CLIENT" : currentScope;
    setCurrentClient(clientId);
    const params = new URLSearchParams(searchParams.toString());
    if (nextScope !== currentScope) params.set("scope", nextScope);
    params.delete("clientId");
    params.delete("projectId");
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
    loadResults(params, clientId);
  };

  const updateProjectFilter = (selectedProjectId: string | null) => {
    const projectId = selectedProjectId || "ALL";
    const nextScope = projectId !== "ALL" && currentScope === "STUDIO" ? "PROJECT" : currentScope;
    setCurrentProject(projectId);
    const params = new URLSearchParams(searchParams.toString());
    if (nextScope !== currentScope) params.set("scope", nextScope);
    params.delete("clientId");
    params.delete("projectId");
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
    loadResults(params, currentClient, projectId);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleClearSearch = () => {
    setSearchInput("");
  };

  const handleCopyHex = (hex: string) => {
    void navigator.clipboard.writeText(hex).then(() => {
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 2000);
    }).catch(() => window.prompt("Copy this color value", hex));
  };

  const handleOpenCreate = () => {
    setSelectedAsset(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (asset: SerializedBrandAsset) => {
    setSelectedAsset({
      id: asset.id,
      title: asset.title,
      description: asset.description,
      assetType: asset.assetType,
      fileUrl: asset.fileUrl,
      fileKey: asset.fileKey,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      fileMime: asset.fileMime,
      externalUrl: asset.externalUrl,
      colorPalette: Array.isArray(asset.colorPalette)
        ? (asset.colorPalette as ColorSwatchItem[])
        : null,
      tags: asset.tags,
      clientId: asset.clientId,
      projectId: asset.projectId,
    });
    setDialogOpen(true);
  };

  const refreshAssets = () => {
    router.refresh();
    loadResults(new URLSearchParams(searchParams.toString()));
  };

  const handleDeleteAsset = () => {
    if (!deleteTarget || !canManage) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteBrandAsset({ id: deleteTarget.id });
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      setDeleteTarget(null);
      refreshAssets();
    });
  };

  // Category Tab Definitions
  const tabs = useMemo(
    () => [
      { id: "ALL", label: "All Assets", count: results.stats.total },
      { id: BrandAssetType.LOGO, label: "Logos & Vectors", count: results.stats.logos },
      {
        id: BrandAssetType.COLOR_PALETTE,
        label: "Color Palettes",
        count: results.stats.colorPalettes,
      },
      {
        id: BrandAssetType.TYPOGRAPHY,
        label: "Typography & Fonts",
        count: results.stats.typography,
      },
      {
        id: BrandAssetType.GUIDELINE,
        label: "Brand Guidelines",
        count: results.stats.guidelines,
      },
      {
        id: BrandAssetType.MEDIA_REFERENCE,
        label: "Media References",
        count: results.stats.mediaReference,
      },
      {
        id: BrandAssetType.TEMPLATE,
        label: "Design Templates",
        count: results.stats.templates,
      },
    ],
    [results.stats]
  );

  const safePreviewUrl = previewAsset
    ? getSafeExternalUrl(previewAsset.externalUrl)
    : null;

  return (
    <div className="space-y-6">
      {/* Page Header - Clean, minimal, NO eyebrow pill badges */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Brand Asset Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centralized digital asset management for studio guidelines, client logos, typography, and color palettes.
          </p>
        </div>

        {canManage && (
          <Button onClick={handleOpenCreate} className="flex items-center gap-1.5 self-start sm:self-auto">
            <Plus className="h-4 w-4" />
            Add Brand Asset
          </Button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="border-b overflow-x-auto scrollbar-none">
        <div className="flex gap-1 pb-px min-w-max">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => updateFilters({ type: tab.id === "ALL" ? null : tab.id })}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs font-mono ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_180px_220px_220px] xl:items-center">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative min-w-0 sm:col-span-2 xl:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, description, or #tag..."
            name="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="pl-9 pr-8"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        {/* Scope Filter */}
        <Select
          value={currentScope}
          onValueChange={(selectedValue) => {
            const val = selectedValue || "ALL";
            const nextClient = val === "STUDIO" ? "ALL" : currentClient;
            const nextProject = val === "STUDIO" ? "ALL" : currentProject;
            if (val === "STUDIO") {
              setCurrentClient("ALL");
              setCurrentProject("ALL");
            }
            const params = new URLSearchParams(searchParams.toString());
            params.set("scope", val);
            params.delete("page");
            startTransition(() => router.push(`${pathname}?${params.toString()}`));
            loadResults(params, nextClient, nextProject);
          }}
        >
          <SelectTrigger className="w-full md:w-44">
            <SelectValue>{({ ALL: "All Scopes", STUDIO: "General Studio", CLIENT: "Client Kits", PROJECT: "Project Specific" } as Record<string, string>)[currentScope] || "All Scopes"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Scopes</SelectItem>
            <SelectItem value="STUDIO">General Studio</SelectItem>
            <SelectItem value="CLIENT">Client Kits</SelectItem>
            <SelectItem value="PROJECT">Project Specific</SelectItem>
          </SelectContent>
        </Select>

        {/* Client Filter */}
        <Select
          value={currentClient}
          onValueChange={updateClientFilter}
        >
          <SelectTrigger className="w-full md:w-52">
            <SelectValue>{currentClient === "ALL" ? "All Clients" : clients.find((c) => c.id === currentClient)?.name || clients.find((c) => c.id === currentClient)?.email || "Selected client"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name || c.email || c.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={currentProject} onValueChange={updateProjectFilter}>
          <SelectTrigger className="w-full md:w-56">
            <SelectValue>{currentProject === "ALL" ? "All Projects" : projects.find((project) => project.id === currentProject)?.name || "Selected project"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Projects</SelectItem>
            {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filterError && <p role="alert" className="text-sm text-destructive">{filterError}</p>}

      {/* Copied Hex Notification Toast */}
      {copiedHex && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm text-background shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2">
          <Check className="h-4 w-4 text-emerald-400" />
          <span>Copied color <strong>{copiedHex}</strong> to clipboard</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {results.pagination.total} {results.pagination.total === 1 ? "asset" : "assets"}
        </p>
        <div className="inline-flex items-center rounded-lg border bg-muted/30 p-1" role="group" aria-label="Asset layout">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "cards" ? "secondary" : "ghost"}
            aria-pressed={viewMode === "cards"}
            onClick={() => setViewMode("cards")}
            className="gap-1.5"
          >
            <Grid2X2 className="size-4" />
            Cards
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "table" ? "secondary" : "ghost"}
            aria-pressed={viewMode === "table"}
            onClick={() => setViewMode("table")}
            className="gap-1.5"
          >
            <List className="size-4" />
            Table
          </Button>
        </div>
      </div>

      {/* Asset Grid */}
      {results.assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 px-4 text-center">
          <div className="rounded-full bg-muted p-4 mb-3">
            <Layers className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-base">No brand assets found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            {currentSearch || currentScope !== "ALL" || currentClient !== "ALL" || currentProject !== "ALL" || currentTab !== "ALL"
              ? "Try adjusting your search terms or filters to find what you're looking for."
              : canManage
                ? "Get started by adding logos, brand guidelines, typography packages, or color palettes."
                : "No brand assets have been shared with the production team yet. Ask a manager to add the approved materials here."}
          </p>
          {(currentSearch || currentScope !== "ALL" || currentClient !== "ALL" || currentProject !== "ALL" || currentTab !== "ALL") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentClient("ALL");
                setCurrentProject("ALL");
                const params = new URLSearchParams();
                startTransition(() => router.push(pathname));
                loadResults(params, "ALL", "ALL");
              }}
              className="mt-4"
            >
              Reset all filters
            </Button>
          )}
        </div>
      ) : viewMode === "table" ? (
        <div className="w-full overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Added</th>
                <th className="w-12 px-2 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.assets.map((asset) => {
                const safeExternalUrl = getSafeExternalUrl(asset.externalUrl);
                const scopeLabel = asset.project
                  ? asset.project.name
                  : asset.client
                    ? asset.client.name || asset.client.email || "Client kit"
                    : "Studio general";
                return (
                  <tr key={asset.id} className="hover:bg-muted/20">
                    <td className="max-w-[24rem] px-4 py-3">
                      <button type="button" className="block max-w-full text-left font-medium hover:text-primary" onClick={() => setPreviewAsset(asset)}>
                        <span className="block truncate">{asset.title}</span>
                        {asset.description && <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{asset.description}</span>}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatBrandAssetType(asset.assetType)}</td>
                    <td className="max-w-52 truncate px-4 py-3 text-muted-foreground" title={scopeLabel}>{scopeLabel}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {asset.fileSize ? formatFileSize(asset.fileSize) : asset.externalUrl ? "External link" : Array.isArray(asset.colorPalette) ? `${asset.colorPalette.length} colors` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(asset.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="w-12 px-2 py-3 text-right">
                      <TableRowActions label={`Actions for ${asset.title}`}>
                        <DropdownMenuItem onClick={() => setPreviewAsset(asset)}>
                          <Eye aria-hidden="true" />
                          Preview
                        </DropdownMenuItem>
                        {asset.fileUrl && (
                          <DropdownMenuItem
                            render={
                              <a
                                href={`/api/brand-assets/${asset.id}/file`}
                                download={asset.fileName || asset.title}
                              />
                            }
                          >
                            <Download aria-hidden="true" />
                            Download
                          </DropdownMenuItem>
                        )}
                        {safeExternalUrl && (
                          <DropdownMenuItem
                            render={
                              <a
                                href={safeExternalUrl.href}
                                target="_blank"
                                rel="noreferrer"
                              />
                            }
                          >
                            <ExternalLink aria-hidden="true" />
                            Open external link
                          </DropdownMenuItem>
                        )}
                        {canManage && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleOpenEdit(asset)}>
                              <Edit2 aria-hidden="true" />
                              Edit asset
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteTarget(asset);
                              }}
                            >
                              <Trash2 aria-hidden="true" />
                              Delete asset
                            </DropdownMenuItem>
                          </>
                        )}
                      </TableRowActions>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {results.assets.map((asset) => {
            const isImage =
              asset.fileMime?.startsWith("image/") ||
              /\.(svg|png|jpg|jpeg|webp)$/i.test(asset.fileName || asset.fileUrl || "");
            const hasPalette =
              Array.isArray(asset.colorPalette) && asset.colorPalette.length > 0;
            const swatches = hasPalette
              ? (asset.colorPalette as ColorSwatchItem[])
              : [];
            const safeExternalUrl = getSafeExternalUrl(asset.externalUrl);

            return (
              <div
                key={asset.id}
                className="group flex flex-col justify-between rounded-xl border bg-card transition-shadow hover:shadow-md"
              >
                <div>
                  {/* Card Media Preview Area */}
                  <div className="relative h-44 w-full overflow-hidden rounded-t-xl bg-muted/30 border-b flex items-center justify-center">
                    {/* Category indicator */}
                    <div className="absolute top-2.5 left-2.5 z-10 rounded px-2 py-0.5 text-xs font-medium bg-background/90 text-foreground backdrop-blur border shadow-xs">
                      {formatBrandAssetType(asset.assetType)}
                    </div>

                    {/* Scope indicator */}
                    <div className="absolute top-2.5 right-2.5 z-10 rounded px-2 py-0.5 text-xs text-muted-foreground bg-background/90 backdrop-blur border shadow-xs">
                      {asset.project
                        ? `Project: ${asset.project.name}`
                        : asset.client
                        ? `Client: ${asset.client.name || asset.client.email}`
                        : "Studio General"}
                    </div>

                    {/* Media Type Display */}
                    {hasPalette ? (
                      <div className="w-full h-full p-4 flex flex-col justify-center gap-2">
                        <div className="grid grid-cols-4 gap-2 h-20">
                          {swatches.slice(0, 8).map((swatch, sIdx) => (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => handleCopyHex(swatch.hex)}
                              title={`Click to copy ${swatch.name} (${swatch.hex})`}
                              className="group/swatch relative rounded-md border flex flex-col items-center justify-end p-1 transition-transform hover:scale-105 overflow-hidden"
                              style={{ backgroundColor: swatch.hex }}
                            >
                              <span className="opacity-0 group-hover/swatch:opacity-100 bg-background/90 text-foreground text-[10px] font-mono px-1 rounded transition-opacity">
                                {swatch.hex}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="text-center text-xs text-muted-foreground">
                          {swatches.length} colors • Click swatch to copy hex
                        </div>
                      </div>
                    ) : isImage && asset.fileUrl ? (
                      <div className="relative w-full h-full p-4 flex items-center justify-center">
                        <Image
                          src={`/api/brand-assets/${asset.id}/file`}
                          alt={asset.title}
                          fill
                          className="object-contain p-4 transition-transform group-hover:scale-105"
                          unoptimized
                        />
                      </div>
                    ) : safeExternalUrl ? (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center">
                        <ExternalLink className="h-10 w-10 text-primary" />
                        <span className="text-xs font-mono truncate max-w-[200px]">{safeExternalUrl.hostname}</span>
                      </div>
                    ) : asset.assetType === BrandAssetType.TYPOGRAPHY ? (
                      <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                        <Type className="h-12 w-12 text-primary/80" />
                        <span className="text-xs font-mono">
                          {asset.fileName || "Typography Package"}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                        <FileText className="h-12 w-12 text-muted-foreground/60" />
                        <span className="text-xs font-mono">
                          {asset.fileName || "Brand Document"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-4 space-y-2.5">
                    <div>
                      <h3 className="font-semibold text-base leading-snug tracking-tight">
                        {asset.title}
                      </h3>
                      {asset.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {asset.description}
                        </p>
                      )}
                    </div>

                    {/* Swatch detail chips if palette */}
                    {hasPalette && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {swatches.map((swatch, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => handleCopyHex(swatch.hex)}
                            aria-label={`Copy ${swatch.name} color ${swatch.hex}`}
                            title={`${swatch.name} (${swatch.hex})`}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono bg-muted/40 hover:bg-muted transition-colors"
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-black/10 inline-block"
                              style={{ backgroundColor: swatch.hex }}
                            />
                            <span>{swatch.hex}</span>
                            <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Tags */}
                    {asset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {asset.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className="text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => updateFilters({ search: tag })}
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4 pt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {asset.fileSize && (
                      <span>{formatFileSize(asset.fileSize)}</span>
                    )}
                    {asset.fileSize && <span>•</span>}
                    <span>
                      {new Date(asset.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewAsset(asset)}
                      className="h-8 gap-1 px-2 text-xs"
                    >
                      <Eye className="size-3.5" />
                      Preview
                    </Button>
                    {asset.fileUrl && (
                      <a
                        href={`/api/brand-assets/${asset.id}/file`}
                        download={asset.fileName || asset.title}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "h-8 px-2 text-xs flex items-center gap-1"
                        )}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    )}

                    {safeExternalUrl && (
                      <a
                        href={safeExternalUrl.href}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "h-8 px-2 text-xs flex items-center gap-1"
                        )}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Link
                      </a>
                    )}

                    {canManage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(asset)}
                        className="h-8 px-2 text-xs flex items-center gap-1"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${asset.title}`}
                        title="Delete asset"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(asset);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {results.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
          <span>
            Showing {(results.pagination.page - 1) * results.pagination.pageSize + 1} to{" "}
            {Math.min(results.pagination.page * results.pagination.pageSize, results.pagination.total)} of{" "}
            {results.pagination.total} assets
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={results.pagination.page <= 1 || isPending}
              onClick={() =>
                updateFilters({ page: String(results.pagination.page - 1) })
              }
            >
              Previous
            </Button>
            <span className="text-xs px-2">
              Page {results.pagination.page} of {results.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={
                results.pagination.page >= results.pagination.totalPages || isPending
              }
              onClick={() =>
                updateFilters({ page: String(results.pagination.page + 1) })
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={Boolean(previewAsset)} onOpenChange={(open) => !open && setPreviewAsset(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1.5rem)] max-w-5xl overflow-y-auto sm:max-w-5xl">
          {previewAsset && (
            <>
              <DialogHeader>
                <DialogTitle>{previewAsset.title}</DialogTitle>
                <DialogDescription>
                  {formatBrandAssetType(previewAsset.assetType)}
                  {previewAsset.project ? ` · ${previewAsset.project.name}` : previewAsset.client ? ` · ${previewAsset.client.name || previewAsset.client.email}` : " · Studio general"}
                </DialogDescription>
              </DialogHeader>
              <div className="min-w-0 space-y-4">
                {Array.isArray(previewAsset.colorPalette) && previewAsset.colorPalette.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {(previewAsset.colorPalette as ColorSwatchItem[]).map((swatch, index) => (
                      <button key={`${swatch.hex}-${index}`} type="button" onClick={() => handleCopyHex(swatch.hex)} className="overflow-hidden rounded-lg border text-left">
                        <span className="block h-24" style={{ backgroundColor: swatch.hex }} />
                        <span className="flex items-center justify-between gap-2 p-2 text-sm">
                          <span className="truncate">{swatch.name}</span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">{swatch.hex}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : previewAsset.fileUrl && previewAsset.fileMime === "application/pdf" ? (
                  <iframe
                    src={`/api/brand-assets/${previewAsset.id}/file#toolbar=0&view=FitH`}
                    title={`Preview of ${previewAsset.title}`}
                    className="h-[65dvh] min-h-80 w-full rounded-lg border bg-white"
                  />
                ) : previewAsset.fileUrl && (/^image\/(png|jpeg|webp|svg\+xml)$/.test(previewAsset.fileMime || "") || /\.(svg|png|jpe?g|webp)$/i.test(previewAsset.fileName || "")) ? (
                  <div className="relative flex h-[min(65dvh,44rem)] min-h-64 w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/20">
                    <Image src={`/api/brand-assets/${previewAsset.id}/file`} alt={previewAsset.title} fill unoptimized className="object-contain p-2" />
                  </div>
                ) : safePreviewUrl ? (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border bg-muted/20 p-6 text-center">
                    <ExternalLink className="size-10 text-muted-foreground" />
                    <p className="break-all text-sm text-muted-foreground">{safePreviewUrl.href}</p>
                    <a href={safePreviewUrl.href} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "default" }), "gap-2")}><ExternalLink className="size-4" />Open external asset</a>
                  </div>
                ) : (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border bg-muted/20 p-6 text-center text-muted-foreground">
                    {previewAsset.assetType === BrandAssetType.TYPOGRAPHY ? <Type className="size-12" /> : <FileText className="size-12" />}
                    <p className="font-medium text-foreground">{previewAsset.fileName || "Asset details"}</p>
                    <p className="max-w-lg text-sm">This file type cannot be previewed in the browser. Download it to view the full asset.</p>
                  </div>
                )}
                {previewAsset.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{previewAsset.description}</p>}
                {previewAsset.tags.length > 0 && <div className="flex flex-wrap gap-2">{previewAsset.tags.map((tag) => <span key={tag} className="rounded-md border px-2 py-1 text-xs text-muted-foreground">#{tag}</span>)}</div>}
              </div>
              {previewAsset.fileUrl && (
                <div className="flex justify-end border-t pt-3">
                  <a href={`/api/brand-assets/${previewAsset.id}/file`} download={previewAsset.fileName || previewAsset.title} className={cn(buttonVariants({ variant: "outline" }), "gap-2")}><Download className="size-4" />Download file</a>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {canManage && (
        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this brand asset?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget ? `“${deleteTarget.title}” will be removed from the library. This action cannot be undone.` : "This action cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={isDeleting} onClick={handleDeleteAsset}>
                {isDeleting ? "Deleting…" : "Delete asset"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Asset Dialog */}
      <BrandAssetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        asset={selectedAsset}
        clients={clients}
        projects={projects}
        onSuccess={() => {
          refreshAssets();
        }}
      />
    </div>
  );
}
