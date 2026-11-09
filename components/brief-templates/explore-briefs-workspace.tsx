import { useMemo, useState, useTransition } from "react";
import { useRouter, useLocation } from "@tanstack/react-router";
import {
  type SerializedBriefTemplate,
  type SerializedStudioBriefArchiveItem,
} from "@/lib/brief-templates";
import { UserRole, BriefTemplateCategory } from "@/generated/prisma/browser";
import {
  BRIEF_TEMPLATE_CATEGORY_LABELS,
  formatBriefTemplateCategory,
} from "@/components/brief-templates/labels";
import { TemplateCard } from "@/components/brief-templates/template-card";
import { TemplateDialog, type BriefTemplateFormData } from "@/components/brief-templates/template-dialog";
import { InstantiateTemplateDialog } from "@/components/brief-templates/instantiate-template-dialog";
import { TemplatePreviewDialog } from "@/components/brief-templates/template-preview-dialog";
import { StudioBriefArchiveView } from "@/components/brief-templates/studio-brief-archive-view";
import { ConvertToTemplateDialog } from "@/components/brief-templates/convert-to-template-dialog";
import { DebouncedSearchInput } from "@/components/brief-templates/debounced-search-input";
import {
  archiveBriefTemplate,
  unarchiveBriefTemplate,
} from "@/src/server/actions/brief-templates";
import { Button } from "@/components/ui/button";
import { type ShotItem } from "@/lib/validation/briefs";
import {
  Search,
  Plus,
  FolderSearch,
  Sparkles,
  ChevronLeft,
  ChevronRight,
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

interface ExploreBriefsWorkspaceProps {
  initialTemplates: SerializedBriefTemplate[];
  totalTemplates: number;
  availableTags: string[];
  initialArchiveBriefs: SerializedStudioBriefArchiveItem[];
  totalArchiveBriefs: number;
  projects: ProjectOption[];
  clients: ClientOption[];
  role: UserRole;
}

export function ExploreBriefsWorkspace({
  initialTemplates,
  totalTemplates,
  availableTags,
  initialArchiveBriefs,
  totalArchiveBriefs,
  projects,
  clients,
  role,
}: ExploreBriefsWorkspaceProps) {
  const router = useRouter();
  const location = useLocation();
  const pathname = location.pathname;
  const searchParams = useMemo(() => new URLSearchParams(location.searchStr), [location.searchStr]);
  const [, startTransition] = useTransition();

  const isManager = role === UserRole.MANAGER;

  // Active Tab: "templates" or "archive"
  const currentTab = searchParams.get("tab") === "archive" ? "archive" : "templates";

  // Template Search & Filter State
  const templateSearch = searchParams.get("search") ?? "";
  const selectedCategory = searchParams.get("category") ?? "ALL";
  const selectedTag = searchParams.get("tag") ?? "";
  const includeArchived = searchParams.get("archived") === "true";
  const templatePage = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const pageSize = 12;

  // Modals state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<BriefTemplateFormData | null>(null);

  const [instantiateOpen, setInstantiateOpen] = useState(false);
  const [targetTemplate, setTargetTemplate] =
    useState<SerializedBriefTemplate | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] =
    useState<SerializedBriefTemplate | null>(null);

  const [convertOpen, setConvertOpen] = useState(false);
  const [convertSourceBrief, setConvertSourceBrief] = useState<{
    id: string;
    title: string;
    tags?: string[];
  } | null>(null);

  // Update query params in URL
  const updateQuery = (params: Record<string, string | null | undefined>) => {
    const current = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(params)) {
      if (val === null || val === undefined || val === "") {
        current.delete(key);
      } else {
        current.set(key, val);
      }
    }
    startTransition(() => {
      router.navigate({ href: `${pathname}?${current.toString()}` });
    });
  };

  const handleTabChange = (tab: "templates" | "archive") => {
    updateQuery({
      tab: tab === "templates" ? null : "archive",
      page: null,
      search: null,
      category: null,
      tag: null,
      project: null,
      status: null,
      client: null,
    });
  };

  const handleCategorySelect = (catKey: string) => {
    updateQuery({
      category: catKey === "ALL" ? null : catKey,
      page: null,
    });
  };

  const handleTagSelect = (tag: string) => {
    updateQuery({
      tag: selectedTag === tag ? null : tag,
      page: null,
    });
  };

  const handleArchiveToggle = async (template: SerializedBriefTemplate) => {
    if (!isManager) return;
    try {
      if (template.isArchived) {
        await unarchiveBriefTemplate({ id: template.id });
      } else {
        await archiveBriefTemplate({ id: template.id });
      }
      router.invalidate();
    } catch {
      // Handled by revalidation
    }
  };

  const totalTemplatePages = Math.ceil(totalTemplates / pageSize);

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Explore Briefs & Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse studio master templates, review past project creative
            guidelines, and spin up new shoot briefs.
          </p>
        </div>

        {isManager && (
          <Button
            onClick={() => {
              setEditingTemplate(null);
              setTemplateDialogOpen(true);
            }}
            className="shrink-0"
          >
            <Plus className="size-4 mr-1.5" />
            Create Template
          </Button>
        )}
      </div>

      {/* Primary Tab Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto border-b">
        <button
          type="button"
          onClick={() => handleTabChange("templates")}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            currentTab === "templates"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="size-4" />
          <span className="sm:hidden">Templates ({totalTemplates})</span>
          <span className="hidden sm:inline">Reusable Templates ({totalTemplates})</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("archive")}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            currentTab === "archive"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FolderSearch className="size-4" />
          <span className="sm:hidden">Brief Archive ({totalArchiveBriefs})</span>
          <span className="hidden sm:inline">Studio Brief Archive ({totalArchiveBriefs})</span>
        </button>
      </div>

      {/* Tab Content */}
      {currentTab === "templates" ? (
        <div className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-2">
            <button
              type="button"
              onClick={() => handleCategorySelect("ALL")}
              className={`shrink-0 whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                selectedCategory === "ALL"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground border-border"
              }`}
            >
              All Categories
            </button>
            {Object.keys(BRIEF_TEMPLATE_CATEGORY_LABELS).map((catKey) => {
              const active = selectedCategory === catKey;
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => handleCategorySelect(catKey)}
                  className={`shrink-0 whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/70 text-muted-foreground hover:text-foreground border-border"
                  }`}
                >
                  {formatBriefTemplateCategory(catKey as BriefTemplateCategory)}
                </button>
              );
            })}
          </div>

          {/* Search, Tag Filtering, & Manager Archive Toggle */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <DebouncedSearchInput
                key={templateSearch}
                value={templateSearch}
                onSearch={(value) => updateQuery({ search: value || null, page: null })}
                placeholder="Search templates by title, summary, or guidelines..."
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              {isManager && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateQuery({
                      archived: includeArchived ? null : "true",
                      page: null,
                    })
                  }
                  className={`text-xs ${includeArchived ? "bg-muted font-semibold" : ""}`}
                >
                  {includeArchived ? "Hide Archived" : "Show Archived"}
                </Button>
              )}
            </div>
          </div>

          {/* Available Tag Chips if present */}
          {availableTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-xs pt-1">
              <span className="text-muted-foreground font-medium mr-1">Tags:</span>
              {availableTags.slice(0, 15).map((tag) => {
                const isSelected = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagSelect(tag)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground hover:text-foreground border-border"
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
              {selectedTag && (
                <button
                  type="button"
                  onClick={() => handleTagSelect("")}
                  className="px-2 py-0.5 rounded text-[11px] text-destructive hover:underline ml-1"
                >
                  Clear tag
                </button>
              )}
            </div>
          )}

          {/* Template Cards Grid */}
          {initialTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {initialTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isManager={isManager}
                  onPreview={(tmpl) => {
                    setPreviewTemplate(tmpl);
                    setPreviewOpen(true);
                  }}
                  onUseTemplate={(tmpl) => {
                    setTargetTemplate(tmpl);
                    setInstantiateOpen(true);
                  }}
                  onEdit={(tmpl) => {
                    setEditingTemplate({
                      id: tmpl.id,
                      title: tmpl.title,
                      summary: tmpl.summary,
                      category: tmpl.category,
                      tags: tmpl.tags,
                      deliverables: tmpl.deliverables,
                      guidelines: tmpl.guidelines,
                      externalLinks: tmpl.externalLinks,
                      shotList: Array.isArray(tmpl.shotList)
                        ? (tmpl.shotList as ShotItem[])
                        : null,
                      coverImageUrl: tmpl.coverImageUrl,
                      attachmentUrl: tmpl.attachmentUrl,
                      attachmentName: tmpl.attachmentName,
                      isArchived: tmpl.isArchived,
                    });
                    setTemplateDialogOpen(true);
                  }}
                  onArchiveToggle={handleArchiveToggle}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-12 text-center space-y-3">
              <Sparkles className="size-8 mx-auto text-muted-foreground" />
              <h3 className="font-semibold text-base">No templates found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {selectedCategory !== "ALL" || selectedTag || templateSearch
                  ? "Try adjusting your category, tag, or search filters."
                  : isManager
                  ? "Get started by creating your studio's first reusable brief template, or convert an existing project brief."
                  : "No templates have been published in the studio library yet."}
              </p>
              {isManager && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateDialogOpen(true);
                  }}
                  className="text-xs mt-2"
                >
                  <Plus className="size-3.5 mr-1" />
                  Create Template
                </Button>
              )}
            </div>
          )}

          {/* Pagination Controls */}
          {totalTemplatePages > 1 && (
            <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
              <span>
                Page {templatePage} of {totalTemplatePages} ({totalTemplates} total templates)
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateQuery({ page: String(templatePage - 1) })}
                  disabled={templatePage <= 1}
                  className="h-8 px-2"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateQuery({ page: String(templatePage + 1) })}
                  disabled={templatePage >= totalTemplatePages}
                  className="h-8 px-2"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Studio Brief Archive View */
        <StudioBriefArchiveView
          initialBriefs={initialArchiveBriefs}
          totalBriefs={totalArchiveBriefs}
          projects={projects}
          clients={clients}
          isManager={isManager}
          onConvertToTemplate={(brief) => {
            setConvertSourceBrief({
              id: brief.id,
              title: brief.title,
              tags: brief.tags,
            });
            setConvertOpen(true);
          }}
          onFilterChange={(filters) => {
            updateQuery({
              search: filters.search ?? null,
              project: filters.project ?? null,
              client: filters.client ?? null,
              status: filters.status ?? null,
              page: filters.page > 1 ? String(filters.page) : null,
            });
          }}
          currentPage={parseInt(searchParams.get("page") ?? "1", 10) || 1}
          pageSize={pageSize}
        />
      )}

      {/* Dialogs */}
      {templateDialogOpen && (
        <TemplateDialog
          open={templateDialogOpen}
          onOpenChange={setTemplateDialogOpen}
          template={editingTemplate}
          onSuccess={() => {
            router.invalidate();
          }}
        />
      )}

      {instantiateOpen && targetTemplate && (
        <InstantiateTemplateDialog
          open={instantiateOpen}
          onOpenChange={setInstantiateOpen}
          template={targetTemplate}
          projects={projects}
          clients={clients}
          onSuccess={() => {
            router.navigate({ href: `/manager/brief-review?search=${encodeURIComponent(targetTemplate.title)}` });
          }}
        />
      )}

      {previewOpen && previewTemplate && (
        <TemplatePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          template={previewTemplate}
          isManager={isManager}
          onUseTemplate={(tmpl) => {
            setTargetTemplate(tmpl);
            setInstantiateOpen(true);
          }}
        />
      )}

      {convertOpen && convertSourceBrief && (
        <ConvertToTemplateDialog
          open={convertOpen}
          onOpenChange={setConvertOpen}
          brief={convertSourceBrief}
          onSuccess={() => {
            router.invalidate();
          }}
        />
      )}
    </div>
  );
}
