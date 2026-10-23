"use client";

import { useState } from "react";
import {
  Users,
  Camera,
  Eye,
  CheckCircle2,
  Copy,
  Check,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PrototypeInvitation, InvitationRole } from "./types";

export function VersionC({
  invitations,
  onAddInvitation,
  onRevoke,
}: {
  invitations: PrototypeInvitation[];
  onAddInvitation: (inv: Omit<PrototypeInvitation, "id" | "invitedAt" | "expiresAt" | "token">) => void;
  onRevoke: (id: string) => void;
}) {
  const [selectedRole, setSelectedRole] = useState<InvitationRole>("WORKER");
  const [emailsInput, setEmailsInput] = useState("");
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  const handleBatchDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailsInput.trim()) return;

    const parsedEmails = emailsInput
      .split(/[\n,]+/)
      .map((em) => em.trim())
      .filter((em) => em.includes("@"));

    if (parsedEmails.length === 0) return;

    parsedEmails.forEach((email) => {
      onAddInvitation({
        email,
        role: selectedRole,
        status: "PENDING",
      });
    });

    setBatchNotice(`Successfully generated ${parsedEmails.length} invitation links!`);
    setEmailsInput("");
    setTimeout(() => setBatchNotice(null), 4000);
  };

  const handleCopy = (id: string, token: string) => {
    navigator.clipboard?.writeText(`${window.location.origin}/invite/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Studio Onboarding Hub
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deploy batch invitations tailored for creative workers or external clients.
        </p>
      </div>

      {/* Role Selection Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Worker Tier Card */}
        <div
          onClick={() => setSelectedRole("WORKER")}
          className={`cursor-pointer rounded-2xl border p-5 transition-all ${
            selectedRole === "WORKER"
              ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-sm"
              : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
          }`}
        >
          <div className="flex items-start justify-between">
            <span
              className={`flex size-11 items-center justify-center rounded-xl font-bold ${
                selectedRole === "WORKER"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Camera className="size-5" />
            </span>
            <Badge
              variant="secondary"
              className={selectedRole === "WORKER" ? "bg-primary/20 text-primary" : ""}
            >
              Internal Team
            </Badge>
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Studio Worker</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            For photographers, videographers, photo retouchers, and assistants.
          </p>
          <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground border-t pt-3">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-primary" />
              <span>Log daily tasks, hours & daybook notes</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-primary" />
              <span>Assigned shooting & editing deliverables</span>
            </li>
          </ul>
        </div>

        {/* Client Tier Card */}
        <div
          onClick={() => setSelectedRole("CLIENT")}
          className={`cursor-pointer rounded-2xl border p-5 transition-all ${
            selectedRole === "CLIENT"
              ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-sm"
              : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
          }`}
        >
          <div className="flex items-start justify-between">
            <span
              className={`flex size-11 items-center justify-center rounded-xl font-bold ${
                selectedRole === "CLIENT"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Eye className="size-5" />
            </span>
            <Badge
              variant="secondary"
              className={selectedRole === "CLIENT" ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" : ""}
            >
              External Partner
            </Badge>
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Client Representative</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            For brand managers, wedding couples, and agency art directors.
          </p>
          <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground border-t pt-3">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-blue-600 dark:text-blue-400" />
              <span>Access restricted project proofs & timelines</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-blue-600 dark:text-blue-400" />
              <span>Approve photo sets & submit revision requests</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Batch Dispatcher Form */}
      <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Invite {selectedRole === "WORKER" ? "Workers" : "Clients"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Add one or multiple emails. Each recipient receives a unique cryptographic link.
            </p>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <span className="text-xs text-muted-foreground mr-1">Link Validity:</span>
            {[3, 7, 14].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setExpiryDays(days)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  expiryDays === days
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleBatchDispatch} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="batch-emails" className="text-xs">
              Recipient Email(s)
            </Label>
            <Textarea
              id="batch-emails"
              rows={3}
              placeholder="sarah@agency.com, alex@studio.io&#10;emily.photos@gmail.com"
              value={emailsInput}
              onChange={(e) => setEmailsInput(e.target.value)}
              className="resize-y rounded-xl font-mono text-sm leading-relaxed"
            />
          </div>

          {batchNotice && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {batchNotice}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              Recipients must accept before signing in with Google.
            </p>
            <Button
              type="submit"
              className="gap-2 rounded-full bg-primary font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
            >
              <Send className="size-4" />
              <span>Generate Invitation Links</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Roster Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Active Team Dispatches</h3>
          <span className="text-xs text-muted-foreground">{invitations.length} total links generated</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {invitations.map((inv) => {
            const isCopied = copiedId === inv.id;
            const isPending = inv.status === "PENDING";
            const isAccepted = inv.status === "ACCEPTED";
            const isExpired = inv.status === "EXPIRED";

            return (
              <div
                key={inv.id}
                className="flex flex-col justify-between rounded-xl border bg-card p-4 transition-all hover:border-primary/40 shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={`rounded-full text-[10px] font-medium uppercase tracking-wider ${
                        inv.role === "WORKER"
                          ? "border-primary/30 text-primary bg-primary/5"
                          : "border-blue-500/30 text-blue-600 bg-blue-500/5 dark:text-blue-400"
                      }`}
                    >
                      {inv.role}
                    </Badge>

                    {isPending && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                        <span className="size-1 rounded-full bg-amber-500 animate-pulse" />
                        Pending
                      </span>
                    )}
                    {isAccepted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" />
                        Accepted
                      </span>
                    )}
                    {isExpired && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        Expired
                      </span>
                    )}
                  </div>

                  <p className="mt-3 font-semibold text-sm text-foreground truncate">
                    {inv.recipientName || inv.email.split("@")[0]}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{inv.email}</p>

                  <div className="mt-3 border-t pt-2.5 text-[11px] text-muted-foreground">
                    {inv.clientProject ? (
                      <p className="truncate">Project: {inv.clientProject}</p>
                    ) : inv.specialization ? (
                      <p className="truncate">Role: {inv.specialization.join(", ")}</p>
                    ) : (
                      <p>Standard access</p>
                    )}
                    <p className="mt-0.5 text-muted-foreground">
                      {isAccepted ? `Activated on ${inv.usedAt}` : `Expires on ${inv.expiresAt}`}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  {isPending ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(inv.id, inv.token)}
                      className="h-8 gap-1.5 rounded-full text-xs font-medium w-full mr-2"
                    >
                      {isCopied ? (
                        <>
                          <Check className="size-3 text-emerald-600" />
                          <span className="text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span>Copy Token</span>
                        </>
                      )}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Link finalized</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRevoke(inv.id)}
                    className="size-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
