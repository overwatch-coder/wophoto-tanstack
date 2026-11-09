import { useState, useTransition, useMemo } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  ScheduleEventType,
  TaskStatus,
  TaskPriority,
} from "@/generated/prisma/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  EventDialog,
  type ScheduleEventFormData,
} from "@/components/schedule/event-dialog";
import { getProfileImageSrc } from "@/lib/profile-image";
import { SCHEDULE_EVENT_TYPE_LABELS, TASK_STATUS_LABELS } from "@/components/schedule/labels";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  CheckSquare,
  Search,
} from "lucide-react";

export interface SerializedScheduleEvent {
  id: string;
  title: string;
  description: string | null;
  eventType: ScheduleEventType;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string | null;
  projectId: string | null;
  project: { id: string; name: string } | null;
  createdBy: { id: string; name: string | null; email: string };
  assignees: Array<{
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  }>;
}

export interface SerializedTaskDeadline {
  id: string;
  title: string;
  dueAt: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string | null;
  projectName: string | null;
  assignees: Array<{
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  }>;
}

interface ScheduleWorkspaceProps {
  initialEvents: SerializedScheduleEvent[];
  initialTaskDeadlines: SerializedTaskDeadline[];
  projects: Array<{ id: string; name: string }>;
  workers: Array<{ id: string; name: string | null; email: string }>;
  isManager: boolean;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ScheduleWorkspace({
  initialEvents,
  initialTaskDeadlines,
  projects,
  workers,
  isManager,
}: ScheduleWorkspaceProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Active view state
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Filter state
  const [showTaskDeadlines, setShowTaskDeadlines] = useState(true);
  const [selectedEventType, setSelectedEventType] = useState<string>("ALL");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog state
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEventFormData | null>(null);
  const [inspectItem, setInspectItem] = useState<
    | { type: "EVENT"; data: SerializedScheduleEvent }
    | { type: "TASK"; data: SerializedTaskDeadline }
    | null
  >(null);

  // Navigation handlers
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handlePrev = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "month") d.setMonth(d.getMonth() - 1);
      else if (viewMode === "week") d.setDate(d.getDate() - 7);
      else d.setDate(d.getDate() - 1);
      return d;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "month") d.setMonth(d.getMonth() + 1);
      else if (viewMode === "week") d.setDate(d.getDate() + 7);
      else d.setDate(d.getDate() + 1);
      return d;
    });
  };

  const handleOpenCreateForDate = (date: Date) => {
    if (!isManager) return;
    const dateStr = date.toISOString().slice(0, 10);
    setEditingEvent({
      title: "",
      eventType: ScheduleEventType.SHOOT,
      startAt: `${dateStr}T09:00:00Z`,
      endAt: `${dateStr}T17:00:00Z`,
      allDay: false,
      assigneeIds: [],
    });
    setEventDialogOpen(true);
  };

  const handleOpenEdit = (event: SerializedScheduleEvent) => {
    if (isManager) {
      setEditingEvent({
        id: event.id,
        title: event.title,
        description: event.description,
        eventType: event.eventType,
        startAt: event.startAt,
        endAt: event.endAt,
        allDay: event.allDay,
        location: event.location,
        projectId: event.projectId,
        assigneeIds: event.assignees.map((a) => a.id),
      });
      setEventDialogOpen(true);
    } else {
      setInspectItem({ type: "EVENT", data: event });
    }
  };

  // Filter items
  const filteredEvents = useMemo(() => {
    return initialEvents.filter((ev) => {
      if (selectedEventType !== "ALL" && ev.eventType !== selectedEventType) {
        return false;
      }
      if (selectedProjectId !== "ALL" && ev.projectId !== selectedProjectId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesLocation = ev.location?.toLowerCase().includes(q) || false;
        const matchesProject = ev.project?.name.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesLocation && !matchesProject) return false;
      }
      return true;
    });
  }, [initialEvents, selectedEventType, selectedProjectId, searchQuery]);

  const filteredTasks = useMemo(() => {
    if (!showTaskDeadlines) return [];
    return initialTaskDeadlines.filter((task) => {
      if (selectedProjectId !== "ALL" && task.projectId !== selectedProjectId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesProject = task.projectName?.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesProject) return false;
      }
      return true;
    });
  }, [initialTaskDeadlines, showTaskDeadlines, selectedProjectId, searchQuery]);

  // Compute month grid days
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDay.getDay(); // 0 for Sunday
    const daysInMonth = lastDay.getDate();

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = new Date().toDateString();

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: d.toDateString() === todayStr,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({
        date: d,
        isCurrentMonth: true,
        isToday: d.toDateString() === todayStr,
      });
    }

    // Next month padding to fill complete grid weeks
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: d.toDateString() === todayStr,
      });
    }

    return days;
  }, [currentDate]);

  // Week days
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const dayOfWeek = d.getDay();
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - dayOfWeek);

    const todayStr = new Date().toDateString();
    const days: Array<{ date: Date; isToday: boolean }> = [];

    for (let i = 0; i < 7; i++) {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + i);
      days.push({
        date: day,
        isToday: day.toDateString() === todayStr,
      });
    }

    return days;
  }, [currentDate]);

  // Helper: check if event lands on a given date (UTC date comparison)
  const getItemsForDate = (date: Date) => {
    const targetDateStr = date.toISOString().slice(0, 10);

    const eventsOnDate = filteredEvents.filter((ev) => {
      const startStr = ev.startAt.slice(0, 10);
      const endStr = ev.endAt.slice(0, 10);
      return targetDateStr >= startStr && targetDateStr <= endStr;
    });

    const tasksOnDate = filteredTasks.filter((task) => {
      const dueStr = task.dueAt.slice(0, 10);
      return targetDateStr === dueStr;
    });

    return { events: eventsOnDate, tasks: tasksOnDate };
  };

  const getEventTypeColor = (type: ScheduleEventType) => {
    switch (type) {
      case ScheduleEventType.SHOOT:
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case ScheduleEventType.STUDIO_BOOKING:
        return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case ScheduleEventType.CLIENT_MEETING:
        return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20";
      case ScheduleEventType.MAINTENANCE:
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case ScheduleEventType.DEADLINE:
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const formatHeaderTitle = () => {
    if (viewMode === "month") {
      return currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
    if (viewMode === "week") {
      const first = weekDays[0]?.date;
      const last = weekDays[6]?.date;
      if (!first || !last) return "";
      return `${first.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${last.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return currentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const refreshWorkspace = () => {
    startTransition(() => {
      router.invalidate();
    });
  };

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Studio Schedule
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Coordinate studio bays, photo & video shoots, crew call times, and task milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isManager && (
            <Button
              size="sm"
              onClick={() => {
                setEditingEvent(null);
                setEventDialogOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Book Shoot or Event</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Navigation Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Calendar Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="h-8 text-xs font-medium"
            >
              Today
            </Button>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                className="h-8 w-8 p-0"
                aria-label="Previous time window"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNext}
                className="h-8 w-8 p-0"
                aria-label="Next time window"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <span className="text-sm font-semibold text-foreground px-2">
              {formatHeaderTitle()}
            </span>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === "month"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === "week"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === "day"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Day / Agenda
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60 text-xs">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search schedule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-7 text-xs"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value={ScheduleEventType.SHOOT}>Photo & Video Shoots</option>
            <option value={ScheduleEventType.STUDIO_BOOKING}>Studio Bay Holds</option>
            <option value={ScheduleEventType.CLIENT_MEETING}>Client Meetings</option>
            <option value={ScheduleEventType.MAINTENANCE}>Maintenance & Prep</option>
            <option value={ScheduleEventType.DEADLINE}>Studio Milestones</option>
          </select>

          {/* Project Filter */}
          {projects.length > 0 && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none"
            >
              <option value="ALL">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {/* Task Deadlines Toggle */}
          <button
            type="button"
            onClick={() => setShowTaskDeadlines((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
              showTaskDeadlines
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            <CheckSquare className="h-3 w-3" />
            <span>Task Deadlines</span>
          </button>
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === "month" && (
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-xs font-semibold text-muted-foreground py-2">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Month grid days */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border">
            {monthDays.map((dayObj, idx) => {
              const { events, tasks } = getItemsForDate(dayObj.date);
              const hasItems = events.length > 0 || tasks.length > 0;

              return (
                <div
                  key={idx}
                  onClick={() => isManager && handleOpenCreateForDate(dayObj.date)}
                  className={`min-h-[88px] p-1 sm:min-h-[110px] sm:p-1.5 flex flex-col justify-start sm:justify-between transition-colors ${
                    dayObj.isCurrentMonth
                      ? "bg-card hover:bg-muted/20"
                      : "bg-muted/10 text-muted-foreground/60"
                  } ${isManager ? "cursor-pointer" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        dayObj.isToday
                          ? "bg-primary text-primary-foreground font-bold"
                          : dayObj.isCurrentMonth
                          ? "text-foreground"
                          : "text-muted-foreground/50"
                      }`}
                    >
                      {dayObj.date.getDate()}
                    </span>

                    {hasItems && (
                      <span className="hidden text-[10px] text-muted-foreground font-medium sm:inline">
                        {events.length + tasks.length}
                      </span>
                    )}
                  </div>

                  {/* On phones, a date cell is too narrow for readable event titles.
                      Show a clear activity summary that opens the full day agenda. */}
                  {hasItems && (
                    <button
                      type="button"
                      aria-label={`View ${events.length + tasks.length} scheduled ${events.length + tasks.length === 1 ? "item" : "items"} on ${dayObj.date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentDate(dayObj.date);
                        setViewMode("day");
                      }}
                      className="mt-1 flex min-h-9 w-full items-center gap-1 rounded-md border border-border bg-muted/30 px-1 text-left text-[10px] font-medium leading-tight text-foreground sm:hidden"
                    >
                      <span className="flex shrink-0 items-center -space-x-1">
                        {events.length > 0 && <span className="h-2 w-2 rounded-full bg-sky-500 ring-1 ring-card" />}
                        {tasks.length > 0 && <span className="h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-card" />}
                      </span>
                      <span className="text-[11px] font-semibold tabular-nums">
                        {events.length + tasks.length}
                      </span>
                    </button>
                  )}

                  {/* Event & Task Chips: retain titles where each cell has enough width. */}
                  <div className="mt-1 hidden space-y-1 overflow-hidden sm:block">
                    {events.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(ev);
                        }}
                        className={`w-full text-left truncate rounded px-1.5 py-0.5 text-[10px] font-medium border transition-opacity hover:opacity-80 block ${getEventTypeColor(
                          ev.eventType
                        )}`}
                      >
                        <span className="font-semibold">{ev.title}</span>
                        {ev.location && ` • ${ev.location}`}
                      </button>
                    ))}

                    {tasks.slice(0, 2).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectItem({ type: "TASK", data: t });
                        }}
                        className="w-full text-left truncate rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 hover:opacity-80 block"
                      >
                        <span className="flex items-center gap-1">
                          <CheckSquare className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{t.title}</span>
                        </span>
                      </button>
                    ))}

                    {events.length + tasks.length > 5 && (
                      <span className="text-[10px] text-muted-foreground pl-1">
                        +{events.length + tasks.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === "week" && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((dayObj, idx) => {
            const { events, tasks } = getItemsForDate(dayObj.date);

            return (
              <div
                key={idx}
                className={`rounded-lg border border-border bg-card p-3 flex flex-col min-h-[320px] ${
                  dayObj.isToday ? "ring-2 ring-primary/40" : ""
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-border mb-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {DAYS_OF_WEEK[dayObj.date.getDay()]}
                    </p>
                    <p
                      className={`text-lg font-bold ${
                        dayObj.isToday ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {dayObj.date.getDate()}
                    </p>
                  </div>
                  {isManager && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenCreateForDate(dayObj.date)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      aria-label="Add event"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto">
                  {events.length === 0 && tasks.length === 0 ? (
                    <div className="flex items-center justify-center h-28 text-muted-foreground/50 text-[11px]">
                      No events
                    </div>
                  ) : (
                    <>
                      {events.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => handleOpenEdit(ev)}
                          className={`p-2 rounded-md border text-xs cursor-pointer hover:shadow-xs transition-shadow ${getEventTypeColor(
                            ev.eventType
                          )}`}
                        >
                          <p className="font-semibold line-clamp-1">{ev.title}</p>
                          <div className="flex items-center gap-1 text-[10px] mt-1 opacity-80">
                            <Clock className="h-3 w-3" />
                            {ev.allDay
                              ? "All Day"
                              : `${ev.startAt.slice(11, 16)} - ${ev.endAt.slice(11, 16)}`}
                          </div>
                          {ev.location && (
                            <p className="text-[10px] mt-0.5 opacity-80 flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5" />
                              <span className="truncate">{ev.location}</span>
                            </p>
                          )}
                        </div>
                      ))}

                      {tasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setInspectItem({ type: "TASK", data: t })}
                          className="p-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs cursor-pointer hover:shadow-xs"
                        >
                          <p className="font-semibold line-clamp-1 flex items-center gap-1">
                            <CheckSquare className="h-3 w-3 shrink-0" />
                            {t.title}
                          </p>
                          <p className="text-[10px] opacity-80 mt-1">
                            Task Deadline {t.projectName ? `• ${t.projectName}` : ""}
                          </p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DAY / AGENDA VIEW */}
      {viewMode === "day" && (() => {
        const { events, tasks } = getItemsForDate(currentDate);

        return (
          <div className="rounded-lg border border-border bg-card p-3 sm:p-4 space-y-4 shadow-xs">
            <div className="flex flex-col items-stretch gap-3 pb-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="break-words text-sm font-semibold text-foreground sm:text-base">
                  {currentDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {events.length} schedule booking{events.length === 1 ? "" : "s"},{" "}
                  {tasks.length} task deadline{tasks.length === 1 ? "" : "s"}
                </p>
              </div>

              {isManager && (
                <Button
                  size="sm"
                  onClick={() => handleOpenCreateForDate(currentDate)}
                  className="h-9 w-full text-xs gap-1 sm:h-8 sm:w-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Book on this Day
                </Button>
              )}
            </div>

            {events.length === 0 && tasks.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-xs">
                No events or task deadlines scheduled for this day.
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => handleOpenEdit(ev)}
                    className="min-w-0 p-3 rounded-lg border border-border bg-muted/10 hover:bg-muted/30 transition-colors cursor-pointer flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getEventTypeColor(
                            ev.eventType
                          )}`}
                        >
                          {SCHEDULE_EVENT_TYPE_LABELS[ev.eventType]}
                        </span>
                        <h4 className="min-w-0 break-words font-semibold text-sm text-foreground">{ev.title}</h4>
                      </div>

                      <div className="flex min-w-0 flex-col items-start gap-y-2 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
                        <span className="flex min-w-0 items-start gap-1 break-words">
                          <Clock className="h-3.5 w-3.5" />
                          {ev.allDay
                            ? "All Day Event"
                            : `${ev.startAt.slice(11, 16)} – ${ev.endAt.slice(11, 16)} UTC`}
                        </span>
                        {ev.location && (
                          <span className="flex min-w-0 items-start gap-1 break-words">
                            <MapPin className="h-3.5 w-3.5" />
                            {ev.location}
                          </span>
                        )}
                        {ev.project && (
                          <span className="min-w-0 break-words text-foreground/80 font-medium">
                            Project: {ev.project.name}
                          </span>
                        )}
                      </div>

                      {ev.description && (
                        <p className="break-words text-xs text-muted-foreground pt-1">{ev.description}</p>
                      )}
                    </div>

                    {/* Assignees */}
                    {ev.assignees.length > 0 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {ev.assignees.map((worker) => {
                          const src = getProfileImageSrc(worker.image, worker.id);
                          return (
                            <div
                              key={worker.id}
                              title={worker.name || worker.email}
                              className="relative h-6 w-6 rounded-full overflow-hidden bg-primary/10 border border-border flex items-center justify-center text-[10px] font-bold text-primary"
                            >
                              {src ? (
                                <img
                                  src={src}
                                  alt={worker.name || "Worker"}
                                  className="size-full object-cover"
                                />
                              ) : (
                                (worker.name || worker.email)[0].toUpperCase()
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setInspectItem({ type: "TASK", data: task })}
                    className="min-w-0 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors cursor-pointer flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                          TASK DEADLINE
                        </span>
                        <h4 className="min-w-0 break-words font-semibold text-sm text-foreground">{task.title}</h4>
                      </div>

                      <div className="flex min-w-0 flex-col items-start gap-y-2 text-xs text-muted-foreground min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:gap-x-3">
                        <span>Due Date: {new Date(task.dueAt).toLocaleDateString()}</span>
                        {task.projectName && (
                          <span className="min-w-0 break-words text-foreground font-medium">
                            Project: {task.projectName}
                          </span>
                        )}
                        <span>Priority: {task.priority.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Event Dialog for Create / Edit */}
      {isManager && eventDialogOpen && (
        <EventDialog
          open={eventDialogOpen}
          onOpenChange={setEventDialogOpen}
          initialData={editingEvent}
          projects={projects}
          workers={workers}
          onSuccess={refreshWorkspace}
        />
      )}

      {/* Inspect Item Dialog for Read-Only Inspection */}
      <Dialog
        open={Boolean(inspectItem)}
        onOpenChange={(open) => !open && setInspectItem(null)}
      >
        <DialogContent className="sm:max-w-md">
          {inspectItem?.type === "EVENT" && (
            <div>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getEventTypeColor(
                      inspectItem.data.eventType
                    )}`}
                  >
                    {SCHEDULE_EVENT_TYPE_LABELS[inspectItem.data.eventType]}
                  </span>
                </div>
                <DialogTitle className="mt-1">{inspectItem.data.title}</DialogTitle>
                <DialogDescription>
                  {inspectItem.data.location || "Studio Event"}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {inspectItem.data.allDay
                      ? "All Day"
                      : `${inspectItem.data.startAt.slice(11, 16)} – ${inspectItem.data.endAt.slice(11, 16)} UTC`}
                  </span>
                </div>

                {inspectItem.data.project && (
                  <p className="text-muted-foreground">
                    Project: <span className="font-medium text-foreground">{inspectItem.data.project.name}</span>
                  </p>
                )}

                {inspectItem.data.description && (
                  <div className="rounded-md bg-muted/40 p-2.5">
                    <p className="font-medium text-muted-foreground mb-1">Notes & Details:</p>
                    <p className="text-foreground whitespace-pre-wrap">{inspectItem.data.description}</p>
                  </div>
                )}

                {inspectItem.data.assignees?.length > 0 && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1.5">Scheduled Crew:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {inspectItem.data.assignees.map((assignee) => (
                        <span key={assignee.id} className="px-2 py-0.5 rounded-full bg-muted text-[11px] font-medium">
                          {assignee.name || assignee.email}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {inspectItem?.type === "TASK" && (
            <div>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-emerald-500" />
                  {inspectItem.data.title}
                </DialogTitle>
                <DialogDescription>
                  Project Task Deliverable
                </DialogDescription>
              </DialogHeader>
              <div className="mt-3 space-y-2 text-xs">
                <p>
                  <span className="text-muted-foreground">Project:</span>{" "}
                  <span className="font-medium">{inspectItem.data.projectName || "General"}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Due Date:</span>{" "}
                  <span className="font-medium">{inspectItem.data.dueAt.slice(0, 10)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className="font-medium">
                    {TASK_STATUS_LABELS[inspectItem.data.status]}
                  </span>
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
