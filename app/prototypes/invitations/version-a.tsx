"use client";

import { useState } from "react";
import {
  UserPlus,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Search,
  Filter,
  Shield,
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Mail,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrototypeInvitation, InvitationRole, InvitationStatus } from "./types";

export function VersionA({
  invitations,
  onAddInvitation,
  onRevoke,
}: {
  invitations: PrototypeInvitation[];
  onAddInvitation: (inv: Omit<PrototypeInvitation, "id" | "invitedAt" | "expiresAt" | "token">) => void;
  onRevoke: (id: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Invite Form State
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("WORKER");
  const [recipientName, setRecipientName] = useState("");
  const [projectOrRole, setProjectOrRole] = useState("");

  const handleCopy = (id: string, token: string) => {
    navigator.clipboard?.writeText(`${window.location.origin}/invite/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    onAddInvitation({
      email,
      role,
      status: "PENDING",
      recipientName: recipientName || undefined,
      clientProject: role === "CLIENT" ? projectOrRole : undefined,
      specialization: role === "WORKER" && projectOrRole ? [projectOrRole] : undefined,
    });
    setEmail("");
    setRecipientName("");
    setProjectOrRole("");
    setModalOpen(false);
  };

  const filtered = invitations.filter((item) => {
    const matchesSearch =
      item.email.toLowerCase().includes(search.toLowerCase()) ||
      (item.recipientName && item.recipientName.toLowerCase().includes(search.toLowerCase())) ||
      (item.clientProject && item.clientProject.toLowerCase().includes(search.toLowerCase()));
    const matchesRole =
      filterRole === "ALL" ||
      item.role === filterRole ||
      (filterRole === "PENDING" && item.status === "PENDING");
    return matchesSearch && matchesRole;
  });

  const pendingCount = invitations.filter((i) => i.status === "PENDING").length;
  const acceptedCount = invitations.filter((i) => i.status === "ACCEPTED").length;
  const expiredCount = invitations.filter((i) => i.status === "EXPIRED").length;

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Team & Client Roster Invitations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate one-time invite tokens for studio photographers, editors, and clients.
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="gap-2 rounded-full bg-primary px-5 font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          <UserPlus className="size-4" />
          <span>Invite Member</span>
        </Button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Total Dispatched</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">{invitations.length}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-xs">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Pending Acceptance</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-300">
            {pendingCount}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-xs">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Accepted</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
            {acceptedCount}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Expired</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-muted-foreground">
            {expiredCount}
          </p>
        </div>
      </div>

      {/* Search and Filter Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search email, name or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-full pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "ALL", label: "All" },
            { id: "PENDING", label: `Pending (${pendingCount})` },
            { id: "WORKER", label: "Workers" },
            { id: "CLIENT", label: "Clients" },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setFilterRole(pill.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                filterRole === pill.id
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Modern High-Density Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 sm:px-6">Invitee</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Scope / Project</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3 text-right sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No invitations found matching your search.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => {
                  const isCopied = copiedId === inv.id;
                  const isPending = inv.status === "PENDING";
                  const isAccepted = inv.status === "ACCEPTED";
                  const isExpired = inv.status === "EXPIRED";

                  return (
                    <tr key={inv.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3.5 sm:px-6">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {inv.recipientName || inv.email.split("@")[0]}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{inv.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant="secondary"
                          className={`rounded-full border font-medium capitalize text-xs ${
                            inv.role === "WORKER"
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {inv.role === "WORKER" ? (
                            <Briefcase className="mr-1 size-3 inline" />
                          ) : (
                            <Shield className="mr-1 size-3 inline" />
                          )}
                          {inv.role.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pending
                          </span>
                        )}
                        {isAccepted && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="size-3 text-emerald-600" />
                            Accepted
                          </span>
                        )}
                        {isExpired && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            <XCircle className="size-3" />
                            Expired
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {inv.clientProject ? (
                          <span className="font-medium text-foreground">{inv.clientProject}</span>
                        ) : inv.specialization && inv.specialization.length > 0 ? (
                          inv.specialization.join(", ")
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {isAccepted ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Accepted on {inv.usedAt}
                          </span>
                        ) : (
                          <span>Due {inv.expiresAt}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right sm:px-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopy(inv.id, inv.token)}
                              className="h-8 gap-1.5 rounded-full text-xs"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="size-3 text-emerald-600" />
                                  <span className="text-emerald-600 font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onRevoke(inv.id)}
                            title="Revoke / Delete"
                            className="size-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog for Invitation */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="size-5 text-primary" />
              <span>Send Team Invitation</span>
            </DialogTitle>
            <DialogDescription>
              Create a secured 7-day single-use link for onboarding.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Role Selection Tabs */}
            <div className="space-y-2">
              <Label>Select Role</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("WORKER")}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                    role === "WORKER"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium text-foreground text-sm">
                    <Briefcase className="size-4 text-primary" />
                    <span>Worker</span>
                  </div>
                  <span className="mt-1 text-xs text-muted-foreground">
                    Photographer, retoucher, drone pilot with task logging.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("CLIENT")}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                    role === "CLIENT"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium text-foreground text-sm">
                    <Shield className="size-4 text-primary" />
                    <span>Client</span>
                  </div>
                  <span className="mt-1 text-xs text-muted-foreground">
                    Reviews project deliverables, comments, feedback.
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Recipient Name (Optional)</Label>
              <Input
                id="inv-name"
                placeholder="e.g. Elena Rostova"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="h-10 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email Address</Label>
              <Input
                id="inv-email"
                type="email"
                required
                placeholder="collaborator@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-project">
                {role === "CLIENT" ? "Assigned Project (Optional)" : "Primary Skill (Optional)"}
              </Label>
              <Input
                id="inv-project"
                placeholder={role === "CLIENT" ? "e.g. Vogue Autumn Lookbook" : "e.g. Colorist / Lighting"}
                value={projectOrRole}
                onChange={(e) => setProjectOrRole(e.target.value)}
                className="h-10 rounded-lg"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full bg-primary font-medium text-primary-foreground">
                Generate Invitation Link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
