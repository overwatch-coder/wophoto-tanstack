"use client";

import { useState } from "react";
import {
  UserPlus,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  Briefcase,
  Shield,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PrototypeInvitation, InvitationRole } from "./types";

export function VersionD({
  invitations,
  onAddInvitation,
  onRevoke,
}: {
  invitations: PrototypeInvitation[];
  onAddInvitation: (inv: Omit<PrototypeInvitation, "id" | "invitedAt" | "expiresAt" | "token">) => void;
  onRevoke: (id: string) => void;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("WORKER");
  const [name, setName] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    onAddInvitation({
      email,
      role,
      status: "PENDING",
      recipientName: name || undefined,
    });
    setEmail("");
    setName("");
    setComposerOpen(false);
  };

  const handleCopy = (id: string, token: string) => {
    navigator.clipboard?.writeText(`${window.location.origin}/invite/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const pendingCount = invitations.filter((i) => i.status === "PENDING").length;
  const acceptedCount = invitations.filter((i) => i.status === "ACCEPTED").length;
  const expiredCount = invitations.filter((i) => i.status === "EXPIRED").length;

  const filtered = invitations.filter((inv) => {
    const matchesTab =
      activeTab === "ALL" ||
      inv.status === activeTab ||
      (activeTab === "WORKERS" && inv.role === "WORKER") ||
      (activeTab === "CLIENTS" && inv.role === "CLIENT");
    const matchesSearch =
      inv.email.toLowerCase().includes(search.toLowerCase()) ||
      (inv.recipientName && inv.recipientName.toLowerCase().includes(search.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header with Inline Toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Team Invitations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage onboarding tokens and invite links for team members and clients.
          </p>
        </div>
        <Button
          onClick={() => setComposerOpen(!composerOpen)}
          className="gap-2 rounded-full bg-primary px-5 font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          <UserPlus className="size-4" />
          <span>{composerOpen ? "Close Form" : "New Invitation"}</span>
          {composerOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </Button>
      </div>

      {/* Expandable Composer Card */}
      {composerOpen && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm transition-all sm:p-6 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <h3 className="font-semibold text-sm text-foreground">Create New Access Link</h3>
            <span className="text-xs text-muted-foreground">Valid for 7 calendar days</span>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="vd-email" className="text-xs">
                  Email Address
                </Label>
                <Input
                  id="vd-email"
                  type="email"
                  required
                  placeholder="collaborator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 rounded-lg text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vd-name" className="text-xs">
                  Full Name (Optional)
                </Label>
                <Input
                  id="vd-name"
                  placeholder="e.g. Sarah Jenkins"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 rounded-lg text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Role Assignment</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("WORKER")}
                    className={`rounded-lg border py-2 text-xs font-medium transition-all ${
                      role === "WORKER"
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Worker
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("CLIENT")}
                    className={`rounded-lg border py-2 text-xs font-medium transition-all ${
                      role === "CLIENT"
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Client
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setComposerOpen(false)}
                className="rounded-full text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full bg-primary font-medium text-primary-foreground text-xs px-5">
                Generate Link
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Interactive KPI Filter Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { id: "ALL", label: "All Dispatched", count: invitations.length },
          { id: "PENDING", label: "Pending Acceptance", count: pendingCount },
          { id: "ACCEPTED", label: "Activated", count: acceptedCount },
          { id: "EXPIRED", label: "Expired", count: expiredCount },
        ].map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setActiveTab(card.id)}
            className={`rounded-xl border p-4 text-left transition-all ${
              activeTab === card.id
                ? "border-primary bg-card ring-1 ring-primary shadow-xs"
                : "border-border bg-card/60 hover:bg-card hover:border-border/80"
            }`}
          >
            <span className="block text-xs font-medium text-muted-foreground">{card.label}</span>
            <span className="mt-1 block text-2xl font-bold tracking-tight text-foreground">
              {card.count}
            </span>
          </button>
        ))}
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-full pl-9 text-xs"
          />
        </div>

        {/* Tab Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "ALL", label: "All" },
            { id: "PENDING", label: "Pending" },
            { id: "ACCEPTED", label: "Accepted" },
            { id: "EXPIRED", label: "Expired" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clean Minimalist List */}
      <div className="rounded-2xl border bg-card shadow-xs divide-y divide-border/60 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No invitations found in this view.
          </div>
        ) : (
          filtered.map((inv) => {
            const isCopied = copiedId === inv.id;
            const isPending = inv.status === "PENDING";
            const isAccepted = inv.status === "ACCEPTED";
            const isExpired = inv.status === "EXPIRED";

            return (
              <div
                key={inv.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-muted/20"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full font-bold text-xs ${
                      inv.role === "WORKER"
                        ? "bg-primary/10 text-primary"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {inv.recipientName
                      ? inv.recipientName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                      : inv.role.charAt(0)}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {inv.recipientName || inv.email}
                      </p>
                      <Badge
                        variant="secondary"
                        className="rounded-full text-[10px] font-medium uppercase tracking-wider"
                      >
                        {inv.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{inv.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-6 self-start sm:self-auto text-xs text-muted-foreground">
                  <div>
                    {isPending && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                        <Clock className="size-3.5" />
                        <span>Expires {inv.expiresAt}</span>
                      </span>
                    )}
                    {isAccepted && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        <span>Accepted {inv.usedAt}</span>
                      </span>
                    )}
                    {isExpired && (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <XCircle className="size-3.5" />
                        <span>Expired {inv.expiresAt}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isPending && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(inv.id, inv.token)}
                        className="h-8 gap-1.5 rounded-full text-xs font-medium"
                      >
                        {isCopied ? (
                          <>
                            <Check className="size-3 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
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
                      className="size-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
