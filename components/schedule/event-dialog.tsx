"use client";

import { useCallback, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
  checkScheduleConflicts,
} from "@/app/actions/schedule";
import { ScheduleEventType } from "@/generated/prisma/browser";
import {
  LOCATION_PRESET_LABELS,
  SCHEDULE_EVENT_TYPE_LABELS,
  formatScheduleEnumLabel,
} from "@/components/schedule/labels";
import { type ScheduleConflictWarning } from "@/lib/schedule";
import {
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";

export const LOCATION_PRESETS = [
  "Main Studio Bay",
  "Cyc Wall / Studio B",
  "Audio & Edit Suite",
  "On Location",
  "Remote / Client Site",
];

export interface ScheduleEventFormData {
  id?: string;
  title: string;
  description?: string | null;
  eventType: ScheduleEventType;
  startAt: string; // ISO string
  endAt: string; // ISO string
  allDay: boolean;
  location?: string | null;
  projectId?: string | null;
  assigneeIds: string[];
}

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: ScheduleEventFormData | null;
  projects: Array<{ id: string; name: string }>;
  workers: Array<{ id: string; name: string | null; email: string }>;
  onSuccess?: () => void;
}

export function EventDialog({
  open,
  onOpenChange,
  initialData,
  projects,
  workers,
  onSuccess,
}: EventDialogProps) {
  const isEditing = Boolean(initialData?.id);

  // Form state
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [eventType, setEventType] = useState<ScheduleEventType>(
    initialData?.eventType || ScheduleEventType.SHOOT
  );
  const [allDay, setAllDay] = useState(initialData?.allDay || false);
  const [startDate, setStartDate] = useState(() => {
    if (initialData?.startAt) {
      return initialData.startAt.slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [startTime, setStartTime] = useState(() => {
    if (initialData?.startAt && !initialData.allDay) {
      return initialData.startAt.slice(11, 16);
    }
    return "09:00";
  });
  const [endDate, setEndDate] = useState(() => {
    if (initialData?.endAt) {
      return initialData.endAt.slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [endTime, setEndTime] = useState(() => {
    if (initialData?.endAt && !initialData.allDay) {
      return initialData.endAt.slice(11, 16);
    }
    return "17:00";
  });

  const [locationPreset, setLocationPreset] = useState(() => {
    if (!initialData?.location) return "Main Studio Bay";
    if (LOCATION_PRESETS.includes(initialData.location)) {
      return initialData.location;
    }
    return "custom";
  });
  const [customLocation, setCustomLocation] = useState(() => {
    if (initialData?.location && !LOCATION_PRESETS.includes(initialData.location)) {
      return initialData.location;
    }
    return "";
  });

  const [projectId, setProjectId] = useState<string>(
    initialData?.projectId || "NONE"
  );
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>(
    initialData?.assigneeIds || []
  );

  const [warnings, setWarnings] = useState<ScheduleConflictWarning[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Construct effective start and end dates
  const buildTimestamps = useCallback(() => {
    if (allDay) {
      const s = new Date(`${startDate}T00:00:00Z`);
      const e = new Date(`${endDate}T23:59:59.999Z`);
      return { startAt: s, endAt: e };
    }
    const s = new Date(`${startDate}T${startTime}:00Z`);
    const e = new Date(`${endDate}T${endTime}:00Z`);
    return { startAt: s, endAt: e };
  }, [allDay, endDate, endTime, startDate, startTime]);

  const getEffectiveLocation = useCallback(() => {
    if (locationPreset === "custom") {
      return customLocation.trim() || null;
    }
    return locationPreset;
  }, [customLocation, locationPreset]);

  // Debounced conflict check
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(async () => {
      try {
        const { startAt, endAt } = buildTimestamps();
        if (endAt < startAt) {
          setWarnings([]);
          return;
        }

        const res = await checkScheduleConflicts({
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          location: getEffectiveLocation(),
          assigneeIds: selectedWorkerIds,
          excludeEventId: initialData?.id || null,
        });

        if (res.conflicts) {
          setWarnings(res.conflicts);
        }
      } catch {
        // silent fail on auto-check
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [
    open,
    startDate,
    startTime,
    endDate,
    endTime,
    allDay,
    locationPreset,
    customLocation,
    selectedWorkerIds,
    initialData?.id,
    buildTimestamps,
    getEffectiveLocation,
  ]);

  const toggleWorker = (id: string) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(id) ? prev.filter((wId) => wId !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Event title is required.");
      return;
    }

    const { startAt, endAt } = buildTimestamps();
    if (endAt.getTime() < startAt.getTime()) {
      setError("End time must be equal to or later than start time.");
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        eventType,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        allDay,
        location: getEffectiveLocation(),
        projectId: projectId !== "NONE" ? projectId : null,
        assigneeIds: selectedWorkerIds,
      };

      let res;
      if (isEditing && initialData?.id) {
        res = await updateScheduleEvent({
          id: initialData.id,
          ...payload,
        });
      } else {
        res = await createScheduleEvent(payload);
      }

      if (res.error) {
        setError(res.error);
      } else {
        onOpenChange(false);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule event.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    setIsDeleting(true);
    setError(null);

    try {
      const res = await deleteScheduleEvent({ id: initialData.id });
      if (res.error) {
        setError(res.error);
      } else {
        onOpenChange(false);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-4">
            <DialogTitle>
              {isEditing ? "Edit Schedule Event" : "Book Studio Shoot or Event"}
            </DialogTitle>
            <DialogDescription>
              Schedule shoots, crew call times, and physical studio bay bookings.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mb-4 space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Scheduling Overlap Detected:</span>
              </div>
              <ul className="list-disc pl-4 space-y-0.5 mt-1">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w.message}</li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground pt-1">
                You can still confirm this booking to override the conflict.
              </p>
            </div>
          )}

          <div className="space-y-4 text-xs">
            {/* Title & Event Type */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Nike Summer Campaign Shoot, Studio Bay A Maintenance"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="eventType">Event Category</Label>
                <Select
                  value={eventType}
                  onValueChange={(val) => val && setEventType(val as ScheduleEventType)}
                >
                  <SelectTrigger id="eventType" className="h-9 w-full min-w-0 text-xs">
                    <SelectValue>
                      {(value: ScheduleEventType | null) =>
                        value ? SCHEDULE_EVENT_TYPE_LABELS[value] : "Select category"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ScheduleEventType.SHOOT}>Photo/Video Shoot</SelectItem>
                    <SelectItem value={ScheduleEventType.STUDIO_BOOKING}>Studio Booking / Bay Hold</SelectItem>
                    <SelectItem value={ScheduleEventType.CLIENT_MEETING}>Client Review / Meeting</SelectItem>
                    <SelectItem value={ScheduleEventType.MAINTENANCE}>Maintenance & Prep</SelectItem>
                    <SelectItem value={ScheduleEventType.DEADLINE}>Studio Milestone</SelectItem>
                    <SelectItem value={ScheduleEventType.OTHER}>Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="projectId">Associated Project (Optional)</Label>
                <Select
                  value={projectId}
                  onValueChange={(val) => val && setProjectId(val)}
                >
                  <SelectTrigger id="projectId" className="h-9 w-full min-w-0 text-xs">
                    <SelectValue>
                      {(value: string | null) =>
                        !value || value === "NONE"
                          ? "None (Internal Studio Event)"
                          : projects.find((project) => project.id === value)?.name ?? "Project unavailable"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None (Internal Studio Event)</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date & Time Settings */}
            <div className="rounded-md border border-border p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Date & Duration</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  <span className="text-muted-foreground">All day event</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="startDate">Start</Label>
                  <div className="flex gap-2">
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-8 text-xs flex-1"
                      required
                    />
                    {!allDay && (
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="h-8 text-xs w-24"
                        required
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="endDate">End</Label>
                  <div className="flex gap-2">
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-8 text-xs flex-1"
                      required
                    />
                    {!allDay && (
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="h-8 text-xs w-24"
                        required
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label htmlFor="location">Studio Location / Space</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select
                  value={locationPreset}
                  onValueChange={(val) => val && setLocationPreset(val)}
                >
                  <SelectTrigger id="location" className="h-9 w-full min-w-0 text-xs">
                    <SelectValue>
                      {(value: string | null) =>
                        value
                          ? LOCATION_PRESET_LABELS[value] ??
                            LOCATION_PRESETS.find((preset) => preset === value) ??
                            formatScheduleEnumLabel(value)
                          : LOCATION_PRESETS[0]
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_PRESETS.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom Location / Address...</SelectItem>
                  </SelectContent>
                </Select>

                {locationPreset === "custom" && (
                  <Input
                    placeholder="Enter custom location or shoot venue..."
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    className="h-9 w-full min-w-0 text-xs"
                  />
                )}
              </div>
            </div>

            {/* Crew Assignees */}
            <div className="space-y-1.5">
              <Label>Assigned Crew & Workers</Label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto rounded-md border border-border p-2 bg-background">
                {workers.length === 0 ? (
                  <span className="text-muted-foreground text-[11px]">No active workers available.</span>
                ) : (
                  workers.map((worker) => {
                    const isSelected = selectedWorkerIds.includes(worker.id);
                    return (
                      <button
                        key={worker.id}
                        type="button"
                        onClick={() => toggleWorker(worker.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors border ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/40 text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        <span>{worker.name || worker.email}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Description / Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Shoot Details & Call Notes</Label>
              <Textarea
                id="description"
                placeholder="Include call times, gear requirements, client contact info, or moodboard references..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
            {isEditing ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting || isLoading}
                className="text-xs mr-auto gap-1"
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </Button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isLoading || isDeleting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || isDeleting}
                className="text-xs"
              >
                {isLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {warnings.length > 0
                  ? isEditing
                    ? "Update Event (With Conflict)"
                    : "Book Event (With Conflict)"
                  : isEditing
                  ? "Save Changes"
                  : "Book Event"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
