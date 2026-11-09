import { useEffect, useState, useTransition } from "react";
import { useRouter } from "@tanstack/react-router";
import { Bot, KeyRound, Search, ShieldCheck } from "lucide-react";

import { updateCopilotStudioPolicyAction } from "@/app/actions/copilot-studio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AI_PROVIDER_MODELS, DEFAULT_AI_MODELS, type AIProvider } from "@/lib/settings-preferences";
import type { CopilotStudioSettingsView } from "@/lib/ai/copilot-access";

type AccessValue = "inherit" | "allow" | "deny";

export function StudioCopilotAccessSettings({ initial }: { initial: CopilotStudioSettingsView }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);

  useEffect(() => {
    setSettings(initial);
  }, [initial]);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [saving, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [accessSheetRole, setAccessSheetRole] = useState<"WORKER" | "CLIENT" | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const update = <K extends keyof CopilotStudioSettingsView>(key: K, value: CopilotStudioSettingsView[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const accessValue = (override: boolean | null): AccessValue => override === null ? "inherit" : override ? "allow" : "deny";
  const setMemberAccess = (userId: string, value: AccessValue) => {
    setSettings((current) => ({
      ...current,
      members: current.members.map((member) => member.userId === userId
        ? { ...member, override: value === "inherit" ? null : value === "allow" }
        : member),
    }));
  };

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateCopilotStudioPolicyAction({
        enabled: settings.enabled,
        workersEnabled: settings.workersEnabled,
        clientsEnabled: settings.clientsEnabled,
        provider: settings.provider,
        model: settings.model,
        customEndpoint: settings.customEndpoint,
        apiKey,
        clearApiKey,
        dailyRequestLimit: settings.dailyRequestLimit,
        overrides: settings.members.map(({ userId, override }) => ({ userId, enabled: override })),
      });
      if (result.error) {
        setMessage(result.error);
      } else {
        setApiKey("");
        setClearApiKey(false);
        setSettings((current) => ({ ...current, hasSharedKey: clearApiKey ? false : Boolean(apiKey) || current.hasSharedKey }));
        setMessage("Studio Copilot settings saved.");
        router.invalidate();
      }
    });
  };

  const providerModels = AI_PROVIDER_MODELS[settings.provider];
  const accessMembers = accessSheetRole
    ? settings.members.filter((member) => member.role === accessSheetRole)
    : [];
  const visibleAccessMembers = accessMembers.filter((member) => {
    const query = memberSearch.trim().toLocaleLowerCase();
    return !query || `${member.name} ${member.email}`.toLocaleLowerCase().includes(query);
  });
  const selectedRoleDefault = accessSheetRole === "WORKER" ? settings.workersEnabled : settings.clientsEnabled;

  const openAccessSheet = (role: "WORKER" | "CLIENT") => {
    setMemberSearch("");
    setAccessSheetRole(role);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-start gap-3 border-b border-border pb-5">
        <div className="rounded-xl bg-primary/10 p-2 text-primary"><ShieldCheck className="size-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">Studio Copilot access</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            Control who can open Copilot and whether they use a studio managed AI connection. This setting affects the floating chat, full screen chat, file attachments, and chat actions.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
          <div className="min-w-0">
            <Label htmlFor="studio-copilot-enabled" className="text-sm font-medium">Enable Copilot for this studio</Label>
            <p className="mt-1 text-xs text-muted-foreground">Turn this off to hide all Copilot controls and reject Copilot requests for everyone.</p>
          </div>
          <Switch id="studio-copilot-enabled" checked={settings.enabled} onCheckedChange={(checked) => update("enabled", checked)} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {(["WORKER", "CLIENT"] as const).map((role) => {
            const isWorker = role === "WORKER";
            const enabled = isWorker ? settings.workersEnabled : settings.clientsEnabled;
            const roleMembers = settings.members.filter((member) => member.role === role);
            const overrides = roleMembers.filter((member) => member.override !== null).length;
            const switchId = isWorker ? "studio-copilot-workers" : "studio-copilot-clients";
            return (
              <div key={role} className="flex min-h-36 flex-col justify-between gap-4 rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Label htmlFor={switchId} className="text-sm font-medium">{isWorker ? "Workers" : "Clients"}</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isWorker ? "Default access for your active workers." : "Default access for clients invited by you or connected to your projects."}
                    </p>
                  </div>
                  <Switch
                    id={switchId}
                    checked={enabled}
                    disabled={!settings.enabled || saving}
                    onCheckedChange={(checked) => update(isWorker ? "workersEnabled" : "clientsEnabled", checked)}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">
                    {roleMembers.length} {isWorker ? "workers" : "clients"}{overrides > 0 ? ` · ${overrides} individual ${overrides === 1 ? "rule" : "rules"}` : ""}
                  </p>
                  <Button type="button" variant="outline" size="sm" disabled={!settings.enabled || roleMembers.length === 0} onClick={() => openAccessSheet(role)}>
                    Manage access
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border p-4 sm:p-5">
          <div className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /><h3 className="text-sm font-semibold">Shared AI connection</h3></div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            When a shared key is saved, every authorized user is billed through this provider connection. Your personal AI settings and keys stay unchanged and are used when no shared key is configured.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="studio-ai-provider">Provider</Label>
              <select id="studio-ai-provider" value={settings.provider} disabled={saving} onChange={(event) => {
                const provider = event.target.value as AIProvider;
                update("provider", provider);
                update("model", DEFAULT_AI_MODELS[provider]);
              }} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground">
                <option value="OPENAI">OpenAI</option><option value="ANTHROPIC">Anthropic</option><option value="GEMINI">Google Gemini</option><option value="GROK">xAI Grok</option><option value="GROQ">Groq</option><option value="CUSTOM">Custom endpoint</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="studio-ai-model">Model</Label>
              {settings.provider === "CUSTOM" ? (
                <Input id="studio-ai-model" value={settings.model} disabled={saving} onChange={(event) => update("model", event.target.value)} placeholder="Model ID" />
              ) : (
                <select id="studio-ai-model" value={settings.model} disabled={saving} onChange={(event) => update("model", event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground">
                  {providerModels.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                </select>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="studio-ai-key">Studio API key</Label>
              <Input id="studio-ai-key" type="password" autoComplete="new-password" value={apiKey} disabled={saving} onChange={(event) => { setApiKey(event.target.value); setClearApiKey(false); }} placeholder={settings.hasSharedKey ? "Saved securely, enter a new key to replace it" : "Paste the provider key"} />
              <p className="text-xs text-muted-foreground">The key is encrypted in the database and is never sent back to the browser.</p>
              {settings.hasSharedKey && <button type="button" disabled={saving} onClick={() => { setClearApiKey((value) => !value); setApiKey(""); }} className="text-xs font-medium text-destructive hover:underline">{clearApiKey ? "Keep saved key" : "Remove shared key"}</button>}
            </div>
            {settings.provider === "CUSTOM" && <div className="space-y-2 md:col-span-2"><Label htmlFor="studio-ai-endpoint">Custom endpoint</Label><Input id="studio-ai-endpoint" type="url" value={settings.customEndpoint} disabled={saving} onChange={(event) => update("customEndpoint", event.target.value)} placeholder="https://your-ai-host.example/v1" /><p className="text-xs text-muted-foreground">Custom hosts must also be allowed by the server setting AI_ALLOWED_CUSTOM_HOSTS.</p></div>}
            <div className="space-y-2 md:max-w-xs"><Label htmlFor="copilot-daily-limit">Daily shared requests per person</Label><Input id="copilot-daily-limit" type="number" min={0} max={5000} value={settings.dailyRequestLimit} disabled={saving} onChange={(event) => update("dailyRequestLimit", Number(event.target.value))} /><p className="text-xs text-muted-foreground">Resets at 00:00 UTC. Set 0 for no limit. This tracks requests, not provider token charges.</p></div>
            <div className="rounded-lg bg-muted/40 p-3 text-xs md:col-span-2">
              <p className="font-medium text-foreground">Shared requests today: {settings.usageTodayTotal}</p>
              {settings.usageByUser.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                  {settings.usageByUser.map((usage) => <li key={usage.userId}>{usage.name} ({usage.role.toLowerCase()}): {usage.count}</li>)}
                </ul>
              ) : <p className="mt-1 text-muted-foreground">No shared key requests have been recorded today.</p>}
            </div>
          </div>
        </div>

        <Sheet open={accessSheetRole !== null} onOpenChange={(open) => { if (!open) setAccessSheetRole(null); }}>
          <SheetContent side="right" style={{ width: "min(92vw, 28rem)", maxWidth: "none" }} className="gap-0 p-0">
            <SheetHeader className="border-b border-border pr-14">
              <SheetTitle>{accessSheetRole === "WORKER" ? "Worker Copilot access" : "Client Copilot access"}</SheetTitle>
              <SheetDescription>Set the default for this group, then adjust individual access below.</SheetDescription>
            </SheetHeader>
            {accessSheetRole && (
              <>
                <div className="border-b border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Allow all {accessSheetRole === "WORKER" ? "workers" : "clients"} by default</p>
                      <p className="mt-1 text-xs text-muted-foreground">Individual rules can override this default.</p>
                    </div>
                    <Switch
                      aria-label={`Allow all ${accessSheetRole === "WORKER" ? "workers" : "clients"} by default`}
                      checked={selectedRoleDefault}
                      disabled={!settings.enabled || saving}
                      onCheckedChange={(checked) => update(accessSheetRole === "WORKER" ? "workersEnabled" : "clientsEnabled", checked)}
                    />
                  </div>
                </div>
                <div className="border-b border-border px-4 py-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder={`Search ${accessSheetRole === "WORKER" ? "workers" : "clients"}`} aria-label={`Search ${accessSheetRole === "WORKER" ? "workers" : "clients"}`} className="pl-9" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{accessMembers.length} {accessSheetRole === "WORKER" ? "workers" : "clients"}</p>
                </div>
                <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-4">
                  {visibleAccessMembers.length > 0 ? visibleAccessMembers.map((member) => (
                    <li key={member.userId} className="flex flex-col gap-2 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{member.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                      <select aria-label={`Copilot access for ${member.name}`} value={accessValue(member.override)} disabled={saving || !settings.enabled} onChange={(event) => setMemberAccess(member.userId, event.target.value as AccessValue)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground">
                        <option value="inherit">Use role default</option><option value="allow">Allow Copilot</option><option value="deny">Block Copilot</option>
                      </select>
                    </li>
                  )) : (
                    <li className="py-8 text-center text-sm text-muted-foreground">{accessMembers.length ? "No people match your search." : `No active ${accessSheetRole === "WORKER" ? "workers" : "clients"} are available yet.`}</li>
                  )}
                </ul>
              </>
            )}
          </SheetContent>
        </Sheet>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          {message ? <p role="status" className={`text-sm ${message.includes("could not") || message.includes("Choose") || message.includes("outside") ? "text-destructive" : "text-muted-foreground"}`}>{message}</p> : <p className="text-xs text-muted-foreground"><Bot className="mr-1 inline size-3.5" />Changes apply to new requests and refresh the Copilot controls after saving.</p>}
          <Button type="button" disabled={saving} onClick={save} className="w-full sm:w-auto">{saving ? "Saving…" : "Save studio settings"}</Button>
        </div>
      </div>
    </section>
  );
}
