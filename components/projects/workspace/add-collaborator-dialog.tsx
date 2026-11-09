import { useState, useTransition } from "react"
import { useRouter } from "@tanstack/react-router"
import { UserPlus, Trash2, Mail, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getProfileImageSrc } from "@/lib/profile-image"
import type { ProjectCollaboratorItem } from "@/lib/projects"
import { addProjectCollaborator, removeProjectCollaborator } from "@/src/server/actions/projects";

interface AddCollaboratorDialogProps {
  projectId: string
  projectName: string
  primaryClient: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  collaborators: ProjectCollaboratorItem[]
  canManage: boolean
  trigger?: React.ReactElement
}

export function AddCollaboratorDialog({
  projectId,
  projectName,
  primaryClient,
  collaborators,
  canManage,
  trigger,
}: AddCollaboratorDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleAddCollaborator(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email.trim()) {
      setError("Please enter a valid email address.")
      return
    }

    startTransition(async () => {
      try {
        const res = (await addProjectCollaborator(projectId, email.trim())) as { error?: string; success?: string } | undefined

        if (res?.error) {
          setError(res.error)
        } else {
          setSuccess(res?.success || "Collaborator added.")
          setEmail("")
          await router.invalidate()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add collaborator.")
      }
    })
  }

  async function handleRemoveCollaborator(collaboratorId: string) {
    if (!confirm("Are you sure you want to remove this collaborator?")) return

    startTransition(async () => {
      try {
        const res = (await removeProjectCollaborator(projectId, collaboratorId)) as { error?: string; success?: string } | undefined

        if (res?.error) {
          setError(res.error)
        } else {
          setSuccess("Collaborator removed.")
          await router.invalidate()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove collaborator.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger || (
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <UserPlus className="size-3.5" />
              Invite Client / Collaborator
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Project Members & Collaborators</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Collaborators can view tasks, write comments, and preview or download deliverables for{" "}
            <span className="font-medium text-foreground">{projectName}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Add collaborator form */}
        <form onSubmit={handleAddCollaborator} className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="collaborator-email" className="text-xs font-medium">
              Invite Client by Email
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="collaborator-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. ama@example.com"
                  className="pl-8 text-xs"
                  disabled={isPending}
                />
              </div>
              <Button type="submit" size="sm" disabled={isPending || !email.trim()} className="text-xs">
                {isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="size-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}
        </form>

        {/* Existing Members list */}
        <div className="mt-4 space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Current Members
          </Label>

          <div className="max-h-60 space-y-2 overflow-y-auto divide-y divide-border rounded-lg border border-border p-2">
            {/* Primary Client */}
            <div className="flex items-center justify-between gap-3 pt-1 first:pt-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="size-7 shrink-0">
                  <AvatarImage
                    src={getProfileImageSrc(primaryClient.image, primaryClient.id) || undefined}
                    alt={primaryClient.name || "Primary client"}
                  />
                  <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                    {primaryClient.name?.charAt(0).toUpperCase() || "C"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">
                    {primaryClient.name || "Primary Client"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{primaryClient.email}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Owner
              </span>
            </div>

            {/* Collaborators */}
            {collaborators.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="size-7 shrink-0">
                    <AvatarImage
                      src={getProfileImageSrc(c.user.image, c.user.id) || undefined}
                      alt={c.user.name || "Collaborator"}
                    />
                    <AvatarFallback className="text-[10px] font-semibold bg-muted text-muted-foreground">
                      {c.user.name?.charAt(0).toUpperCase() || "C"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">
                      {c.user.name || "Collaborator"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{c.user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Collaborator
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCollaborator(c.id)}
                      disabled={isPending}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Remove collaborator"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
