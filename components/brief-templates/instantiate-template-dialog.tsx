import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
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
import { instantiateBriefFromTemplate } from "@/app/actions/brief-templates";
import { type SerializedBriefTemplate } from "@/lib/brief-templates";
import { Loader2, FolderKanban, PlusCircle } from "lucide-react";

interface ProjectOption {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  name: string | null;
  email: string | null;
}

interface InstantiateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: SerializedBriefTemplate | null;
  projects: ProjectOption[];
  clients: ClientOption[];
  onSuccess?: (result: { briefId: string; projectId: string }) => void;
}

export function InstantiateTemplateDialog({
  open,
  onOpenChange,
  template,
  projects,
  clients,
  onSuccess,
}: InstantiateTemplateDialogProps) {
  const router = useRouter();
  const [targetType, setTargetType] = useState<"EXISTING_PROJECT" | "NEW_PROJECT">(
    projects.length > 0 ? "EXISTING_PROJECT" : "NEW_PROJECT"
  );

  // Existing Project Fields
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects[0]?.id ?? ""
  );
  const [isPrimary, setIsPrimary] = useState(false);

  // New Project Fields
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>(
    clients[0]?.id ?? ""
  );
  const [newProjectDesc, setNewProjectDesc] = useState("");

  // Optional Title Override
  const [briefTitle, setBriefTitle] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!template) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload =
        targetType === "EXISTING_PROJECT"
          ? {
              templateId: template.id,
              target: {
                type: "EXISTING_PROJECT" as const,
                projectId: selectedProjectId,
                isPrimary,
                title: briefTitle.trim() || undefined,
              },
            }
          : {
              templateId: template.id,
              target: {
                type: "NEW_PROJECT" as const,
                projectName: newProjectName.trim(),
                clientId: selectedClientId,
                description: newProjectDesc.trim() || undefined,
                title: briefTitle.trim() || undefined,
              },
            };

      const res = await instantiateBriefFromTemplate(payload);

      if (res.error) {
        setErrorMessage(res.error);
      } else if (res.briefId && res.projectId) {
        onOpenChange(false);
        if (onSuccess) {
          onSuccess({ briefId: res.briefId, projectId: res.projectId });
        } else {
          router.navigate({
            href: `/manager/brief-review?search=${encodeURIComponent(briefTitle.trim() || template.title)}`,
          });
        }
      }
    } catch {
      setErrorMessage("Failed to instantiate brief from template.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:!max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Use Brief Template</DialogTitle>
          <DialogDescription>
            Create a new creative brief from &quot;{template.title}&quot; with
            its default guidelines and {template.shotStats.total} shot item
            {template.shotStats.total === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMessage && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {errorMessage}
            </div>
          )}

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setTargetType("EXISTING_PROJECT")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-md transition-colors ${
                targetType === "EXISTING_PROJECT"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderKanban className="size-3.5" />
              Existing Project
            </button>
            <button
              type="button"
              onClick={() => setTargetType("NEW_PROJECT")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-md transition-colors ${
                targetType === "NEW_PROJECT"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <PlusCircle className="size-3.5" />
              Create New Project
            </button>
          </div>

          {targetType === "EXISTING_PROJECT" ? (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5 md:w-1/2">
                <Label htmlFor="target-project">Select Project</Label>
                {projects.length > 0 ? (
                  <Select
                    value={selectedProjectId}
                    onValueChange={(val) => setSelectedProjectId(val ?? "")}
                  >
                    <SelectTrigger id="target-project" className="w-full">
                      <SelectValue placeholder="Choose a project">
                        {projects.find((project) => project.id === selectedProjectId)?.name}
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
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No active projects found. Switch to &quot;Create New Project&quot; above.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="target-is-primary"
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="size-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label
                  htmlFor="target-is-primary"
                  className="text-xs font-normal cursor-pointer"
                >
                  Set as primary project brief (replaces current primary brief)
                </Label>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="new-project-name">
                    Project Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="new-project-name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. Fall Brand Lookbook Shoot"
                    required
                    maxLength={100}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-project-client">
                    Client <span className="text-destructive">*</span>
                  </Label>
                  {clients.length > 0 ? (
                    <Select
                      value={selectedClientId}
                      onValueChange={(val) => setSelectedClientId(val ?? "")}
                    >
                      <SelectTrigger id="new-project-client" className="w-full">
                        <SelectValue placeholder="Select invited client">
                          {(() => {
                            const client = clients.find((item) => item.id === selectedClientId);
                            return client ? (client.name ? `${client.name} (${client.email})` : client.email) : undefined;
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name ? `${c.name} (${c.email})` : c.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-destructive">
                      No active clients found. Invite a client before creating a project.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-project-desc">Project Description (Optional)</Label>
                <Textarea
                  id="new-project-desc"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Initial notes on project scope or client goals."
                  rows={2}
                  maxLength={500}
                />
              </div>
            </div>
          )}

          {/* Optional Brief Title Override */}
          <div className="space-y-1.5 pt-2 border-t">
            <Label htmlFor="brief-title-override">
              Brief Title (Defaults to template title if left blank)
            </Label>
            <Input
              id="brief-title-override"
              value={briefTitle}
              onChange={(e) => setBriefTitle(e.target.value)}
              placeholder={template.title}
              maxLength={150}
            />
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                (targetType === "EXISTING_PROJECT" && !selectedProjectId) ||
                (targetType === "NEW_PROJECT" &&
                  (!newProjectName.trim() || !selectedClientId))
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Instantiating...
                </>
              ) : (
                "Instantiate Brief"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
