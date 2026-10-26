"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, RefreshCw, Trash2 } from "lucide-react"
import {
  getInvitationLink,
  replaceInvitationLink,
  revokeInvitation,
  revokeStudioInvitationAccess,
} from "@/app/actions/invitations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableRowActions } from "@/components/ui/table-row-actions"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function InvitationLinkActions({
  id,
  recoverable,
}: {
  id: string
  recoverable: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string>()
  const [manualLink, setManualLink] = useState<string>()
  const [replaceOpen, setReplaceOpen] = useState(false)

  function copyLink(replace = false) {
    setCopied(false)
    setError(undefined)
    setManualLink(undefined)
    startTransition(async () => {
      try {
        const result = await (replace
          ? replaceInvitationLink(id)
          : getInvitationLink(id))
        if (!result.invitePath) {
          setError(result.error ?? "The invitation link could not be loaded.")
          return
        }
        setReplaceOpen(false)
        const link = new URL(
          result.invitePath,
          window.location.origin
        ).toString()
        try {
          await navigator.clipboard.writeText(link)
          setCopied(true)
          setTimeout(() => setCopied(false), 2500)
        } catch {
          setManualLink(link)
        }
      } catch {
        setError("The invitation link could not be loaded. Try again.")
      }
    })
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
                <Check
                  className="size-3 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <span className="text-emerald-600 dark:text-emerald-400">
                  Copied
                </span>
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
                <AlertDialogTitle>
                  Replace this invitation link?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  The previous link will stop working. Share the new link with
                  the invited person. The role and expiration date will stay the
                  same.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending} className="rounded-full">
                  Cancel
                </AlertDialogCancel>
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
      {copied ? (
        <p role="status" className="sr-only">
          Invitation link copied.
        </p>
      ) : null}
      {error && !replaceOpen ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {manualLink ? (
        <div className="space-y-1">
          <p role="status" className="text-xs text-muted-foreground">
            Clipboard unavailable. Select and copy the link below.
          </p>
          <Input
            aria-label="Invitation link"
            readOnly
            value={manualLink}
            onFocus={(event) => event.currentTarget.select()}
            className="h-8 font-mono text-xs"
          />
        </div>
      ) : null}
    </div>
  )
}

export function RevokeInvitationButton({
  id,
  email,
}: {
  id: string
  email: string
}) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string>()

  const handleRevoke = () => {
    setError(undefined)
    startTransition(async () => {
      const res = await revokeInvitation(id)
      if (res.error) {
        setError(res.error)
      } else {
        setOpen(false)
      }
    })
      }

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
            The invitation link for{" "}
            <strong className="text-foreground">{email}</strong> will be
            invalidated immediately. They will not be able to use it to join
            WoPhoto.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="rounded-full">
            Cancel
          </AlertDialogCancel>
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
  )
}

export function InvitationTableActions({
  id,
  email,
  recoverable,
  canManageLink,
  canRevoke,
}: {
  id: string
  email: string
  recoverable: boolean
  canManageLink: boolean
  canRevoke: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)
  const [manualLink, setManualLink] = useState<string>()
  const [manualLinkOpen, setManualLinkOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)

  const loadInvitationLink = (replace = false) => {
    setError(undefined)
    setCopied(false)
    setManualLink(undefined)
    startTransition(async () => {
      try {
        const result = await (replace
          ? replaceInvitationLink(id)
          : getInvitationLink(id))
        if (!result.invitePath) {
          setError(result.error ?? "The invitation link could not be loaded.")
          return
        }
        const link = new URL(
          result.invitePath,
          window.location.origin
        ).toString()
        try {
          await navigator.clipboard.writeText(link)
          setCopied(true)
          setTimeout(() => setCopied(false), 2500)
        } catch {
          setManualLink(link)
          setManualLinkOpen(true)
        }
        setReplaceOpen(false)
      } catch {
        setError("The invitation link could not be loaded. Try again.")
      }
    })
  }

  const revoke = () => {
    setError(undefined)
    startTransition(async () => {
      const result = await revokeInvitation(id)
      if (result.error) setError(result.error)
      else setRevokeOpen(false)
    })
  }

  return (
    <>
      <TableRowActions label={`Actions for invitation to ${email}`}>
        {canManageLink && recoverable ? (
          <DropdownMenuItem
            disabled={pending}
            onClick={() => loadInvitationLink()}
          >
            {copied ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy invitation link"}
          </DropdownMenuItem>
        ) : null}
        {canManageLink ? (
          <DropdownMenuItem
            disabled={pending}
            onClick={() => setReplaceOpen(true)}
          >
            <RefreshCw aria-hidden="true" />
            {recoverable ? "Replace link" : "Create invitation link"}
          </DropdownMenuItem>
        ) : null}
        {canRevoke ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onClick={() => setRevokeOpen(true)}
            >
              <Trash2 aria-hidden="true" />
              Revoke invitation
            </DropdownMenuItem>
          </>
        ) : null}
      </TableRowActions>

      {error ? (
        <p
          role="alert"
          className="mt-1 max-w-48 text-left text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}

      <AlertDialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {recoverable
                ? "Replace this invitation link?"
                : "Create an invitation link?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {recoverable
                ? "The previous link will stop working. The role and expiration date will stay the same."
                : "A new link will be created for this invitation so you can copy and share it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button disabled={pending} onClick={() => loadInvitationLink(true)}>
              {pending
                ? "Working…"
                : recoverable
                  ? "Replace link"
                  : "Create link"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              The invitation link for{" "}
              <strong className="text-foreground">{email}</strong> will be
              invalidated immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={pending} onClick={revoke}>
              {pending ? "Revoking…" : "Revoke invitation"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={manualLinkOpen} onOpenChange={setManualLinkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copy invitation link</AlertDialogTitle>
            <AlertDialogDescription>
              Clipboard access is unavailable. Select and copy the link below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            aria-label="Invitation link"
            readOnly
            value={manualLink ?? ""}
            onFocus={(event) => event.currentTarget.select()}
            className="font-mono text-xs"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function RevokeStudioAccountButton({ id, role, name }: { id: string; role: string; name: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string>()

  function revoke() {
    setError(undefined)
    startTransition(async () => {
      try {
        const result = await revokeStudioInvitationAccess(id)
        if (result.error) {
          setError(result.error)
          return
        }
        setOpen(false)
        router.refresh()
      } catch {
        setError("Access could not be revoked. Try again.")
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-destructive hover:text-destructive">Revoke</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke {role} access?</AlertDialogTitle>
          <AlertDialogDescription>
            {name} will be signed out and will no longer be able to access this studio. Their account and existing work history will be retained. Access cannot currently be restored or re-invited from the app.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pending} onClick={revoke}>{pending ? "Revoking…" : "Revoke access"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
