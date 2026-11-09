import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useTheme } from "next-themes";
import {
  User,
  Bell,
  Palette,
  Sliders,
  Shield,
  Check,
  Mail,
  Smartphone,
  Laptop,
  Volume2,
  Trash2,
  MapPin,
  Bot,
  Key,
  Cpu,
  ShieldCheck,
  Sun,
  Moon,
} from "lucide-react";

import {
  updateProfileName,
  updateProfilePicture,
  removeProfilePicture,
  type ProfileActionState,
} from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getProfileImageSrc } from "@/lib/profile-image";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { StudioCopilotAccessSettings } from "@/components/settings/studio-copilot-access-settings";
import type { CopilotStudioSettingsView } from "@/lib/ai/copilot-access";
import { SettingsDensity, UserRole, WorkerAvailability } from "@/generated/prisma/browser";
import { updateUserPreferencesAction } from "@/app/actions/settings";
import { useWorkspacePreferences } from "@/components/workspace/workspace-preferences-context";
import { playNotificationChime, prepareNotificationAudio } from "@/lib/notification-audio";
import type { UserPreferencePatch } from "@/lib/validation/settings";
import {
  AI_PROVIDER_MODELS,
  DEFAULT_AI_MODELS,
  ROLE_LANDING_OPTIONS,
  ROLE_NOTIFICATION_PREFERENCES,
  type AIProvider,
  type UserPreferencesView,
} from "@/lib/settings-preferences";

export type SettingsTab =
  | "profile"
  | "notifications"
  | "appearance"
  | "workflow"
  | "ai"
  | "security";

const initialFormState: ProfileActionState = {};

interface ProfileSettingsProps {
  email: string;
  image: string | null;
  name: string | null;
  userId: string;
  role?: UserRole;
  preferences: UserPreferencesView;
  studioCopilotSettings?: CopilotStudioSettingsView;
}

