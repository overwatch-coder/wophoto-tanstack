"use client";

import { useState, useTransition } from "react";
import { UserPlus, Briefcase, Shield, Copy, Check, CheckCircle2 } from "lucide-react";
import { createInvitation, type InvitationFormState } from "@/app/actions/invitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateInvitationDialog() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"WORKER" | "CLIENT">("WORKER");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<InvitationFormState>({});
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setEmail("");
    setRole("WORKER");
    setState({});
    setCopied(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const formData = new FormData();
    formData.append("email", email);
    formData.append("role", role);

    startTransition(async () => {
      const result = await createInvitation({}, formData);
      setState(result);
    });
  };

  const handleCopyLink = async () => {
    if (!state.invitePath) return;
    const fullUrl = new URL(state.invitePath, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogTrigger
        render={
          <Button className="gap-2 rounded-full bg-primary px-5 font-medium text-primary-foreground shadow-xs hover:bg-primary/90">
            <UserPlus className="size-4" />
            <span>Invite Member</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="size-5 text-primary" />
            <span>Invite Team Member or Client</span>
          </DialogTitle>
          <DialogDescription>
            Send a single-use 7-day invitation by email. You can also copy the link as a fallback.
          </DialogDescription>
        </DialogHeader>

        {state.invitePath ? (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                <span>{state.emailDelivery?.status === "sent" ? "Invitation Email Sent" : "Invitation Link Ready"}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {state.message} {state.emailDelivery?.status === "sent" ? "You can also copy the link:" : "Copy and share this one-time link:"} <strong className="text-foreground">{email}</strong>
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground">
                  {typeof window !== "undefined" ? window.location.origin : ""}{state.invitePath}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="h-9 shrink-0 gap-1.5 rounded-full px-3 text-xs font-medium"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={resetForm}
                className="rounded-full text-xs"
              >
                Invite Another
              </Button>
              <Button
                onClick={() => setOpen(false)}
                className="rounded-full bg-primary font-medium text-primary-foreground text-xs px-5"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Role Selection Cards */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground">Access Role</Label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRole("WORKER")}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                    role === "WORKER"
                      ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Briefcase className="size-4 text-primary" />
                    <span>Worker</span>
                  </div>
                  <span className="mt-1 text-xs text-muted-foreground">
                    Photographers, retouchers, daily task logging & daybook.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("CLIENT")}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                    role === "CLIENT"
                      ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Shield className="size-4 text-primary" />
                    <span>Client</span>
                  </div>
                  <span className="mt-1 text-xs text-muted-foreground">
                    Client reviews photo sets, deliverables & feedback.
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-invite-email" className="text-xs font-medium text-foreground">
                Email Address
              </Label>
              <Input
                id="create-invite-email"
                type="email"
                required
                autoComplete="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 rounded-lg text-sm"
              />
            </div>

            {state.error ? (
              <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
                {state.error}
              </p>
            ) : null}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending}
                className="rounded-full bg-primary font-medium text-primary-foreground"
              >
                {pending ? "Creating link…" : "Generate Invitation Link"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
