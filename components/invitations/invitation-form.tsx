"use client";

import { useActionState, useState } from "react";

import {
  createInvitation,
  type InvitationFormState,
} from "@/app/actions/invitations";
import { Button } from "@/components/ui/button";

const initialState: InvitationFormState = {};

export function InvitationForm() {
  const [state, formAction, pending] = useActionState(createInvitation, initialState);
  const [copied, setCopied] = useState(false);

  async function copyInvitation() {
    if (!state.invitePath) return;

    await navigator.clipboard.writeText(new URL(state.invitePath, window.location.origin).toString());
    setCopied(true);
  }

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <label className="block space-y-2 text-sm font-medium">
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="person@example.com"
            className="h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Role
          <select
            name="role"
            defaultValue="WORKER"
            className="h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="WORKER">Worker</option>
            <option value="CLIENT">Client</option>
          </select>
        </label>
        {state.error ? (
          <p role="alert" className="text-sm text-destructive">{state.error}</p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating link…" : "Create invitation link"}
        </Button>
      </form>
      {state.invitePath ? (
        <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
          <p className="text-sm font-medium">Invitation link, expires in 7 days</p>
          <code className="block break-all text-xs text-muted-foreground">
            {new URL(state.invitePath, typeof window === "undefined" ? "http://localhost" : window.location.origin).toString()}
          </code>
          <Button type="button" variant="outline" onClick={copyInvitation}>
            {copied ? "Copied" : "Copy link"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Share this link with the invited person. It can be accepted once and only for the email entered above.
          </p>
        </div>
      ) : null}
    </div>
  );
}