export function ProfileSettings({
  email,
  image,
  name,
  userId,
  role = UserRole.MANAGER,
  preferences: initialPreferences,
  studioCopilotSettings,
}: ProfileSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const workspacePreferences = useWorkspacePreferences();

  const [preferences, setPreferences] = useState(initialPreferences);
  const [locationDraft, setLocationDraft] = useState(initialPreferences.location);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [endpointDraft, setEndpointDraft] = useState(initialPreferences.aiPreferences?.aiCustomEndpoint || "");

  useEffect(() => {
    setPreferences(initialPreferences);
    setLocationDraft(initialPreferences.location);
    setEndpointDraft(initialPreferences.aiPreferences?.aiCustomEndpoint || "");
  }, [initialPreferences]);
  const [saving, startSaveTransition] = useTransition();
  const selectedAIProvider = preferences.aiPreferences?.aiProvider ?? "OPENAI";
  const selectedAIModel = preferences.aiPreferences?.aiModel ?? DEFAULT_AI_MODELS[selectedAIProvider];
  const selectedAIModelOption = AI_PROVIDER_MODELS[selectedAIProvider].find(({ id }) => id === selectedAIModel);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3600);
  };

  const savePreference = (
    patch: UserPreferencePatch,
    optimisticUpdate: (current: UserPreferencesView) => UserPreferencesView,
    successMessage: string,
  ) => {
    const previous = preferences;
    setPreferences(optimisticUpdate(previous));
    if (patch.density !== undefined) workspacePreferences.setDensity(patch.density);
    if (patch.soundAlerts !== undefined) workspacePreferences.setSoundAlerts(patch.soundAlerts);
    startSaveTransition(async () => {
      const result = await updateUserPreferencesAction(patch);
      if (result.error) {
        setPreferences(previous);
        if (patch.density !== undefined) workspacePreferences.setDensity(previous.density);
        if (patch.soundAlerts !== undefined) workspacePreferences.setSoundAlerts(previous.soundAlerts);
        showToast(result.error);
      } else {
        showToast(successMessage);
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-xs font-medium text-background shadow-2xl animate-in fade-in-0 slide-in-from-bottom-2">
          <Check className="size-4 shrink-0 text-primary" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Settings Header */}
      <header className="border-b border-border pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Settings & Preferences
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Manage your profile, notification delivery, appearance, and role-specific defaults.
            </p>
          </div>
        </div>
      </header>

      {/* Option A Layout: Left Vertical Navigation Sidebar & Right Content Panel */}
      <div className="flex flex-col gap-8 md:flex-row md:items-start w-full">
        {/* Left Navigation Sidebar */}
        <aside className="w-full shrink-0 rounded-2xl border border-border bg-card p-3 shadow-sm md:sticky md:top-4 md:max-h-[calc(100dvh-2rem)] md:w-64 md:self-start md:overflow-y-auto">
          <div className="mb-3 px-3 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Settings Menu
            </p>
          </div>

          <nav className="flex flex-col gap-1" aria-label="Settings navigation">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                activeTab === "profile"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <User className="size-4 shrink-0" />
                <span>Profile & Identity</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("notifications")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                activeTab === "notifications"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bell className="size-4 shrink-0" />
                <span>Notifications & Alerts</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("appearance")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                activeTab === "appearance"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Palette className="size-4 shrink-0" />
                <span>Appearance & Workspace</span>
              </div>
            </button>

          {role === UserRole.WORKER && <button
              type="button"
              onClick={() => setActiveTab("workflow")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                activeTab === "workflow"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sliders className="size-4 shrink-0" />
                <span>Work availability</span>
              </div>
          </button>}

            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                activeTab === "ai"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bot className="size-4 shrink-0" />
                <span>AI Copilot & Models</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("security")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                activeTab === "security"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Shield className="size-4 shrink-0" />
                <span>Sign-In & Security</span>
              </div>
            </button>
          </nav>

          {/* Current Profile Summary */}
          <div className="mt-6 border-t border-border pt-4 px-3">
            <div className="flex items-center gap-2.5">
              <ProfilePhoto image={image} name={name} userId={userId} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{name || "Studio Member"}</p>
                <p className="truncate text-[10px] text-muted-foreground">{email}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Content Area */}
        <section className="min-w-0 flex-1 space-y-6">
          {/* ================= TAB 1: PROFILE & IDENTITY ================= */}
          {activeTab === "profile" && (
            <div className="space-y-6 w-full">
              {/* Profile Photo Upload Section */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Profile Picture
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  This photo appears on assigned tasks, comment pins, deliverables, and team tables.
                </p>

                <div className="mt-5">
                  <PictureUploadForm
                    currentImage={image}
                    name={name}
                    userId={userId}
                    onShowToast={showToast}
                  />
                </div>
              </div>

              {/* Display Name Section */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Display Name
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your full name displayed across project boards and client reports.
                </p>

                <div className="mt-4">
                  <NameForm initialName={name ?? ""} onShowToast={showToast} />
                </div>
              </div>

              {/* Saved studio or branch name */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    Studio or branch
                  </h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Save the name of the studio or branch associated with your account.
                </p>

                <div className="mt-4 max-w-lg space-y-2">
                  <Label htmlFor="assigned-location" className="text-xs">
                    Studio or branch name
                  </Label>
                  <Input
                    id="assigned-location"
                    value={locationDraft}
                    maxLength={120}
                    placeholder="Enter your studio or branch"
                    onChange={(event) => setLocationDraft(event.target.value)}
                    onBlur={(event) => {
                      const location = event.target.value.trim();
                      if (location !== preferences.location) {
                        savePreference(
                          { location: location || null },
                          (current) => ({ ...current, location }),
                          "Studio or branch saved.",
                        );
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    aria-describedby="assigned-location-help"
                  />
                  <p id="assigned-location-help" className="text-[11px] text-muted-foreground">
                    Saved to your account. This is informational and does not change project access.
                  </p>
                </div>
              </div>

              {/* Google Workspace Connected Account */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground">Google Workspace Authentication</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your account signs in securely with your verified Google email.
                </p>

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background border border-border">
                      <GoogleMark />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{email}</p>
                      <p className="text-[11px] text-muted-foreground">Google OAuth 2.0 Connected</p>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3.5" />
                    <span>Connected</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: NOTIFICATIONS & ALERTS ================= */}
          {activeTab === "notifications" && (
            <div className="space-y-6 w-full">
              <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-border pb-4 sm:grid-cols-[minmax(0,1fr)_112px_112px] sm:gap-4">
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                      Notification preferences
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Choose which future events appear in the app and which ones send email.
                    </p>
                  </div>
                  <div className="hidden items-center justify-center gap-1.5 text-center text-xs font-semibold text-muted-foreground sm:flex">
                    <Smartphone className="size-3.5 text-primary" />
                    <span>In-App</span>
                  </div>
                  <div className="hidden items-center justify-center gap-1.5 text-center text-xs font-semibold text-muted-foreground sm:flex">
                    <Mail className="size-3.5 text-primary" />
                    <span>Email</span>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {ROLE_NOTIFICATION_PREFERENCES[role].map((item) => {
                    const state = preferences.notificationChannels[item.type] ?? { inApp: true, email: false };
                    return (
                      <div
                        key={item.type}
                        className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 sm:grid-cols-[minmax(0,1fr)_112px_112px] sm:items-center sm:gap-4"
                      >
                        <div className="col-span-2 min-w-0 space-y-0.5 sm:col-span-1 sm:pr-4">
                          <p className="min-w-0 text-xs font-semibold text-foreground">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground">{item.description}</p>
                        </div>

                        <div className="flex min-w-0 items-center justify-between rounded-md bg-muted/40 px-3 py-2 sm:justify-center sm:bg-transparent sm:px-0 sm:py-0">
                          <span className="text-xs text-muted-foreground sm:hidden">In-App</span>
                          <Switch
                            checked={state.inApp}
                            disabled={saving}
                            onCheckedChange={(val) => savePreference(
                              { notificationChannel: { type: item.type, channel: "inApp", enabled: val } },
                              (current) => ({
                                ...current,
                                notificationChannels: {
                                  ...current.notificationChannels,
                                  [item.type]: { ...state, inApp: val },
                                },
                              }),
                              "In app notification preference saved.",
                            )}
                            aria-label={`Toggle In-App notifications for ${item.title}`}
                          />
                        </div>

                        <div className="flex min-w-0 items-center justify-between rounded-md bg-muted/40 px-3 py-2 sm:justify-center sm:bg-transparent sm:px-0 sm:py-0">
                          <span className="text-xs text-muted-foreground sm:hidden">Email</span>
                          <Switch
                            checked={state.email}
                            disabled={saving}
                            onCheckedChange={(val) => savePreference(
                              { notificationChannel: { type: item.type, channel: "email", enabled: val } },
                              (current) => ({
                                ...current,
                                notificationChannels: {
                                  ...current.notificationChannels,
                                  [item.type]: { ...state, email: val },
                                },
                              }),
                              "Email notification preference saved.",
                            )}
                            aria-label={`Toggle Email notifications for ${item.title}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  These preferences apply to future events. In app choices control the notification center and live bell; email choices control future emails.
                </p>

                <div className="mt-5 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Volume2 className="size-4 text-primary" />
                      <p className="text-xs font-semibold text-foreground">Audio Alert Chime</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Play a brief chime when a new in-app notification arrives.
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void prepareNotificationAudio();
                        void playNotificationChime();
                      }}
                      className="h-8 text-[11px]"
                    >
                      Test Chime
                    </Button>
                    <Switch
                      checked={preferences.soundAlerts}
                      disabled={saving}
                      onCheckedChange={(checked) => {
                        if (checked) void prepareNotificationAudio();
                        savePreference(
                          { soundAlerts: checked },
                          (current) => ({ ...current, soundAlerts: checked }),
                          checked ? "Sound alerts enabled." : "Sound alerts disabled.",
                        );
                      }}
                      aria-label="Toggle audio alert chime"
                    />
                  </div>
                </div>
              </section>

              <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-foreground">Current delivery behavior</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-6">
                  <div className="flex items-start gap-2.5">
                    <Smartphone className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Workspace notifications appear in the in-app notification feed when workflow events create them.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Email is sent immediately for workflow events configured to send it. Digests and quiet hours are not available.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: APPEARANCE & WORKSPACE ================= */}
          {activeTab === "appearance" && (
            <div className="space-y-6 w-full">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Appearance & Workspace Preferences
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Customize theme, board information density, and initial landing screen.
                </p>

                <div className="mt-6 space-y-6">
                  {/* Theme Mode */}
                  <div>
                    <Label className="text-xs font-semibold">Theme Mode</Label>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Choose your preferred color theme or match system settings.
                    </p>
                    <div className="grid grid-cols-3 gap-3 max-w-md">
                      <button
                        type="button"
                        onClick={() => {
                          setTheme("light");
                          showToast("Theme switched to Light mode");
                        }}
                        className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all ${
                          resolvedTheme === "light"
                            ? "border-primary bg-primary/5 text-foreground font-semibold"
                            : "border-border hover:bg-muted/30 text-muted-foreground"
                        }`}
                      >
                        <Sun className="size-4" />
                        <span>Light</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTheme("dark");
                          showToast("Theme switched to Dark mode");
                        }}
                        className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all ${
                          resolvedTheme === "dark"
                            ? "border-primary bg-primary/5 text-foreground font-semibold"
                            : "border-border hover:bg-muted/30 text-muted-foreground"
                        }`}
                      >
                        <Moon className="size-4" />
                        <span>Dark</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTheme("system");
                          showToast("Theme set to match System");
                        }}
                        className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all border-border hover:bg-muted/30 text-muted-foreground`}
                      >
                        <Laptop className="size-4" />
                        <span>System</span>
                      </button>
                    </div>
                  </div>

                  {/* Default Landing Workspace */}
                  <div className="border-t border-border pt-5">
                    <Label className="text-xs font-semibold">Default Landing Workspace</Label>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Where WoPhoto takes you immediately upon signing in.
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-2xl">
                      {ROLE_LANDING_OPTIONS[role].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => savePreference(
                            { defaultLanding: option.value },
                            (current) => ({ ...current, defaultLanding: option.value }),
                            `Default page set to ${option.label}.`,
                          )}
                          aria-pressed={preferences.defaultLanding === option.value}
                          className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                            preferences.defaultLanding === option.value
                              ? "border-primary bg-primary/5 text-foreground font-semibold"
                              : "border-border text-muted-foreground hover:bg-muted/30"
                          }`}
                        >
                          <span className="text-xs font-semibold text-foreground">{option.label}</span>
                          <span className="text-[11px] text-muted-foreground">{option.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Information Density */}
                  <div className="border-t border-border pt-5">
                    <Label className="text-xs font-semibold">Table & Board Information Density</Label>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Reduce row spacing in tables across your workspace.
                    </p>
                    <div className="grid grid-cols-2 gap-3 max-w-md">
                      <button
                        type="button"
                        onClick={() => {
                          savePreference(
                            { density: SettingsDensity.COZY },
                            (current) => ({ ...current, density: SettingsDensity.COZY }),
                            "Information density set to Cozy.",
                          );
                        }}
                        className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                          preferences.density === SettingsDensity.COZY
                            ? "border-primary bg-primary/5 text-foreground font-semibold"
                            : "border-border hover:bg-muted/30 text-muted-foreground"
                        }`}
                      >
                        <span className="text-xs font-semibold text-foreground">Cozy Density</span>
                        <span className="text-[11px] text-muted-foreground">Generous breathing room</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          savePreference(
                            { density: SettingsDensity.COMPACT },
                            (current) => ({ ...current, density: SettingsDensity.COMPACT }),
                            "Information density set to Compact.",
                          );
                        }}
                        className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                          preferences.density === SettingsDensity.COMPACT
                            ? "border-primary bg-primary/5 text-foreground font-semibold"
                            : "border-border hover:bg-muted/30 text-muted-foreground"
                        }`}
                      >
                        <span className="text-xs font-semibold text-foreground">Compact Density</span>
                        <span className="text-[11px] text-muted-foreground">More rows visible at once</span>
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ================= WORKER AVAILABILITY ================= */}
          {activeTab === "workflow" && role === UserRole.WORKER && (
            <div className="w-full">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Work availability
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Managers can see this status when assigning work. It does not block task assignment.
                </p>
                <div className="mt-5 max-w-lg space-y-2">
                  <Label htmlFor="worker-availability" className="text-xs">Current availability</Label>
                  <select
                    id="worker-availability"
                    value={preferences.workerAvailability}
                    disabled={saving}
                    onChange={(event) => {
                      const availability = event.target.value as WorkerAvailability;
                      savePreference(
                        { workerAvailability: availability },
                        (current) => ({ ...current, workerAvailability: availability }),
                        "Work availability saved.",
                      );
                    }}
                    className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                  >
                    <option value={WorkerAvailability.AVAILABLE}>Available for assignments</option>
                    <option value={WorkerAvailability.IN_SHOOT}>In a studio shoot</option>
                    <option value={WorkerAvailability.FOCUS_MODE}>Focus time</option>
                    <option value={WorkerAvailability.OFF_SHIFT}>Off shift</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB: AI COPILOT & MODEL PREFERENCES ================= */}
          {activeTab === "ai" && (
            <div className="space-y-6 w-full">
              {/* Card 1: Provider & Model Selection */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
                {role === UserRole.MANAGER && (
                  <div className="max-w-2xl border-b border-border pb-5">
                    <Label htmlFor="ai-copilot-name" className="text-xs font-semibold">Copilot name</Label>
                    <p className="mb-2 mt-1 text-[11px] text-muted-foreground">
                      This name appears in the assistant and is shared with clients and workers connected to your projects.
                    </p>
                    <Input
                      id="ai-copilot-name"
                      maxLength={48}
                      defaultValue={preferences.aiPreferences?.aiCopilotName ?? "WoPhoto Studio Copilot"}
                      disabled={saving}
                      onBlur={(event) => {
                        const aiCopilotName = event.currentTarget.value.trim();
                        if (!aiCopilotName) {
                          event.currentTarget.value = preferences.aiPreferences?.aiCopilotName ?? "WoPhoto Studio Copilot";
                        } else if (aiCopilotName !== preferences.aiPreferences?.aiCopilotName) {
                          savePreference(
                            { aiCopilotName },
                            (current) => ({
                              ...current,
                              aiPreferences: { ...current.aiPreferences, aiCopilotName },
                            }),
                            "Copilot name saved.",
                          );
                        }
                      }}
                      className="h-9 max-w-lg text-xs"
                      placeholder="WoPhoto Studio Copilot"
                    />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <Cpu className="size-4 text-primary" />
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                      AI Provider & Model Engine
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Select your preferred AI intelligence provider and foundation model for the studio copilot.
                  </p>
                </div>

                <div className="space-y-4 max-w-2xl">
                  {/* Provider selection buttons */}
                  <div>
                    <Label className="text-xs font-semibold">Intelligence Provider</Label>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: "OPENAI", label: "OpenAI" },
                        { id: "ANTHROPIC", label: "Anthropic" },
                        { id: "GEMINI", label: "Google Gemini" },
                        { id: "GROK", label: "xAI Grok" },
                        { id: "GROQ", label: "Groq" },
                        { id: "CUSTOM", label: "Self-Hosted" },
                      ].map((prov) => {
                        const isSelected = preferences.aiPreferences?.aiProvider === prov.id;
                        return (
                          <button
                            key={prov.id}
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              const provider = prov.id as AIProvider;
                              const defaultModelForProv = DEFAULT_AI_MODELS[provider];

                              savePreference(
                                {
                                  aiProvider: provider,
                                  aiModel: defaultModelForProv,
                                },
                                (current) => ({
                                  ...current,
                                  aiPreferences: {
                                    ...current.aiPreferences,
                                    aiProvider: provider,
                                    aiModel: defaultModelForProv,
                                    hasCustomKey: current.aiPreferences?.aiApiKeyProvider === prov.id && current.aiPreferences.hasStoredKey,
                                  },
                                }),
                                `AI Provider switched to ${prov.label}.`
                              );
                            }}
                            className={`flex min-h-16 items-start justify-between gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                              isSelected
                                ? "border-primary bg-primary/5 text-foreground font-semibold ring-1 ring-primary/20"
                                : "border-border hover:bg-muted/30 text-muted-foreground"
                            }`}
                          >
                            <span className="pt-0.5 text-xs font-semibold text-foreground">{prov.label}</span>
                            {isSelected && <Badge variant="secondary" className="bg-primary/10 text-primary">Active</Badge>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Provider-specific model selector */}
                  <div className="pt-2">
                    <Label htmlFor="ai-model" className="text-xs font-semibold">Model</Label>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Choose a model by name. The selected provider ID is saved and sent to its API.
                    </p>
                    {selectedAIProvider === "CUSTOM" ? (
                      <div className="max-w-lg space-y-2">
                        <Input
                          id="ai-model"
                          defaultValue={selectedAIModel}
                          disabled={saving}
                          onBlur={(event) => {
                            const model = event.target.value.trim();
                            if (model && model !== preferences.aiPreferences?.aiModel) {
                              savePreference(
                                { aiModel: model },
                                (current) => ({
                                  ...current,
                                  aiPreferences: { ...current.aiPreferences, aiModel: model },
                                }),
                                "Self-hosted model saved.",
                              );
                            }
                          }}
                          className="h-9 text-xs font-mono"
                          placeholder="Model ID exposed by your endpoint"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Self-hosted endpoints provide their own model IDs, so enter the ID exposed by your server.
                        </p>
                      </div>
                    ) : (
                      <div className="max-w-lg space-y-2">
                        <Select
                          items={AI_PROVIDER_MODELS[selectedAIProvider].map(({ id, label }) => ({
                            value: id,
                            label,
                          }))}
                          value={selectedAIModel}
                          onValueChange={(model) => {
                            if (model && model !== selectedAIModel) {
                              savePreference(
                                { aiModel: model },
                                (current) => ({
                                  ...current,
                                  aiPreferences: { ...current.aiPreferences, aiModel: model },
                                }),
                                `Model set to ${AI_PROVIDER_MODELS[selectedAIProvider].find((option) => option.id === model)?.label ?? model}.`,
                              );
                            }
                          }}
                        >
                          <SelectTrigger id="ai-model" disabled={saving} className="h-9 w-full text-xs">
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                          <SelectContent>
                            {AI_PROVIDER_MODELS[selectedAIProvider].map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                <span>{model.label}</span>
                                {model.recommended && (
                                  <span className="text-[10px] font-medium text-primary">Recommended</span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedAIModelOption && (
                          <p className="text-[11px] text-muted-foreground">{selectedAIModelOption.description}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Custom Endpoint URL (when Self-Hosted / CUSTOM selected) */}
                  {preferences.aiPreferences?.aiProvider === "CUSTOM" && (
                    <div className="pt-2 space-y-1.5 border-t border-border">
                      <Label htmlFor="custom-endpoint" className="text-xs font-semibold">
                        Self-Hosted Base URL
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Your local Ollama, vLLM, or private proxy endpoint (OpenAI compatible).
                      </p>
                      <div className="flex items-center gap-2 max-w-lg">
                        <Input
                          id="custom-endpoint"
                          value={endpointDraft}
                          onChange={(e) => setEndpointDraft(e.target.value)}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val !== preferences.aiPreferences?.aiCustomEndpoint) {
                              savePreference(
                                { aiCustomEndpoint: val },
                                (current) => ({
                                  ...current,
                                  aiPreferences: { ...current.aiPreferences, aiCustomEndpoint: val },
                                }),
                                "Custom AI endpoint saved."
                              );
                            }
                          }}
                          className="text-xs font-mono h-9"
                          placeholder="http://localhost:11434/v1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: API Keys & Credentials */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Key className="size-4 text-primary" />
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                      API Credentials & Key Storage
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bring your own provider API key or use the studio server default. Keys are kept strictly server-side.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-border bg-muted/20 text-xs flex items-center justify-between gap-3 max-w-xl">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-semibold text-foreground">
                        {preferences.aiPreferences?.hasCustomKey
                          ? `Personal key active (${preferences.aiPreferences.aiApiKeyMasked})`
                          : preferences.aiPreferences?.hasStoredKey
                            ? `Personal key saved for ${preferences.aiPreferences.aiApiKeyProvider || "another provider"}`
                            : "Using studio server default key"}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        {preferences.aiPreferences?.hasCustomKey
                          ? "Your personal API key overrides server defaults for all your requests."
                          : preferences.aiPreferences?.hasStoredKey
                            ? "This key is used only when its provider is selected; otherwise the matching server key is used."
                            : "No personal key stored. The selected provider's server key is used automatically."}
                      </p>
                    </div>
                  </div>
                      {(preferences.aiPreferences?.hasStoredKey || preferences.aiPreferences?.aiApiKeyNeedsReset) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        savePreference(
                          { aiApiKey: "" },
                          (current) => ({
                            ...current,
                            aiPreferences: {
                              ...current.aiPreferences,
                              aiApiKeyMasked: "",
                              hasCustomKey: false,
                              hasStoredKey: false,
                              aiApiKeyProvider: null,
                              aiApiKeyNeedsReset: false,
                            },
                          }),
                          "Personal API key cleared. Reverted to server default."
                        );
                        setApiKeyDraft("");
                      }}
                      className="text-xs h-7 text-muted-foreground hover:text-foreground shrink-0"
                    >
                      Clear Key
                    </Button>
                  )}
                </div>

                {preferences.aiPreferences?.aiApiKeyNeedsReset && (
                  <p className="max-w-xl rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                    The saved key cannot be used safely. Replace it with a new key or clear it before using Copilot.
                  </p>
                )}

                <div className="space-y-2 max-w-lg pt-1">
                  <Label htmlFor="personal-key" className="text-xs font-medium">
                    Set or Update Personal API Key
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="personal-key"
                      type="password"
                      value={apiKeyDraft}
                      onChange={(e) => setApiKeyDraft(e.target.value)}
                      placeholder="Paste your API key (e.g. sk-...)"
                      className="text-xs font-mono h-9"
                    />
                    <Button
                      size="sm"
                      disabled={!apiKeyDraft.trim() || saving}
                      onClick={() => {
                        if (!apiKeyDraft.trim()) return;
                        const trimmed = apiKeyDraft.trim();
                        savePreference(
                          { aiApiKey: trimmed },
                          (current) => ({
                            ...current,
                            aiPreferences: {
                              ...current.aiPreferences,
                              aiApiKeyMasked: `••••••••${trimmed.slice(-4)}`,
                              hasCustomKey: true,
                              hasStoredKey: true,
                              aiApiKeyProvider: current.aiPreferences?.aiProvider ?? "OPENAI",
                              aiApiKeyNeedsReset: false,
                            },
                          }),
                          "Personal API key saved securely."
                        );
                        setApiKeyDraft("");
                      }}
                      className="text-xs h-9 font-semibold shrink-0"
                    >
                      Save Key
                    </Button>
                  </div>
                </div>
              </div>

              {/* Card 3: Autonomous Execution Safety Mode */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    Tool Execution Safety Mode
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose how the AI Studio Copilot handles state-changing database operations.
                  </p>
                </div>

                <div className="divide-y divide-border rounded-xl border border-border bg-background max-w-2xl">
                  {/* Mode Option 1: Safe Multi-Tier (Default) */}
                  <div
                    onClick={() => {
                      if (preferences.aiPreferences?.aiAutonomousExecution) {
                        savePreference(
                          { aiAutonomousExecution: false },
                          (current) => ({
                            ...current,
                            aiPreferences: { ...current.aiPreferences, aiAutonomousExecution: false },
                          }),
                          "Switched to Safe Multi-Tier mode."
                        );
                      }
                    }}
                    className={`p-4 flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                      !preferences.aiPreferences?.aiAutonomousExecution ? "bg-primary/5" : "hover:bg-muted/30"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          Safe Multi-Tier Mode (Default)
                        </span>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        Read-only search and capacity queries execute automatically. State-changing actions (creating projects, task batches, reassigning workers) output an action proposal card requiring a 1-click confirmation before modifying the database.
                      </p>
                    </div>
                    <Switch
                      checked={!preferences.aiPreferences?.aiAutonomousExecution}
                      onCheckedChange={(checked) => {
                        savePreference(
                          { aiAutonomousExecution: !checked },
                          (current) => ({
                            ...current,
                            aiPreferences: { ...current.aiPreferences, aiAutonomousExecution: !checked },
                          }),
                          checked ? "Switched to Safe Multi-Tier mode." : "Switched to Fully Autonomous mode."
                        );
                      }}
                    />
                  </div>

                  {/* Mode Option 2: Fully Autonomous */}
                  <div
                    onClick={() => {
                      if (!preferences.aiPreferences?.aiAutonomousExecution) {
                        savePreference(
                          { aiAutonomousExecution: true },
                          (current) => ({
                            ...current,
                            aiPreferences: { ...current.aiPreferences, aiAutonomousExecution: true },
                          }),
                          "Switched to Fully Autonomous mode."
                        );
                      }
                    }}
                    className={`p-4 flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                      preferences.aiPreferences?.aiAutonomousExecution ? "bg-primary/5" : "hover:bg-muted/30"
                    }`}
                  >
                    <div>
                      <span className="text-xs font-semibold text-foreground">
                        Fully Autonomous Execution Mode
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        All tools run immediately and commit changes directly to the studio database upon invocation by the AI copilot without presenting intermediate confirmation cards.
                      </p>
                    </div>
                    <Switch
                      checked={Boolean(preferences.aiPreferences?.aiAutonomousExecution)}
                      onCheckedChange={(checked) => {
                        savePreference(
                          { aiAutonomousExecution: checked },
                          (current) => ({
                            ...current,
                            aiPreferences: { ...current.aiPreferences, aiAutonomousExecution: checked },
                          }),
                          checked ? "Switched to Fully Autonomous mode." : "Switched to Safe Multi-Tier mode."
                        );
                      }}
                    />
                  </div>
                </div>
              </div>
              {role === UserRole.MANAGER && studioCopilotSettings && (
                <StudioCopilotAccessSettings initial={studioCopilotSettings} />
              )}
            </div>
          )}

          {/* ================= TAB 5: SECURITY & SESSIONS ================= */}
          {activeTab === "security" && (
            <div className="space-y-6 w-full">
              <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Google sign-in</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    WoPhoto accounts sign in with Google. Password and device-session controls are managed by Google, not from this page.
                  </p>
                </div>
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                      <GoogleMark />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{email}</p>
                      <p className="text-xs text-muted-foreground">Google account used for sign-in</p>
                    </div>
                  </div>
                  <span className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <Check className="size-3.5" />
                    Connected
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PictureUploadForm({
  currentImage,
  name,
  userId,
  onShowToast,
}: {
  currentImage: string | null;
  name: string | null;
  userId: string;
  onShowToast: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [isRemoving, startRemoveTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFileChange = (files: File[]) => {
    const file = files[0];
    if (file) {
      if (file.size > 1_500_000) {
        onShowToast("Image exceeds 1.5 MB limit.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        onShowToast("Choose a JPG, PNG, or WebP image.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setPreviewUrl(URL.createObjectURL(file));
      // Auto-submit the form
      formRef.current?.requestSubmit();
    }
  };

  const handleUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const result = await updateProfilePicture(initialFormState, formData);
        if (result.success) {
          setPreviewUrl(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          onShowToast(result.success);
        } else if (result.error) {
          setPreviewUrl(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          onShowToast(result.error);
        }
      } catch (error) {
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        console.error("Profile picture upload request failed", {
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        onShowToast("The upload request could not reach the server. Check your connection and try again.");
      }
    });
  };

  const handleRemove = () => {
    startRemoveTransition(async () => {
      try {
        const res = await removeProfilePicture();
        if (res.success) {
          setPreviewUrl(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          onShowToast("Profile photo removed.");
        } else if (res.error) {
          onShowToast(res.error);
        }
      } catch (error) {
        console.error("Profile picture removal request failed", {
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        onShowToast("The request could not reach the server. Check your connection and try again.");
      }
    });
  };

  const displayImage = pending && previewUrl ? previewUrl : currentImage;

  return (
    <form ref={formRef} onSubmit={handleUpload} className="flex flex-col gap-5 sm:flex-row sm:items-center">
      {/* Avatar Preview */}
      <ProfilePhoto
        image={displayImage}
        name={name}
        userId={userId}
        size={80}
      />

      {/* Upload Controls */}
      <div className="min-w-0 flex-1 space-y-2">
        <FileDropzone
          name="photo"
          inputRef={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          disabled={pending || isRemoving}
          title={pending ? "Uploading profile photo…" : "Drop a profile photo here, or browse"}
          description="JPG, PNG, or WebP up to 1.5MB. Square crop recommended (at least 400×400px)."
          onFiles={handleFileChange}
        />
        <div className="flex flex-wrap items-center gap-2.5">
          {currentImage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || isRemoving}
              onClick={handleRemove}
              className="gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 dark:text-rose-400"
            >
              <Trash2 className="size-3.5" />
              <span>{isRemoving ? "Removing..." : "Remove Photo"}</span>
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function NameForm({
  initialName,
  onShowToast,
}: {
  initialName: string;
  onShowToast: (msg: string) => void;
}) {
  const [state, formAction, pending] = useActionState(updateProfileName, initialFormState);

  useEffect(() => {
    if (state.success) {
      onShowToast(state.success);
    } else if (state.error) {
      onShowToast(state.error);
    }
  }, [state, onShowToast]);

  return (
    <form action={formAction} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto] max-w-lg">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label htmlFor="profile-name" className="text-xs">Full Name</Label>
        <Input
          id="profile-name"
          name="name"
          type="text"
          autoComplete="name"
          defaultValue={initialName}
          maxLength={80}
          required
          className="text-xs min-h-10"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending} className="text-xs font-semibold min-h-10">
        {pending ? "Saving…" : "Save Name"}
      </Button>
    </form>
  );
}

function ProfilePhoto({
  image,
  name,
  userId,
  size,
}: {
  image: string | null;
  name: string | null;
  userId: string;
  size: number;
}) {
  const initials = name?.trim().slice(0, 1).toUpperCase() || "?";
  const imgSrc = getProfileImageSrc(image, userId);

  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10 font-bold text-primary shadow-xs"
      style={{ width: size, height: size }}
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={name || "User avatar"}
          className="size-full object-cover"
        />
      ) : (
        initials
      )}
    </span>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.09-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.15a11 11 0 0 0 0 9.9l3.69-2.84Z" />
      <path fill="#EA4335" d="M12 4.36c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0a11 11 0 0 0-9.85 7.05l3.69 2.84C6.71 7.29 9.14 4.36 12 4.36Z" />
    </svg>
  );
}
