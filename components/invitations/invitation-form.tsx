"use client";

import { useActionState } from "react";
import { InvitationLinkActions } from "@/components/invitations/invitation-link-actions";

import {
  createInvitation,
  type InvitationFormState,
} from "@/app/actions/invitations";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: InvitationFormState = {};
const controlClassName = "h-10 w-full data-[size=default]:h-10 dark:border-white/20 dark:bg-white/[0.04] dark:hover:border-white/30 dark:hover:bg-white/[0.06] dark:focus-visible:border-ring";

export function InvitationForm() {
  const [state, formAction, pending] = useActionState(createInvitation, initialState);

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invitation-email">Email address</Label>
          <Input
            id="invitation-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="person@example.com"
            className={controlClassName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invitation-role">Role</Label>
          <Select name="role" defaultValue="WORKER" items={[{ value: "WORKER", label: "Worker" }, { value: "CLIENT", label: "Client" }]}>
            <SelectTrigger id="invitation-role" className={controlClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WORKER">Worker</SelectItem>
              <SelectItem value="CLIENT">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {state.error ? (
          <p role="alert" className="text-sm text-destructive">{state.error}</p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating link…" : "Create invitation link"}
        </Button>
      </form>
      {state.invitationId ? (
        <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
          {state.message ? <p role="status" className="text-sm text-muted-foreground">{state.message}</p> : null}
          <p className="text-sm font-medium">Invitation link, expires in 7 days</p>
          <InvitationLinkActions key={state.invitationId} id={state.invitationId} recoverable />
          <p className="text-xs text-muted-foreground">
            Email delivery status: {state.emailDelivery?.status === "sent" ? "sent" : state.emailDelivery?.status === "preview" ? "not configured" : "failed"}. The link can be accepted once and only for the email entered above.
          </p>
        </div>
      ) : null}
    </div>
  );
}
