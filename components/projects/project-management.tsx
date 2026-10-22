"use client";

import { useRef, useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { createProject, type ProjectActionState } from "@/app/actions/projects";
import { cleanClientName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ClientOption = { id: string; name: string | null };
type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  client: { name: string | null };
};

const initialState: ProjectActionState = {};

function ViewProjectDialog({ project }: { project: ProjectSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5">
            <Eye className="size-3.5" />
            <span>View</span>
          </Button>
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <span className="text-xs font-medium text-muted-foreground">Project Details</span>
          <DialogTitle className="mt-1 text-xl font-semibold leading-snug">
            {project.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <span className="text-xs text-muted-foreground">Client</span>
            <p className="mt-0.5 font-medium text-foreground">
              {cleanClientName(project.client.name) || "Unnamed client"}
            </p>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</h4>
            {project.description ? (
              <div className="whitespace-pre-wrap rounded-md border bg-background p-3 text-sm leading-relaxed text-foreground">
                {project.description}
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">No description provided for this project.</p>
            )}
          </div>
        </div>

        <DialogFooter className="-mx-4 -mb-4 mt-4 border-t bg-muted/40 px-4 py-3">
          <DialogClose render={<Button variant="outline">Close</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectManagement({
  projects,
  clients,
}: {
  projects: ProjectSummary[];
  clients: ClientOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<ProjectActionState>(initialState);
  const [pending, startTransition] = useTransition();

  const clientItems = clients.map((client) => ({
    value: client.id,
    label: cleanClientName(client.name) || "Unnamed client",
  }));

  const handleSubmit = (formData: FormData) => {
    setState({});
    startTransition(async () => {
      const res = await createProject(initialState, formData);
      setState(res);
      if (res.success) {
        formRef.current?.reset();
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Create projects to organize assigned work and connect it to a client.
        </p>
      </header>

      <section className="space-y-5 rounded-md border bg-card p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Create a project</h2>
          <p className="text-sm text-muted-foreground">
            Projects are available for task assignment as soon as they are created.
          </p>
        </div>

        {clients.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No eligible clients yet. Invite a client from Team Invitations and have them accept the invitation before creating a project.
          </div>
        ) : (
          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input id="project-name" name="name" required maxLength={120} placeholder="e.g. North Coast Campaign" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-client">Client</Label>
              <Select name="clientId" required items={clientItems}>
                <SelectTrigger id="project-client" className="w-full">
                  <SelectValue placeholder="Choose a client" />
                </SelectTrigger>
                <SelectContent>
                  {clientItems.map((client) => (
                    <SelectItem key={client.value} value={client.value}>
                      {client.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea id="project-description" name="description" maxLength={5000} rows={4} placeholder="Add a short overview of the project." />
            </div>

            {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
            {state.success ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{state.success}</p> : null}

            <Button type="submit" disabled={pending}>
              {pending ? "Creating project…" : "Create project"}
            </Button>
          </form>
        )}
      </section>

      <section className="space-y-4 rounded-md border bg-card p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Your projects</h2>
          <p className="text-sm text-muted-foreground">Projects you manage and their connected clients.</p>
        </div>
        {projects.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No projects yet. Create one above to start organizing work.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((project) => (
                  <tr key={project.id} className="align-middle">
                    <td className="px-4 py-3.5 font-medium text-foreground">
                      {project.name}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {cleanClientName(project.client.name) || "Unnamed client"}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <ViewProjectDialog project={project} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
