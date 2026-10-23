"use client";

import { useState } from "react";
import { Plus, FolderPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROTOTYPE_CLIENTS } from "./data";
import { PrototypeProject } from "./types";

export function AddProjectModal({
  onAddProject,
  variant = "default",
}: {
  onAddProject: (project: PrototypeProject) => void;
  variant?: "default" | "compact" | "accent";
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(PROTOTYPE_CLIENTS[0].id);
  const [category, setCategory] = useState<PrototypeProject["category"]>("Wedding");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("2026-11-30");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const selectedClient =
      PROTOTYPE_CLIENTS.find((c) => c.id === clientId) || PROTOTYPE_CLIENTS[0];

    const newProject: PrototypeProject = {
      id: `proj-${Date.now().toString(36)}`,
      name: name.trim(),
      description: description.trim() || "No description provided.",
      client: selectedClient,
      status: "IN_PROGRESS",
      category,
      totalTasks: 1,
      completedTasks: 0,
      dueDate,
      updatedAt: "Just now",
    };

    onAddProject(newProject);
    setName("");
    setDescription("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          variant === "accent" ? (
            <Button className="h-9 gap-2 rounded-lg bg-orange-600 px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-700">
              <Plus className="size-4" />
              <span>New Project</span>
            </Button>
          ) : (
            <Button className="h-9 gap-2 rounded-lg bg-orange-600 px-4 text-xs font-medium text-white shadow-sm hover:bg-orange-700">
              <FolderPlus className="size-4" />
              <span>Add Project</span>
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-orange-600/15 text-orange-600 dark:text-orange-400">
              <FolderPlus className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Create New Project
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set up a new production project and assign it to a client.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Project Name */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-name" className="text-xs font-medium text-foreground">
              Project Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="proj-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. North Coast Autumn Campaign"
              className="h-9 text-sm"
            />
          </div>

          {/* Client Select & Category in 2 columns */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="proj-client" className="text-xs font-medium text-foreground">
                Client <span className="text-rose-500">*</span>
              </Label>
              <select
                id="proj-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-xs outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              >
                {PROTOTYPE_CLIENTS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="proj-category" className="text-xs font-medium text-foreground">
                Category
              </Label>
              <select
                id="proj-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as PrototypeProject["category"])}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-xs outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              >
                <option value="Wedding">Wedding</option>
                <option value="Commercial">Commercial</option>
                <option value="Editorial">Editorial</option>
                <option value="Portrait">Portrait</option>
                <option value="Event">Event</option>
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-duedate" className="text-xs font-medium text-foreground">
              Target Delivery Date
            </Label>
            <Input
              id="proj-duedate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-desc" className="text-xs font-medium text-foreground">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="proj-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline deliverables, moodboard links, location notes..."
              className="text-xs leading-relaxed"
            />
          </div>

          <DialogFooter className="-mx-6 -mb-6 mt-5 border-t border-border bg-muted/30 px-6 py-3.5">
            <DialogClose
              render={
                <Button type="button" variant="outline" className="h-8 px-3 text-xs">
                  Cancel
                </Button>
              }
            />
            <Button
              type="submit"
              className="h-8 gap-1.5 bg-orange-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-orange-700"
            >
              <Sparkles className="size-3.5" />
              <span>Create Project</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
