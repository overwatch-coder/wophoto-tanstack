"use client";

import { useActionState } from "react";
import { Archive, Check, Plus, RotateCcw, Save, Wrench } from "lucide-react";
import { createStudioService, setStudioServiceActive, updateStudioService, type StudioServiceActionState } from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type StudioServiceItem = { id: string; name: string; description: string | null; isActive: boolean };
const EMPTY: StudioServiceActionState = {};

function FormMessage({ state }: { state: StudioServiceActionState }) {
  if (!state.error && !state.success) return null;
  return <p role={state.error ? "alert" : "status"} className={`text-sm ${state.error ? "text-destructive" : "text-muted-foreground"}`}>{state.error ?? state.success}</p>;
}

function ServiceRow({ service }: { service: StudioServiceItem }) {
  const [editState, editAction, editPending] = useActionState(updateStudioService, EMPTY);
  const [activeState, activeAction, activePending] = useActionState(setStudioServiceActive, EMPTY);
  return (
    <article className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Wrench aria-hidden="true" className="size-5" /></span>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">{service.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{service.isActive ? "Available for new tasks" : "Archived, existing tasks are retained"}</p>
          </div>
        </div>
        <form action={activeAction}>
          <input type="hidden" name="id" value={service.id} />
          <input type="hidden" name="isActive" value={String(!service.isActive)} />
          <Button type="submit" variant="outline" size="sm" disabled={activePending}>
            {service.isActive ? <><Archive aria-hidden="true" className="size-4" /> Archive</> : <><RotateCcw aria-hidden="true" className="size-4" /> Restore</>}
          </Button>
          <div className="mt-2 text-right"><FormMessage state={activeState} /></div>
        </form>
      </div>
      <form action={editAction} className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
        <input type="hidden" name="id" value={service.id} />
        <div className="space-y-2">
          <Label htmlFor={`service-name-${service.id}`}>Service name</Label>
          <Input id={`service-name-${service.id}`} name="name" defaultValue={service.name} maxLength={80} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`service-description-${service.id}`}>Description</Label>
          <Input id={`service-description-${service.id}`} name="description" defaultValue={service.description ?? ""} maxLength={500} placeholder="Optional" />
        </div>
        <Button type="submit" variant="secondary" disabled={editPending}><Save aria-hidden="true" className="size-4" /> Save</Button>
        <div className="sm:col-span-3"><FormMessage state={editState} /></div>
      </form>
    </article>
  );
}

export function ServicesManager({ services }: { services: StudioServiceItem[] }) {
  const [state, formAction, pending] = useActionState(createStudioService, EMPTY);
  const active = services.filter((service) => service.isActive);
  const archived = services.filter((service) => !service.isActive);
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Plus aria-hidden="true" className="size-5" /></span>
          <div><h2 className="text-lg font-semibold">Add a service</h2><p className="mt-1 text-sm text-muted-foreground">Services appear in task forms and studio performance reports.</p></div>
        </div>
        <form action={formAction} className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
          <div className="space-y-2"><Label htmlFor="new-service-name">Service name</Label><Input id="new-service-name" name="name" maxLength={80} minLength={2} required placeholder="For example, Event Coverage" /></div>
          <div className="space-y-2"><Label htmlFor="new-service-description">Description</Label><Textarea id="new-service-description" name="description" maxLength={500} rows={1} placeholder="Optional" /></div>
          <Button type="submit" disabled={pending}><Plus aria-hidden="true" className="size-4" /> Create service</Button>
          <div className="sm:col-span-3"><FormMessage state={state} /></div>
        </form>
      </section>
      <section aria-labelledby="active-services-title" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3"><h2 id="active-services-title" className="text-lg font-semibold">Active services</h2><span className="text-sm text-muted-foreground">{active.length}</span></div>
        {active.length ? <div className="space-y-3">{active.map((service) => <ServiceRow key={service.id} service={service} />)}</div> : <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center"><Check aria-hidden="true" className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 font-medium">No active services</p><p className="mt-1 text-sm text-muted-foreground">Create a service to make it available in task forms.</p></div>}
      </section>
      {archived.length ? <section aria-labelledby="archived-services-title" className="space-y-3"><h2 id="archived-services-title" className="text-lg font-semibold">Archived services</h2><div className="space-y-3">{archived.map((service) => <ServiceRow key={service.id} service={service} />)}</div></section> : null}
    </div>
  );
}
