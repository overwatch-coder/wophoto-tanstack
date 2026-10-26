"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { type SerializedStudioBriefArchiveItem } from "@/lib/brief-templates";
import { getProfileImageSrc } from "@/lib/profile-image";
import { formatBriefStatus, getBriefStatusBadgeClass } from "@/components/briefs/labels";
import { Button } from "@/components/ui/button";
import { DebouncedSearchInput } from "@/components/brief-templates/debounced-search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BriefStatus } from "@/generated/prisma/browser";
import { type ShotItem } from "@/lib/validation/briefs";
import {
  Search,
  FolderKanban,
  Camera,
  Layers,
  Sparkles,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";

interface ProjectOption {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  name: string | null;
  email: string | null;
}

interface StudioBriefArchiveViewProps {
  initialBriefs: SerializedStudioBriefArchiveItem[];
  totalBriefs: number;
  projects: ProjectOption[];
  clients: ClientOption[];
  isManager: boolean;
  onConvertToTemplate?: (brief: SerializedStudioBriefArchiveItem) => void;
  onFilterChange: (filters: {
    search?: string;
    project?: string;
    client?: string;
    status?: BriefStatus;
    page: number;
  }) => void;
  currentPage: number;
  pageSize: number;
}

export function StudioBriefArchiveView({
  initialBriefs,
  totalBriefs,
  projects,
  clients,
  isManager,
  onConvertToTemplate,
  onFilterChange,
  currentPage,
  pageSize,
}: StudioBriefArchiveViewProps) {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const selectedProject = searchParams.get("project") ?? "ALL";
  const selectedClient = searchParams.get("client") ?? "ALL";
  const selectedStatus = searchParams.get("status") ?? "ALL";

  const [inspectBrief, setInspectBrief] =
    useState<SerializedStudioBriefArchiveItem | null>(null);

  const handleApplyFilter = (page = 1) => {
    onFilterChange({
      search: search.trim() || undefined,
      project: selectedProject !== "ALL" ? selectedProject : undefined,
      client: isManager && selectedClient !== "ALL" ? selectedClient : undefined,
      status: selectedStatus !== "ALL" ? (selectedStatus as BriefStatus) : undefined,
      page,
    });
  };

  const totalPages = Math.ceil(totalBriefs / pageSize);

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="space-y-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <DebouncedSearchInput
            key={search}
            value={search}
            onSearch={(value) => onFilterChange({
              search: value || undefined,
              project: selectedProject !== "ALL" ? selectedProject : undefined,
              client: isManager && selectedClient !== "ALL" ? selectedClient : undefined,
              status: selectedStatus !== "ALL" ? (selectedStatus as BriefStatus) : undefined,
              page: 1,
            })}
            placeholder="Search past studio briefs by title, project, or guidelines..."
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Project Filter */}
          <Select
            value={selectedProject === "ALL" ? null : selectedProject}
            onValueChange={(val) => {
              const v = val ?? "ALL";
              onFilterChange({
                search: search.trim() || undefined,
                project: v !== "ALL" ? v : undefined,
                client:
                  isManager && selectedClient !== "ALL"
                    ? selectedClient
                    : undefined,
                status:
                  selectedStatus !== "ALL"
                    ? (selectedStatus as BriefStatus)
                    : undefined,
                page: 1,
              });
            }}
          >
            <SelectTrigger className="w-full text-xs">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Client Filter (Manager only) */}
          {isManager && (
            <Select
              value={selectedClient === "ALL" ? null : selectedClient}
              onValueChange={(val) => {
                const v = val ?? "ALL";
                onFilterChange({
                  search: search.trim() || undefined,
                  project:
                    selectedProject !== "ALL" ? selectedProject : undefined,
                  client: v !== "ALL" ? v : undefined,
                  status:
                    selectedStatus !== "ALL"
                      ? (selectedStatus as BriefStatus)
                      : undefined,
                  page: 1,
                });
              }}
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.name || "Unnamed client"}>
                    {c.name || "Unnamed client"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Status Filter */}
          <Select
            value={selectedStatus === "ALL" ? null : selectedStatus}
            onValueChange={(val) => {
              const v = val ?? "ALL";
              onFilterChange({
                search: search.trim() || undefined,
                project:
                  selectedProject !== "ALL" ? selectedProject : undefined,
                client:
                  isManager && selectedClient !== "ALL"
                    ? selectedClient
                    : undefined,
                status: v !== "ALL" ? (v as BriefStatus) : undefined,
                page: 1,
              });
            }}
          >
            <SelectTrigger className="w-full text-xs">
              <SelectValue placeholder="All Statuses">
                {selectedStatus !== "ALL" ? formatBriefStatus(selectedStatus as BriefStatus) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value={BriefStatus.APPROVED}>Approved & Ready</SelectItem>
              <SelectItem value={BriefStatus.COMPLETED}>Completed</SelectItem>
              <SelectItem value={BriefStatus.IN_REVIEW}>In Review</SelectItem>
            </SelectContent>
          </Select>

        </div>
      </div>

      {/* Briefs Grid */}
      {initialBriefs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialBriefs.map((brief) => (
            <div
              key={brief.id}
              className="flex flex-col justify-between rounded-lg border bg-card text-card-foreground p-4 space-y-3 hover:border-primary/40 transition-colors shadow-xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground truncate">
                    {brief.project.name}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border shrink-0 ${getBriefStatusBadgeClass(
                      brief.status
                    )}`}
                  >
                    {formatBriefStatus(brief.status)}
                  </span>
                </div>

                <div>
                  <h4
                    onClick={() => setInspectBrief(brief)}
                    className="font-semibold text-base leading-snug line-clamp-1 hover:text-primary cursor-pointer transition-colors"
                  >
                    {brief.title}
                  </h4>
                  {brief.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {brief.summary}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                  <div className="flex items-center gap-1">
                    <Layers className="size-3.5 text-primary shrink-0" />
                    <span>
                      {brief.shotStats.total} shot
                      {brief.shotStats.total === 1 ? "" : "s"}
                    </span>
                  </div>
                  {brief.isPrimary && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted font-medium">
                      Primary Brief
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  {(() => {
                    const avatarUrl = getProfileImageSrc(
                      brief.createdBy.image,
                      brief.createdBy.id
                    );
                    return avatarUrl ? (
                      <div className="relative size-5 rounded-full overflow-hidden border">
                        <Image
                          src={avatarUrl}
                          alt={brief.createdBy.name ?? "Creator"}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium">
                        {brief.createdBy.name?.slice(0, 1) ?? "U"}
                      </div>
                    );
                  })()}
                  <span className="text-xs text-muted-foreground truncate max-w-[110px]">
                    {brief.createdBy.name ?? "Studio"}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInspectBrief(brief)}
                    className="size-8 p-0"
                    title="View Brief Details"
                  >
                    <Eye className="size-4" />
                  </Button>
                  {isManager && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onConvertToTemplate?.(brief)}
                      className="text-xs h-7 px-2"
                      title="Convert this brief into a master studio template"
                    >
                      <Sparkles className="size-3 mr-1 text-primary" />
                      Save as Template
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
          <FolderKanban className="size-8 mx-auto text-muted-foreground" />
          <h4 className="font-semibold text-sm">No studio briefs match your filters</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Try adjusting your search query, selecting a different project, or
            clearing the status filters.
          </p>
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span>
            Showing page {currentPage} of {totalPages} ({totalBriefs} total briefs)
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleApplyFilter(currentPage - 1)}
              disabled={currentPage <= 1}
              className="h-8 px-2"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleApplyFilter(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="h-8 px-2"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Inspect Past Brief Dialog */}
      {inspectBrief && (
        <Dialog open={Boolean(inspectBrief)} onOpenChange={() => setInspectBrief(null)}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:!max-w-5xl max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground font-medium">
                  {inspectBrief.project.name}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border ${getBriefStatusBadgeClass(
                    inspectBrief.status
                  )}`}
                >
                  {formatBriefStatus(inspectBrief.status)}
                </span>
              </div>
              <DialogTitle className="text-lg">{inspectBrief.title}</DialogTitle>
              {inspectBrief.summary && (
                <DialogDescription className="text-xs pt-1">
                  {inspectBrief.summary}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-4 pt-2 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                  <h5 className="text-xs font-semibold uppercase text-muted-foreground">
                    Visual Guidelines
                  </h5>
                  <p className="text-xs whitespace-pre-wrap">
                    {inspectBrief.guidelines || "No specific guidelines."}
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                  <h5 className="text-xs font-semibold uppercase text-muted-foreground">
                    Deliverables
                  </h5>
                  <p className="text-xs whitespace-pre-wrap">
                    {inspectBrief.deliverables || "Standard studio deliverables."}
                  </p>
                </div>
              </div>

              {/* Shot list */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                  <Camera className="size-3.5 text-primary" />
                  Shot List ({inspectBrief.shotStats.total} Setup
                  {inspectBrief.shotStats.total === 1 ? "" : "s"})
                </h5>
                {Array.isArray(inspectBrief.shotList) &&
                inspectBrief.shotList.length > 0 ? (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {(inspectBrief.shotList as ShotItem[]).map((shot, idx) => (
                      <div
                        key={shot.id}
                        className="p-2 rounded border bg-background text-xs space-y-0.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-muted-foreground">
                            #{idx + 1}
                          </span>
                          <span className="font-medium">{shot.title}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-mono bg-muted">
                            {shot.framing}
                          </span>
                        </div>
                        {shot.description && (
                          <p className="text-muted-foreground pl-5">
                            {shot.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No shot list on this brief.
                  </p>
                )}
              </div>

              {/* External URL and File */}
              <div className="flex flex-wrap gap-3 pt-2 border-t text-xs">
                {inspectBrief.externalUrl && (
                  <a
                    href={inspectBrief.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    Reference Link
                  </a>
                )}
                {inspectBrief.fileUrl && (
                  <a
                    href={inspectBrief.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                    download
                  >
                    <Download className="size-3.5" />
                    {inspectBrief.fileName ?? "Download File"}
                  </a>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setInspectBrief(null)}>
                Close
              </Button>
              {isManager && (
                <Button
                  onClick={() => {
                    const target = inspectBrief;
                    setInspectBrief(null);
                    onConvertToTemplate?.(target);
                  }}
                >
                  <Sparkles className="size-3.5 mr-1" />
                  Save as Template
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
