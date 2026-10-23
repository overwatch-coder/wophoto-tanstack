"use client";

import { useState, useTransition } from "react";
import { Check, Copy, RefreshCw, Trash2 } from "lucide-react";
import { getInvitationLink, replaceInvitationLink, revokeInvitation } from "@/app/actions/invitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
          setTimeout(() => setCopied(false), 2500);
        } catch {
          setManualLink(link);
        }
      } catch {
        setError("The invitation link could not be loaded. Try again.");
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {recoverable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => copyLink()}
            className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3" aria-hidden="true" />
                <span>{pending ? "Loading…" : "Copy link"}</span>
              </>
            )}
          </Button>
        ) : null}
        {!recoverable || error ? (
          <AlertDialog open={replaceOpen} onOpenChange={setReplaceOpen}>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium"
                />
              }
            >
              <RefreshCw className="size-3" aria-hidden="true" />
              <span>Replace link</span>
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
                <AlertDialogCancel disabled={pending} className="rounded-full">Cancel</AlertDialogCancel>
                <Button
                  disabled={pending}
                  onClick={() => copyLink(true)}
                  className="rounded-full bg-primary font-medium text-primary-foreground"
                >
                  {pending ? "Replacing…" : "Replace and copy"}
                </Button>
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
          <Input aria-label="Invitation link" readOnly value={manualLink} onFocus={(event) => event.currentTarget.select()} className="h-8 text-xs font-mono" />
        </div>
      ) : null}
    </div>
  );
}

export function RevokeInvitationButton({ id, email }: { id: string; email: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();

  const handleRevoke = () => {
    setError(undefined);
    startTransition(async () => {
      const res = await revokeInvitation(id);
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            title="Revoke invitation"
            className="size-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Revoke invitation for {email}</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
          <AlertDialogDescription>
            The invitation link for <strong className="text-foreground">{email}</strong> will be invalidated immediately. They will not be able to use it to join WoPhoto.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="rounded-full">Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={handleRevoke}
            className="rounded-full"
          >
            {pending ? "Revoking…" : "Revoke Invitation"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
