import { useEffect, useRef, useState, useTransition } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Mail,
  Search,
  AlertTriangle,
  RotateCcw,
  MessageSquare,
  ClipboardCheck,
  UserCheck,
  CheckCircle2,
  ShieldAlert,
  Calendar,
  Layers,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  getNotificationPageAction,
} from "@/app/actions/notifications";
import type { NotificationFilterMode, NotificationItemView } from "@/lib/notifications";
import type { NotificationType } from "@/generated/prisma/browser";
import { useDebounce } from "@uidotdev/usehooks";

export function NotificationsWorkspace({
  initialNotifications = [],
  initialHasMore = false,
  initialCursor = null,
  initialCounts = { all: 0, unread: 0, actionRequired: 0, emailSent: 0, unreadActionRequired: 0, unreadUpdates: 0 },
}: {
  initialNotifications: NotificationItemView[];
  initialHasMore: boolean;
  initialCursor: string | null;
  initialCounts: {
    all: number;
    unread: number;
    actionRequired: number;
    emailSent: number;
    unreadActionRequired: number;
    unreadUpdates: number;
  };
}) {
  const [notifications, setNotifications] = useState<NotificationItemView[]>(initialNotifications);
  const [filterMode, setFilterMode] = useState<NotificationFilterMode>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState(initialCursor);
  const [counts, setCounts] = useState(initialCounts);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setNotifications(initialNotifications);
    setCounts(initialCounts);
    setHasMore(initialHasMore);
    setNextCursor(initialCursor);
  }, [initialNotifications, initialCounts, initialHasMore, initialCursor]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentTime] = useState(() => Date.now());
  const [, startTransition] = useTransition();
  const requestVersion = useRef(0);
  const seenNotificationIds = useRef(new Set(initialNotifications.map((item) => item.id)));
  const lastQueryKey = useRef("ALL\u0000");
  const activeFilterRef = useRef({ query: "", filterMode: "ALL" as NotificationFilterMode });

  useEffect(() => {
    activeFilterRef.current = { query: debouncedSearchQuery.trim(), filterMode };
    const queryKey = `${filterMode}\u0000${debouncedSearchQuery.trim()}`;
    if (queryKey === lastQueryKey.current) return;
    lastQueryKey.current = queryKey;
    const version = ++requestVersion.current;
    setLoadingMore(true);
    setLoadError(null);

    void getNotificationPageAction({ query: debouncedSearchQuery, filterMode }).then((result) => {
      if (requestVersion.current !== version) return;
      if ("error" in result) {
        setLoadError(result.error);
        return;
      }
      setNotifications(result.items);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    }).finally(() => {
      if (requestVersion.current === version) setLoadingMore(false);
    });
  }, [debouncedSearchQuery, filterMode]);

  // Listen to real-time notifications arriving on this page
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    function connectSSE() {
      try {
        eventSource = new EventSource("/api/notifications/stream");

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === "NEW_NOTIFICATION" && data.notification) {
              const incoming = data.notification as NotificationItemView;
              if (seenNotificationIds.current.has(incoming.id)) return;
              seenNotificationIds.current.add(incoming.id);
              const { query, filterMode: activeMode } = activeFilterRef.current;
              const matchesSearch = !query || [incoming.title, incoming.message, incoming.projectName]
                .some((value) => value?.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
              const matchesMode = activeMode === "ALL" ||
                (activeMode === "UNREAD" && !incoming.read) ||
                (activeMode === "ACTION_REQUIRED" && incoming.category === "ACTION_REQUIRED");
              if (matchesSearch && matchesMode) {
                setNotifications((prev) => prev.some((item) => item.id === incoming.id)
                  ? prev
                  : [incoming, ...prev]);
              }
              setCounts((prev) => ({
                ...prev,
                all: prev.all + 1,
                unread: incoming.read ? prev.unread : prev.unread + 1,
                actionRequired: incoming.category === "ACTION_REQUIRED" ? prev.actionRequired + 1 : prev.actionRequired,
                emailSent: incoming.channels.email ? prev.emailSent + 1 : prev.emailSent,
                unreadActionRequired: incoming.category === "ACTION_REQUIRED" && !incoming.read
                  ? prev.unreadActionRequired + 1
                  : prev.unreadActionRequired,
                unreadUpdates: incoming.category !== "ACTION_REQUIRED" && !incoming.read
                  ? prev.unreadUpdates + 1
                  : prev.unreadUpdates,
              }));
            } else if (data.event === "UNREAD_COUNTS" && typeof data.unread === "number") {
              setCounts((prev) => ({
                ...prev,
                unread: data.unread,
                unreadActionRequired: data.actionRequired,
                unreadUpdates: data.updates,
              }));
            } else if (data.event === "NOTIFICATION_READ" && typeof data.notificationId === "string") {
              setNotifications((prev) => prev.map((item) => (
                item.id === data.notificationId ? { ...item, read: true } : item
              )));
            } else if (data.event === "ALL_NOTIFICATIONS_READ") {
              setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
            }
          } catch {
            // Ignore non-json heartbeats
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          retryTimeout = setTimeout(connectSSE, 5000);
        };
      } catch (err) {
        console.warn("[sse] EventSource connection failed:", err);
      }
    }

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  const handleMarkItemRead = (id: string) => {
    const item = notifications.find((notification) => notification.id === id);
    if (!item || item.read) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setCounts((prev) => ({
      ...prev,
      unread: Math.max(0, prev.unread - 1),
      unreadActionRequired: item.category === "ACTION_REQUIRED"
        ? Math.max(0, prev.unreadActionRequired - 1)
        : prev.unreadActionRequired,
      unreadUpdates: item.category !== "ACTION_REQUIRED"
        ? Math.max(0, prev.unreadUpdates - 1)
        : prev.unreadUpdates,
    }));
    startTransition(async () => {
      await markNotificationReadAction(id);
    });
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setCounts((prev) => ({ ...prev, unread: 0, unreadActionRequired: 0, unreadUpdates: 0 }));
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  };

  const filteredNotifications = notifications;

  const handleLoadMore = () => {
    if (!nextCursor || loadingMore) return;
    const version = ++requestVersion.current;
    setLoadingMore(true);
    setLoadError(null);
    void getNotificationPageAction({
      cursor: nextCursor,
      query: debouncedSearchQuery,
      filterMode,
    }).then((result) => {
      if (requestVersion.current !== version) return;
      if ("error" in result) {
        setLoadError(result.error);
        return;
      }
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        return [...prev, ...result.items.filter((item) => !existingIds.has(item.id))];
      });
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    }).finally(() => {
      if (requestVersion.current === version) setLoadingMore(false);
    });
  };

  // Timeline segmentation helper
  const getTimelineBucket = (createdAt: string) => {
    const diffMs = currentTime - new Date(createdAt).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 24) return "TODAY";
    if (diffHours < 48) return "YESTERDAY";
    if (diffHours < 168) return "LAST_7_DAYS";
    return "OLDER";
  };

  const todayList = filteredNotifications.filter((n) => getTimelineBucket(n.createdAt) === "TODAY");
  const yesterdayList = filteredNotifications.filter((n) => getTimelineBucket(n.createdAt) === "YESTERDAY");
  const last7DaysList = filteredNotifications.filter((n) => getTimelineBucket(n.createdAt) === "LAST_7_DAYS");
  const olderList = filteredNotifications.filter((n) => getTimelineBucket(n.createdAt) === "OLDER");

  const renderNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "FEEDBACK_RECEIVED":
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <MessageSquare className="size-4" />
          </div>
        );
      case "FEEDBACK_RESOLVED":
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" />
          </div>
        );
      case "REVISION_DELEGATED":
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <RotateCcw className="size-4" />
          </div>
        );
      case "TASK_REVIEW_READY":
      case "REVISION_SUBMITTED":
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <ClipboardCheck className="size-4" />
          </div>
        );
      case "DEADLINE_APPROACHING":
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="size-4" />
          </div>
        );
      case "TASK_APPROVED":
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" />
          </div>
        );
      case "TASK_ASSIGNED":
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserCheck className="size-4" />
          </div>
        );
      case "SYSTEM_ALERT":
      default:
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShieldAlert className="size-4" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Notifications Center
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Real-time activity feed for client feedback, deliverable reviews, and task delegations.
        </p>
      </div>

      {/* Top 3 KPI Summary Cards (Option B) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div
          role="group"
          aria-label={`${counts.unreadActionRequired} action items pending`}
          className="flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card p-2.5 shadow-xs sm:flex-row sm:items-center sm:gap-3 sm:rounded-2xl sm:p-4"
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 sm:size-10 sm:rounded-xl">
            <AlertTriangle className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold leading-none text-foreground sm:text-xl">
              {counts.unreadActionRequired}
            </div>
            <div
              title="Action Items Pending"
              className="mt-1 truncate text-[10px] leading-tight text-muted-foreground sm:mt-0 sm:text-xs"
            >
              <span className="sm:hidden">Pending</span>
              <span className="hidden sm:inline">Action Items Pending</span>
            </div>
          </div>
        </div>

        <div
          role="group"
          aria-label={`${counts.emailSent} email notifications synced`}
          className="flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card p-2.5 shadow-xs sm:flex-row sm:items-center sm:gap-3 sm:rounded-2xl sm:p-4"
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-10 sm:rounded-xl">
            <Mail className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold leading-none text-foreground sm:text-xl">
              {counts.emailSent}
            </div>
            <div
              title="Email Notifications Synced"
              className="mt-1 truncate text-[10px] leading-tight text-muted-foreground sm:mt-0 sm:text-xs"
            >
              <span className="sm:hidden">Emails</span>
              <span className="hidden sm:inline">Email Notifications Synced</span>
            </div>
          </div>
        </div>

        <div
          role="group"
          aria-label={`${Math.max(0, counts.all - counts.unread)} read or acknowledged notifications`}
          className="flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card p-2.5 shadow-xs sm:flex-row sm:items-center sm:gap-3 sm:rounded-2xl sm:p-4"
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 sm:size-10 sm:rounded-xl">
            <ShieldCheck className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold leading-none text-foreground sm:text-xl">
              {Math.max(0, counts.all - counts.unread)}
            </div>
            <div
              title="Read / Acknowledged"
              className="mt-1 truncate text-[10px] leading-tight text-muted-foreground sm:mt-0 sm:text-xs"
            >
              <span className="sm:hidden">Read</span>
              <span className="hidden sm:inline">Read / Acknowledged</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls (Option A) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-lg">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search notifications by title, project, note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-full pl-8 pr-3 text-xs"
            />
          </div>

          {/* Segmented Filter Pills */}
          <div className="flex items-center gap-1 rounded-full border bg-card p-1 shadow-2xs">
            <button
              onClick={() => setFilterMode("ALL")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                filterMode === "ALL"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({counts.all})
            </button>
            <button
              onClick={() => setFilterMode("UNREAD")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                filterMode === "UNREAD"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Unread ({counts.unread})
            </button>
            <button
              onClick={() => setFilterMode("ACTION_REQUIRED")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                filterMode === "ACTION_REQUIRED"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Action Items ({counts.actionRequired})
            </button>
          </div>
        </div>

        {counts.unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="gap-1.5 rounded-full text-xs h-8 cursor-pointer"
          >
            <CheckCheck className="size-3.5" />
            <span>Mark all as read</span>
          </Button>
        )}
      </div>

      {/* Main Listing Grouped by Timeline (Option C Split Behavior) */}
      {filteredNotifications.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center shadow-xs space-y-2">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-muted/60 mx-auto text-muted-foreground">
            <Check className="size-5 text-muted-foreground/60" />
          </div>
          <h3 className="font-semibold text-sm text-foreground">You are all caught up</h3>
          <p className="text-xs text-muted-foreground">No notifications match your current search or filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Today Group */}
          {todayList.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                <Calendar className="size-3.5" />
                <span>Today</span>
                <span className="text-[10px] lowercase font-normal">({todayList.length})</span>
              </div>
              <div className="space-y-2">
                {todayList.map((item) => renderCard(item))}
              </div>
            </div>
          )}

          {/* Yesterday Group */}
          {yesterdayList.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                <Clock className="size-3.5" />
                <span>Yesterday</span>
                <span className="text-[10px] lowercase font-normal">({yesterdayList.length})</span>
              </div>
              <div className="space-y-2">
                {yesterdayList.map((item) => renderCard(item))}
              </div>
            </div>
          )}

          {/* Past 7 Days Group */}
          {last7DaysList.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                <Layers className="size-3.5" />
                <span>Past 7 Days</span>
                <span className="text-[10px] lowercase font-normal">({last7DaysList.length})</span>
              </div>
              <div className="space-y-2">
                {last7DaysList.map((item) => renderCard(item))}
              </div>
            </div>
          )}

          {/* Older Group */}
          {olderList.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                <Clock className="size-3.5" />
                <span>Older</span>
                <span className="text-[10px] lowercase font-normal">({olderList.length})</span>
              </div>
              <div className="space-y-2">
                {olderList.map((item) => renderCard(item))}
              </div>
            </div>
          )}
        </div>
      )}

      {loadError && (
        <p role="alert" className="text-sm text-destructive">{loadError}</p>
      )}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="min-w-36 rounded-full"
          >
            {loadingMore ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );

  function renderCard(item: NotificationItemView) {
    return (
      <div
        key={item.id}
        className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 transition-all hover:border-primary/30 ${
          !item.read
            ? item.category === "ACTION_REQUIRED"
              ? "bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/30 shadow-2xs"
              : "bg-primary/5 border-primary/25 shadow-2xs"
            : "bg-card shadow-xs"
        }`}
      >
        <div className="flex items-start gap-3">
          {renderNotificationIcon(item.type)}

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-xs text-foreground">{item.title}</span>

              <Badge variant="outline" className="rounded-full text-[9px] px-1.5 py-0 font-mono">
                {item.type.replace(/_/g, " ")}
              </Badge>

              {item.channels.emailStatus === "SENT" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary">
                  <Mail className="size-2.5" /> Email sent
                </span>
              ) : item.channels.emailStatus === "PREVIEW" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-300">
                  <Mail className="size-2.5" /> Email preview only
                </span>
              ) : item.channels.emailStatus === "FAILED" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[9px] font-medium text-destructive">
                  <Mail className="size-2.5" /> Email not sent
                </span>
              ) : item.channels.emailStatus === "PENDING" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
                  <Mail className="size-2.5" /> Email pending
                </span>
              ) : item.channels.emailStatus === "NOT_REQUESTED" ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
                  In-App Only
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
                  <Mail className="size-2.5" /> Email status unavailable
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground max-w-2xl">{item.message}</p>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
              {item.projectName && (
                <span className="font-medium text-foreground">{item.projectName}</span>
              )}
              <span>•</span>
              <span>From {item.actor.name}</span>
              <span>•</span>
              <span>{formatDisplayDate(item.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {!item.read && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMarkItemRead(item.id)}
              className="rounded-full text-xs h-7 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Mark read
            </Button>
          )}
          {item.link ? (
            <Link
              to={item.link as any}
              onClick={() => handleMarkItemRead(item.id)}
              className="inline-flex items-center gap-1 rounded-full text-xs h-7 px-3 bg-card border hover:bg-muted text-foreground font-medium transition-colors cursor-pointer"
            >
              <span>View item</span>
              <ExternalLink className="size-3" />
            </Link>
          ) : null}
        </div>
      </div>
    );
  }
}

function formatDisplayDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
}
