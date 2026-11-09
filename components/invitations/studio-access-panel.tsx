import { useState, useTransition } from "react";
import { Shield, Settings2, UserRound, X } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { StudioAccessLevel, StudioArea, UserRole } from "@/generated/prisma/browser";
import { updateStudioMemberAccess, revokeStudioMember } from "@/app/actions/studio-access";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const AREA_OPTIONS: Array<{ area: StudioArea; label: string }> = [
  { area: StudioArea.DASHBOARD, label: "Dashboard" },
  { area: StudioArea.PROJECTS, label: "Projects" },
  { area: StudioArea.TASKS, label: "Tasks" },
  { area: StudioArea.SCHEDULE, label: "Schedule" },
  { area: StudioArea.BRIEFS, label: "Briefs" },
  { area: StudioArea.REVIEWS, label: "Reviews" },
  { area: StudioArea.WORK_REQUESTS, label: "Work requests" },
  { area: StudioArea.BRAND_ASSETS, label: "Brand assets" },
  { area: StudioArea.INVENTORY, label: "Inventory" },
  { area: StudioArea.DELETED_TASKS, label: "Deleted tasks" },
  { area: StudioArea.TEAM, label: "Team" },
  { area: StudioArea.COPILOT, label: "Copilot" },
];

export type StudioAccessMember = {
  id: string;
  role: UserRole;
  name: string | null;
  email: string;
  permissions: Array<{ area: StudioArea; accessLevel: StudioAccessLevel }>;
};

export function StudioAccessPanel({ members }: { members: StudioAccessMember[] }) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Shield className="size-5" /></div>
        <div>
          <h2 className="text-lg font-semibold">Studio access</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage Supervisor and Collaborator access. Owner controls and AI provider keys stay private to you.</p>
        </div>
      </div>
      {members.length === 0 ? (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No additional studio members yet.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {members.map((member) => <MemberRow key={member.id} member={member} />)}
        </ul>
      )}
    </section>
  );
}

function MemberRow({ member }: { member: StudioAccessMember }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [role, setRole] = useState(member.role);
  const [grants, setGrants] = useState(() => Object.fromEntries(member.permissions.map(({ area, accessLevel }) => [area, accessLevel])) as Partial<Record<StudioArea, StudioAccessLevel>>);
  const [message, setMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        const permissions = Object.entries(grants)
          .filter((entry): entry is [StudioArea, StudioAccessLevel] => Boolean(entry[1]))
          .map(([area, accessLevel]) => ({ area, accessLevel }));
        const result = await updateStudioMemberAccess({ memberId: member.id, role, permissions });
        if (result.error) {
          setMessage(result.error);
          return;
        }
        setMessage("");
        setToastMessage("Studio access saved.");
        window.setTimeout(() => setToastMessage(""), 3200);
        router.invalidate();
      } catch {
        setMessage("Access could not be saved. Try again.");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        const result = await revokeStudioMember({ memberId: member.id });
        setMessage(result.error ?? "");
        if (result.success) {
          setOpen(false);
          setRemoveOpen(false);
          setToastMessage("Member access revoked.");
          window.setTimeout(() => setToastMessage(""), 3200);
          router.invalidate();
        }
      } catch {
        setMessage("Member access could not be revoked. Try again.");
      }
    });
  }

  return (
    <li className="relative flex items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><UserRound className="size-5" /></span>
        <div className="min-w-0">
          <p className="truncate font-medium">{member.name || member.email}</p>
          <p className="truncate text-sm text-muted-foreground">{member.email} · {member.role === UserRole.SUPERVISOR ? "Supervisor" : "Collaborator"}</p>
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" size="sm" className="shrink-0 gap-2"><Settings2 className="size-4" /><span className="hidden sm:inline">Manage access</span><span className="sm:hidden">Manage</span></Button>} />
        <SheetContent side="right" className="w-[min(92vw,30rem)] max-w-none gap-0 overflow-hidden p-0">
          <SheetHeader className="border-b px-5 py-5 pr-14">
            <SheetTitle>{member.name || "Studio member"}</SheetTitle>
            <SheetDescription>{member.email}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Studio role</label>
              <Select value={role} onValueChange={(value) => {
                if (value === UserRole.SUPERVISOR || value === UserRole.COLLABORATOR) {
                  setRole(value);
                  if (value === UserRole.SUPERVISOR) setGrants({});
                }
              }}>
                <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.SUPERVISOR}>Supervisor</SelectItem>
                  <SelectItem value={UserRole.COLLABORATOR}>Collaborator</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Changing roles clears previous custom grants.</p>
            </div>
            {role === UserRole.SUPERVISOR ? (
              <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                Supervisors have a fixed preset for day to day studio work. Team access, Copilot, deleted tasks, settings, and provider keys remain unavailable.
              </div>
            ) : (
              <div className="space-y-3">
                <div><h3 className="font-medium">Area access</h3><p className="mt-1 text-xs text-muted-foreground">No selection means no access. Manage includes view access.</p></div>
                {AREA_OPTIONS.map(({ area, label }) => (
                  <div key={area} className="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-3 rounded-lg border p-3">
                    <span className="text-sm">{label}</span>
                    <Select value={grants[area] ?? "NONE"} onValueChange={(value) => setGrants((current) => ({ ...current, [area]: value === "NONE" ? undefined : value as StudioAccessLevel }))}>
                      <SelectTrigger aria-label={`${label} access`} className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">No access</SelectItem>
                        <SelectItem value={StudioAccessLevel.VIEW}>View</SelectItem>
                        <SelectItem value={StudioAccessLevel.MANAGE}>Manage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
            {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
          </div>
          <div className="flex items-center justify-between border-t p-4">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setRemoveOpen(true)} className="gap-2 text-destructive hover:text-destructive"><X className="size-4" />Remove member</Button>
            <Button type="button" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save access"}</Button>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke studio access?</AlertDialogTitle>
            <AlertDialogDescription>
              {member.name || member.email} will be signed out and lose access. Their account and work history will remain. Access cannot currently be restored or re-invited from the app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={pending} onClick={remove}>{pending ? "Revoking…" : "Revoke access"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {toastMessage ? <div role="status" aria-live="polite" className="fixed right-4 bottom-4 z-[100] rounded-lg border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-lg">{toastMessage}</div> : null}
    </li>
  );
}
