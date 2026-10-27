"use client";

import { useActionState, useRef, useState } from "react";
import {
  Archive,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  createStudioService,
  deleteStudioService,
  setStudioServiceActive,
  updateStudioService,
  type StudioServiceActionState,
} from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export type StudioServiceItem = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

const EMPTY: StudioServiceActionState = {};

function FormMessage({ state }: { state: StudioServiceActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={`text-sm ${state.error ? "text-destructive" : "text-muted-foreground"}`}
    >
      {state.error ?? state.success}
    </p>
  );
}

export function CreateServiceDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createStudioService, EMPTY);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="h-10 w-full gap-2 px-4 sm:w-auto">
            <Plus aria-hidden="true" className="size-4" />
            Add service
          </Button>
        }
      />
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-y-contain p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-5 pr-12 sm:px-6">
          <DialogTitle className="text-lg">Add a studio service</DialogTitle>
          <DialogDescription className="max-w-prose leading-5">
            Add a service your team can assign to tasks and use in studio performance reports.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-5 px-5 py-5 sm:px-6">
          <div className="space-y-2">
            <Label htmlFor="new-service-name">Service name</Label>
            <Input
              id="new-service-name"
              name="name"
              minLength={2}
              maxLength={80}
              required
              autoFocus
              placeholder="For example, Event Coverage"
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-service-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="new-service-description"
              name="description"
              maxLength={500}
              rows={4}
              placeholder="Add context to help your team choose the right service."
              className="min-h-24 resize-y text-base md:text-sm"
            />
          </div>
          <FormMessage state={state} />
          <DialogFooter className="-mx-5 -mb-5 mt-6 border-t border-border bg-muted/30 px-5 py-4 sm:-mx-6 sm:-mb-5 sm:px-6">
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pending}>
                  Cancel
                </Button>
              }
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServiceActions({ service }: { service: StudioServiceItem }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editState, editAction, editPending] = useActionState(updateStudioService, EMPTY);
  const [activeState, activeAction, activePending] = useActionState(setStudioServiceActive, EMPTY);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteStudioService, EMPTY);
  const activeForm = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={activeForm} action={activeAction} className="hidden">
        <input type="hidden" name="id" value={service.id} />
        <input type="hidden" name="isActive" value={String(!service.isActive)} />
      </form>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${service.name}`}
              className="size-9 shrink-0"
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden="true" />
            Edit service
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={activePending}
            onClick={() => activeForm.current?.requestSubmit()}
          >
            {service.isActive ? (
              <>
                <Archive aria-hidden="true" />
                Archive service
              </>
            ) : (
              <>
                <RotateCcw aria-hidden="true" />
                Restore service
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden="true" />
            Delete service
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FormMessage state={activeState} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {service.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the service from all existing tasks. The tasks themselves will remain, but this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteState.error ? <FormMessage state={deleteState} /> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <form action={deleteAction} className="contents">
              <input type="hidden" name="id" value={service.id} />
              <Button type="submit" variant="destructive" disabled={deletePending}>
                {deletePending ? "Deleting…" : "Delete service"}
              </Button>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-y-contain p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border px-5 py-5 pr-12 sm:px-6">
            <DialogTitle className="text-lg">Edit service</DialogTitle>
            <DialogDescription className="max-w-prose leading-5">
              Update how this service appears in task forms and studio reports.
            </DialogDescription>
          </DialogHeader>
          <form action={editAction} className="space-y-5 px-5 py-5 sm:px-6">
            <input type="hidden" name="id" value={service.id} />
            <div className="space-y-2">
              <Label htmlFor={`service-name-${service.id}`}>Service name</Label>
              <Input
                id={`service-name-${service.id}`}
                name="name"
                defaultValue={service.name}
                minLength={2}
                maxLength={80}
                required
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`service-description-${service.id}`}>
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id={`service-description-${service.id}`}
                name="description"
                defaultValue={service.description ?? ""}
                maxLength={500}
                rows={4}
                placeholder="Add context for your team."
                className="min-h-24 resize-y text-base md:text-sm"
              />
            </div>
            <FormMessage state={editState} />
            <DialogFooter className="-mx-5 -mb-5 mt-6 border-t border-border bg-muted/30 px-5 py-4 sm:-mx-6 sm:-mb-5 sm:px-6">
              <DialogClose
                render={
                  <Button type="button" variant="outline" disabled={editPending}>
                    Cancel
                  </Button>
                }
              />
              <Button type="submit" disabled={editPending}>
                {editPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ServiceStatus({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${active ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
      />
      {active ? "Active" : "Archived"}
    </span>
  );
}

function EmptyServices() {
  return (
    <div className="flex flex-col items-center px-5 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Wrench aria-hidden="true" className="size-5" />
      </span>
      <h3 className="mt-4 font-medium">No services yet</h3>
      <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">
        Add the services your studio provides. They will be available when your team creates tasks.
      </p>
    </div>
  );
}

function ServiceTable({ services }: { services: StudioServiceItem[] }) {
  if (!services.length) return <EmptyServices />;

  return (
    <Table
      containerClassName="rounded-b-xl"
      className="min-w-[620px]"
    >
      <TableHeader>
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableHead className="w-[28%]">Service</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="w-28">Status</TableHead>
          <TableHead className="w-14 text-right"><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {services.map((service) => (
          <TableRow key={service.id} className="group">
            <TableCell className="py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Wrench aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0 break-words font-medium text-foreground">{service.name}</span>
              </div>
            </TableCell>
            <TableCell className="max-w-md py-4 text-muted-foreground">
              {service.description || <span className="text-muted-foreground/70">No description</span>}
            </TableCell>
            <TableCell className="py-4"><ServiceStatus active={service.isActive} /></TableCell>
            <TableCell className="py-3 text-right">
              <ServiceActions service={service} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ServiceCards({ services }: { services: StudioServiceItem[] }) {
  if (!services.length) return <EmptyServices />;

  return (
    <div className="grid gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4 xl:grid-cols-3">
      {services.map((service) => (
        <article
          key={service.id}
          className="min-w-0 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wrench aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0 pt-0.5">
                <h3 className="break-words font-medium text-foreground">{service.name}</h3>
                <div className="mt-2"><ServiceStatus active={service.isActive} /></div>
              </div>
            </div>
            <ServiceActions service={service} />
          </div>
          <p className="mt-4 min-h-10 break-words text-sm leading-5 text-muted-foreground">
            {service.description || "No description provided."}
          </p>
        </article>
      ))}
    </div>
  );
}

export function ServicesManager({ services }: { services: StudioServiceItem[] }) {
  const [view, setView] = useState("table");
  const activeCount = services.filter((service) => service.isActive).length;
  const archivedCount = services.length - activeCount;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <Tabs value={view} onValueChange={(nextView) => setView(nextView)} className="gap-0">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">Service catalog</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeCount} active{archivedCount ? ` · ${archivedCount} archived` : ""}
            </p>
          </div>
          <TabsList aria-label="Service layout" className="w-full self-start sm:w-auto sm:self-auto">
            <TabsTrigger value="table" className="min-h-9 gap-2 sm:px-3">
              <List aria-hidden="true" className="size-4" />
              <span>Table</span>
            </TabsTrigger>
            <TabsTrigger value="cards" className="min-h-9 gap-2 sm:px-3">
              <LayoutGrid aria-hidden="true" className="size-4" />
              <span>Cards</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="table" className="mt-0 focus-visible:outline-none">
          <ServiceTable services={services} />
        </TabsContent>
        <TabsContent value="cards" className="mt-0 focus-visible:outline-none">
          <ServiceCards services={services} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
