"use client";

import { useState } from "react";
import {
  Send,
  Copy,
  Check,
  Shield,
  Briefcase,
  Clock,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Link as LinkIcon,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PrototypeInvitation, InvitationRole } from "./types";

export function VersionB({
  invitations,
  onAddInvitation,
  onRevoke,
}: {
  invitations: PrototypeInvitation[];
  onAddInvitation: (inv: Omit<PrototypeInvitation, "id" | "invitedAt" | "expiresAt" | "token">) => void;
  onRevoke: (id: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("WORKER");
  const [recipientName, setRecipientName] = useState("");
  const [latestGenerated, setLatestGenerated] = useState<{ id: string; token: string; email: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "ACCEPTED">("ALL");
  const [search, setSearch] = useState("");

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const dummyToken = `wophoto_inv_${Math.random().toString(36).substring(2, 9)}`;
    onAddInvitation({
      email,
      role,
      status: "PENDING",
      recipientName: recipientName || undefined,
    });
    setLatestGenerated({
      id: `temp-${Date.now()}`,
      token: dummyToken,
      email,
    });
    setEmail("");
    setRecipientName("");
  };

  const handleCopy = (id: string, token: string) => {
    navigator.clipboard?.writeText(`${window.location.origin}/invite/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = invitations.filter((inv) => {
    const matchesFilter =
      filter === "ALL" ||
      (filter === "PENDING" && inv.status === "PENDING") ||
      (filter === "ACCEPTED" && inv.status === "ACCEPTED");
    const matchesSearch =
      inv.email.toLowerCase().includes(search.toLowerCase()) ||
      (inv.recipientName && inv.recipientName.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Team Onboarding & Link Dispatcher
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Issue role-scoped access links on the left and track team acceptance live on the right.
        </p>
      </div>

      {/* 2-Column Split View */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Sticky Composer */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6 sticky top-20">
            <div className="flex items-center gap-2 border-b pb-4">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Send className="size-4" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-foreground">Create Invitation</h3>
                <p className="text-xs text-muted-foreground">Invite will remain valid for 7 days</p>
              </div>
            </div>

            <form onSubmit={handleGenerate} className="mt-5 space-y-4">
              {/* Role Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Access Level
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("WORKER")}
                    className={`flex items-center justify-center gap-2 rounded-full py-2 px-3 text-xs font-medium transition-all ${
                      role === "WORKER"
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Briefcase className="size-3.5" />
                    <span>Worker</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("CLIENT")}
                    className={`flex items-center justify-center gap-2 rounded-full py-2 px-3 text-xs font-medium transition-all ${
                      role === "CLIENT"
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Shield className="size-3.5" />
                    <span>Client</span>
                  </button>
                </div>
              </div>

              {/* Scope Explain Callout */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                {role === "WORKER" ? (
                  <p>
                    <strong className="font-semibold text-foreground">Worker Scope:</strong> Granted access to log tasks, update task daybook, manage shooting assignments, and submit daily work entries.
                  </p>
                ) : (
                  <p>
                    <strong className="font-semibold text-foreground">Client Scope:</strong> Granted read-only review access to their photography project galleries, task approvals, and feedback tickets.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp-email" className="text-xs">
                  Email Address
                </Label>
                <Input
                  id="sp-email"
                  type="email"
                  required
                  placeholder="name@studio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 rounded-lg text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp-name" className="text-xs">
                  Recipient Name <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="sp-name"
                  placeholder="e.g. Marcus Vance"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="h-10 rounded-lg text-sm"
                />
              </div>

              <Button
                type="submit"
                className="w-full gap-2 rounded-full bg-primary font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
              >
                <LinkIcon className="size-4" />
                <span>Create One-Time Link</span>
              </Button>
            </form>

            {/* Generated Link Alert Card */}
            {latestGenerated && (
              <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  <span>Link Ready for {latestGenerated.email}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md bg-background px-2.5 py-1.5 text-[11px] font-mono text-foreground border border-border">
                    {typeof window !== "undefined" ? window.location.origin : ""}/invite/{latestGenerated.token}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(latestGenerated.id, latestGenerated.token)}
                    className="h-8 shrink-0 rounded-full text-xs font-medium"
                  >
                    {copiedId === latestGenerated.id ? (
                      <Check className="size-3 text-emerald-600" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span>{copiedId === latestGenerated.id ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  The recipient must open this link before signing in with Google.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Invitation History */}
        <div className="lg:col-span-7 space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search dispatched invites..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-full pl-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {(["ALL", "PENDING", "ACCEPTED"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    filter === tab
                      ? "bg-foreground text-background font-semibold"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Stream */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
                No invitations matching the filter criteria.
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
                    className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-all hover:border-primary/30 shadow-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
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
                      </span>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground text-sm">
                            {inv.recipientName || inv.email}
                          </p>
                          <Badge
                            variant="secondary"
                            className="rounded-full text-[11px] font-medium capitalize"
                          >
                            {inv.role.toLowerCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{inv.email}</p>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                          <span>Dispatched {inv.invitedAt}</span>
                          <span>•</span>
                          {isPending && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Expires in 6 days
                            </span>
                          )}
                          {isAccepted && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Accepted {inv.usedAt}
                            </span>
                          )}
                          {isExpired && <span className="text-muted-foreground">Expired</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
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
                        className="size-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
