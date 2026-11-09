
import { useState, useTransition } from "react";
import { UserPlus, Briefcase, Shield, Copy, Check, CheckCircle2, UsersRound } from "lucide-react";
import { StudioAccessLevel, StudioArea, UserRole } from "@/generated/prisma/browser";
import { createInvitation, type InvitationFormState } from "@/src/server/actions/invitations";
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
  const [role, setRole] = useState<UserRole>(UserRole.WORKER);
  const [permissions, setPermissions] = useState<Partial<Record<StudioArea, StudioAccessLevel>>>({});
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<InvitationFormState>({});
  const [copied, setCopied] = useState(false);

  const roleOptions = [
    {
      value: UserRole.WORKER,
      label: "Worker",
      detail: "Carries out assigned production work.",
      access: "Assigned tasks and daily work logs",
      icon: <Briefcase className="size-4" />,
    },
    {
      value: UserRole.CLIENT,
      label: "Client",
      detail: "Follows connected projects and shares feedback.",
      access: "Connected projects and feedback",
      icon: <UsersRound className="size-4" />,
    },
    {
      value: UserRole.SUPERVISOR,
      label: "Supervisor",
      detail: "",
      access: "Manage: Projects, Tasks, Schedule, Briefs, Reviews, Work Requests, Brand Assets, Inventory",
      note: "View: Dashboard · No Team, Copilot, Deleted Tasks, studio settings, or provider keys.",
      icon: <Shield className="size-4" />,
    },
    {
      value: UserRole.COLLABORATOR,
      label: "Collaborator",
      detail: "Receive only the area access you select.",
      access: "Choose access by area below",
      icon: <UsersRound className="size-4" />,
    },
  ];

  const resetForm = () => {
    setEmail("");
    setRole("WORKER");
    setPermissions({});
    setState({});
    setCopied(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const formData = new FormData();
    formData.append("email", email);
    formData.append("role", role);
    formData.append("permissions", JSON.stringify(Object.entries(permissions)
      .filter((entry): entry is [StudioArea, StudioAccessLevel] => Boolean(entry[1]))
      .map(([area, accessLevel]) => ({ area, accessLevel }))));

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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-y-contain sm:max-h-[calc(100dvh-3rem)] sm:max-w-xl">
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
            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground">Access Role</Label>
              <div className="overflow-hidden rounded-lg border border-border" role="radiogroup" aria-label="Access role">
                <div className="hidden grid-cols-[1.25rem_minmax(9rem,0.8fr)_minmax(0,1.2fr)] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
                  <span aria-hidden="true" />
                  <span>Role</span>
                  <span>Default access</span>
                </div>
                {roleOptions.map((item, index) => (
                  <label
                    key={item.value}
                    className={`group grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 px-3 py-3 transition-colors hover:bg-muted/40 has-[:checked]:bg-primary/5 sm:grid-cols-[1.25rem_minmax(9rem,0.8fr)_minmax(0,1.2fr)] sm:items-center sm:gap-3 sm:px-4 ${index ? "border-t border-border" : ""}`}
                  >
                    <input
                      type="radio"
                      name="invitation-role"
                      value={item.value}
                      checked={role === item.value}
                      onChange={() => { setRole(item.value); setPermissions({}); }}
                      className="peer sr-only"
                    />
                    <span className="grid size-4 place-items-center rounded-full border border-muted-foreground/50 text-transparent transition-colors group-has-[:checked]:border-primary group-has-[:checked]:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
                      <span className="size-2 rounded-full bg-current" />
                    </span>
                    <span className="flex min-w-0 items-start gap-2.5 sm:items-center">
                      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">{item.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                        {item.detail ? <span className="block text-xs text-muted-foreground sm:hidden">{item.detail}</span> : null}
                      </span>
                    </span>
                    <span className="col-start-2 min-w-0 pl-11 sm:col-start-3 sm:pl-0">
                      <span className="block text-xs font-medium text-foreground">{item.access}</span>
                      {item.note ? <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.note}</span> : null}
                      {item.detail ? <span className="hidden text-xs text-muted-foreground sm:block">{item.detail}</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {role === UserRole.COLLABORATOR ? (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-3">
                <div><p className="text-sm font-medium">Area access</p><p className="text-xs text-muted-foreground">No access is selected by default.</p></div>
                {[
                  [StudioArea.DASHBOARD, "Dashboard"], [StudioArea.PROJECTS, "Projects"], [StudioArea.TASKS, "Tasks"],
                  [StudioArea.SCHEDULE, "Schedule"], [StudioArea.BRIEFS, "Briefs"], [StudioArea.REVIEWS, "Reviews"],
                  [StudioArea.WORK_REQUESTS, "Work requests"], [StudioArea.BRAND_ASSETS, "Brand assets"], [StudioArea.INVENTORY, "Inventory"],
                  [StudioArea.DELETED_TASKS, "Deleted tasks"], [StudioArea.TEAM, "Team"], [StudioArea.COPILOT, "Copilot"],
                ].map(([area, label]) => (
                  <label key={area} className="grid grid-cols-[1fr_9rem] items-center gap-3 border-t py-2 text-xs">
                    <span>{label}</span>
                    <select aria-label={`${label} access`} className="h-9 rounded-lg border bg-background px-2 text-sm"
                      value={permissions[area as StudioArea] ?? "NONE"}
                      onChange={(event) => setPermissions((current) => ({ ...current, [area as StudioArea]: event.target.value === "NONE" ? undefined : event.target.value as StudioAccessLevel }))}>
                      <option value="NONE">No access</option><option value={StudioAccessLevel.VIEW}>View</option><option value={StudioAccessLevel.MANAGE}>Manage</option>
                    </select>
                  </label>
                ))}
              </div>
            ) : null}

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
