import { useEffect, useRef, useState, useTransition } from "react";
import { Link, useRouter, type RegisteredRouter } from "@tanstack/react-router";
import {
  Bell,
  Mail,
  RotateCcw,
  MessageSquare,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  getHeaderNotificationsAction,
} from "@/src/server/actions/notifications";
import type { NotificationItemView } from "@/lib/notifications";
import type { WorkspaceRole } from "@/lib/navigation";
import type { NotificationType } from "@/generated/prisma/browser";
import { playNotificationChime, prepareNotificationAudio } from "@/lib/notification-audio";

export function HeaderNotificationBell({
  initialNotifications = [],
  initialUnreadCount = 0,
  initialUnreadActionCount = 0,
  initialUnreadUpdateCount = 0,
  role,
  soundAlerts,
}: {
  initialNotifications?: NotificationItemView[];
  initialUnreadCount?: number;
  initialUnreadActionCount?: number;
  initialUnreadUpdateCount?: number;
  role: WorkspaceRole;
  soundAlerts: boolean;
}) {
  const [notifications, setNotifications] = useState<NotificationItemView[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);
  const [unreadActionCount, setUnreadActionCount] = useState(initialUnreadActionCount);
  const [unreadUpdateCount, setUnreadUpdateCount] = useState(initialUnreadUpdateCount);

  useEffect(() => {
    setNotifications(initialNotifications);
    setUnreadCount(initialUnreadCount);
    setUnreadActionCount(initialUnreadActionCount);
    setUnreadUpdateCount(initialUnreadUpdateCount);
  }, [initialNotifications, initialUnreadCount, initialUnreadActionCount, initialUnreadUpdateCount]);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverTab, setPopoverTab] = useState<"ACTION" | "UPDATES">("ACTION");
  const [, startTransition] = useTransition();
  const router = useRouter();
  const seenNotificationIds = useRef(new Set(initialNotifications.map((item) => item.id)));
  const seenDataChangeIds = useRef(new Set<string>());
  const soundAlertsRef = useRef(soundAlerts);

  useEffect(() => {
    soundAlertsRef.current = soundAlerts;
  }, [soundAlerts]);

  useEffect(() => {
    const unlockAudio = () => {
      void prepareNotificationAudio();
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  // Connect to native Server-Sent Events (SSE) for instant real-time pushes
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
              const notification = data.notification as NotificationItemView;
              if (!seenNotificationIds.current.has(notification.id)) {
                seenNotificationIds.current.add(notification.id);
                setNotifications((prev) => [notification, ...prev.filter((item) => item.id !== notification.id)].slice(0, 6));
                if (soundAlertsRef.current) void playNotificationChime();
                if (!notification.read) {
                  setUnreadCount((prev) => prev + 1);
                  if (notification.category === "ACTION_REQUIRED") {
                    setUnreadActionCount((prev) => prev + 1);
                  } else {
                    setUnreadUpdateCount((prev) => prev + 1);
                  }
                }
                // Notifications are also the durable change signal for workspaces.
                // Refresh active loaders so invitation, task, feedback, project,
                // and request views update without a manual page reload.
                void router.invalidate();
              }
            } else if (data.event === "UNREAD_COUNTS" && typeof data.unread === "number") {
              setUnreadCount(data.unread);
              setUnreadActionCount(data.actionRequired);
              setUnreadUpdateCount(data.updates);
            } else if (data.event === "NOTIFICATION_READ" && typeof data.notificationId === "string") {
              setNotifications((prev) => prev.map((item) => (
                item.id === data.notificationId ? { ...item, read: true } : item
              )));
            } else if (data.event === "ALL_NOTIFICATIONS_READ") {
              setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
            } else if (data.event === "DATA_CHANGED") {
              if (typeof data.id !== "string" || !seenDataChangeIds.current.has(data.id)) {
                if (typeof data.id === "string") seenDataChangeIds.current.add(data.id);
                void router.invalidate();
              }
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
          // Retry connection after 5 seconds
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

  const actionItems = notifications.filter((n) => n.category === "ACTION_REQUIRED");
  const updateItems = notifications.filter((n) => n.category !== "ACTION_REQUIRED");
  const handleMarkItemRead = (id: string, link?: string | null) => {
    const item = notifications.find((notification) => notification.id === id);
    const wasUnread = Boolean(item && !item.read);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (item?.category === "ACTION_REQUIRED") setUnreadActionCount((prev) => Math.max(0, prev - 1));
      else setUnreadUpdateCount((prev) => Math.max(0, prev - 1));
    }

    startTransition(async () => {
      await markNotificationReadAction(id);
      if (link) {
        setIsOpen(false);
        router.navigate({ href: link });
      }
    });
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    setUnreadActionCount(0);
    setUnreadUpdateCount(0);

    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  };

  const notificationsHubUrl = `/${role.toLowerCase()}/notifications`;

  const togglePopover = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (!nextOpen) return;

    startTransition(async () => {
      const result = await getHeaderNotificationsAction();
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCounts.unread);
      setUnreadActionCount(result.unreadCounts.actionRequired);
      setUnreadUpdateCount(result.unreadCounts.updates);
    });
  };

  const renderItemIcon = (type: NotificationType) => {
    switch (type) {
      case "FEEDBACK_RECEIVED":
        return <MessageSquare className="size-3 text-amber-500 shrink-0" />;
      case "FEEDBACK_RESOLVED":
        return <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />;
      case "REVISION_DELEGATED":
        return <RotateCcw className="size-3 text-orange-500 shrink-0" />;
      case "TASK_REVIEW_READY":
      case "REVISION_SUBMITTED":
        return <ClipboardCheck className="size-3 text-blue-500 shrink-0" />;
      case "DEADLINE_APPROACHING":
        return <AlertTriangle className="size-3 text-rose-500 shrink-0" />;
      case "TASK_APPROVED":
        return <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />;
      case "TASK_ASSIGNED":
        return <UserCheck className="size-3 text-primary shrink-0" />;
      case "SYSTEM_ALERT":
      default:
        return <ShieldAlert className="size-3 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <div className="relative">
      {/* Header Notification Bell Trigger */}
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePopover}
        className="relative size-10 rounded-full text-foreground hover:bg-muted cursor-pointer"
        aria-label="Studio notifications"
        aria-expanded={isOpen}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground ring-2 ring-background animate-in zoom-in-50">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Popover Dropdown (Option B's Tabbed Design) */}
      {isOpen && (
        <>
          {/* Backdrop to close on click outside */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed inset-x-2 top-[calc(env(safe-area-inset-top)+4.25rem)] z-50 max-h-[calc(100dvh-5rem-env(safe-area-inset-top))] w-auto overflow-hidden rounded-2xl border bg-popover shadow-xl animate-in fade-in-0 zoom-in-95 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-none sm:w-96">
            {/* Popover Header */}
            <div className="border-b px-4 py-3 bg-muted/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Studio Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Two-Tab Toggle */}
              <div className="mt-2.5 flex rounded-full bg-background p-0.5 border">
                <button
                  onClick={() => setPopoverTab("ACTION")}
                  className={`flex-1 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                    popoverTab === "ACTION"
                      ? "bg-rose-500 text-white shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ⚡ Action Required ({unreadActionCount})
                </button>
                <button
                  onClick={() => setPopoverTab("UPDATES")}
                  className={`flex-1 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                    popoverTab === "UPDATES"
                      ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  📋 Updates ({unreadUpdateCount})
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-[calc(100dvh-13rem-env(safe-area-inset-top))] overflow-y-auto divide-y divide-border/50 sm:max-h-80">
              {(popoverTab === "ACTION" ? actionItems : updateItems).length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No {popoverTab === "ACTION" ? "action items" : "updates"} at this time.
                </div>
              ) : (
                (popoverTab === "ACTION" ? actionItems : updateItems).slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleMarkItemRead(item.id, item.link)}
                    className={`p-3 text-xs transition-colors cursor-pointer hover:bg-muted/50 ${
                      !item.read ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        {renderItemIcon(item.type)}
                        <span className="line-clamp-1">{item.title}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 pl-4.5">
                      {item.message}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground pl-4.5">
                      <span className="truncate max-w-[170px]">{item.projectName}</span>
                      {item.channels.emailStatus === "SENT" && (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <Mail className="size-2.5" /> Email Sent
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Popover Footer */}
            <div className="border-t p-2 text-center bg-muted/20">
              <Link
                to={notificationsHubUrl as RegisteredRouter["routeTree"]["types"]["fullPath"]}
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center justify-center w-full h-7 rounded-full text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 transition-colors"
              >
                View All in Notification Center →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}
