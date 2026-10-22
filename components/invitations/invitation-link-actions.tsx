"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { getInvitationLink, replaceInvitationLink } from "@/app/actions/invitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function InvitationLinkActions({ id, recoverable }: { id: string; recoverable: boolean }) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [manualLink, setManualLink] = useState<string>();
  const [replaceOpen, setReplaceOpen] = useState(false);

  function copyLink(replace = false) {
    setCopied(false);
    setError(undefined);
    setManualLink(undefined);
    startTransition(async () => {
      try {
        const result = await (replace ? replaceInvitationLink(id) : getInvitationLink(id));
        if (!result.invitePath) {
          setError(result.error ?? "The invitation link could not be loaded.");
          return;
        }
        setReplaceOpen(false);
        const link = new URL(result.invitePath, window.location.origin).toString();
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
        } catch {
          setManualLink(link);
        }
      } catch {
        setError("The invitation link could not be loaded. Try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {recoverable ? (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => copyLink()}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {pending ? "Loading…" : copied ? "Copied" : "Copy link"}
          </Button>
        ) : null}
        {!recoverable || error ? (
          <AlertDialog open={replaceOpen} onOpenChange={setReplaceOpen}>
            <AlertDialogTrigger render={<Button type="button" variant="outline" size="sm" disabled={pending} />}>
              Replace link
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Replace this invitation link?</AlertDialogTitle>
                <AlertDialogDescription>
                  The previous link will stop working. Share the new link with the invited person. The role and expiration date will stay the same.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                <Button disabled={pending} onClick={() => copyLink(true)}>{pending ? "Replacing…" : "Replace and copy"}</Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
      {copied ? <p role="status" className="sr-only">Invitation link copied.</p> : null}
      {error && !replaceOpen ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      {manualLink ? (
        <div className="space-y-1">
          <p role="status" className="text-xs text-muted-foreground">Clipboard unavailable. Select and copy the link below.</p>
          <Input aria-label="Invitation link" readOnly value={manualLink} onFocus={(event) => event.currentTarget.select()} />
        </div>
      ) : null}
    </div>
  );
}
