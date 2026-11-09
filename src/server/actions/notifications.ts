import { createServerFn } from "@tanstack/react-start";
import { decodeActionArguments, encodeActionArguments, type EncodedActionArguments } from "@/lib/server-action-args";

import { auth } from "@/auth";
import {
  getNotificationCounts,
  getNotificationPage,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCounts,
} from "@/lib/notifications";
import { notificationIdSchema, notificationPageInputSchema } from "@/lib/validation/notifications";
import { parseInput } from "@/lib/validation/common";

async function getNotificationPageActionServerImplementation(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const parsed = parseInput(notificationPageInputSchema, input);

    return await getNotificationPage(session.user.id, {
      cursor: parsed.cursor,
      query: parsed.query,
      filterMode: parsed.filterMode,
      limit: 20,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load notifications." };
  }
}

async function markNotificationReadActionServerImplementation(notificationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const parsedId = parseInput(notificationIdSchema, notificationId);

    await markNotificationRead(parsedId, session.user.id);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to mark as read." };
  }
}

async function markAllNotificationsReadActionServerImplementation() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await markAllNotificationsRead(session.user.id);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to mark all as read." };
  }
}

async function getHeaderNotificationsActionServerImplementation() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        notifications: [],
        unreadCounts: { unread: 0, actionRequired: 0, updates: 0 },
        counts: {
          all: 0,
          unread: 0,
          actionRequired: 0,
          emailSent: 0,
          unreadActionRequired: 0,
          unreadUpdates: 0,
        },
      };
    }

    const [notifications, unreadCounts, counts] = await Promise.all([
      getNotificationPage(session.user.id, { limit: 6 }),
      getUnreadNotificationCounts(session.user.id),
      getNotificationCounts(session.user.id),
    ]);

    return { notifications: notifications.items, unreadCounts, counts };
  } catch (err) {
    console.error("[notifications] Failed to fetch header notifications:", err);
    return {
      notifications: [],
      unreadCounts: { unread: 0, actionRequired: 0, updates: 0 },
      counts: {
        all: 0,
        unread: 0,
        actionRequired: 0,
        emailSent: 0,
        unreadActionRequired: 0,
        unreadUpdates: 0,
      },
    };
  }
}


const getNotificationPageActionServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof getNotificationPageActionServerImplementation>>) => args)
  .handler(async ({ data }) => getNotificationPageActionServerImplementation(...decodeActionArguments<Parameters<typeof getNotificationPageActionServerImplementation>>(data)));
export const getNotificationPageAction = async (...args: Parameters<typeof getNotificationPageActionServerImplementation>) => getNotificationPageActionServerFunction({ data: await encodeActionArguments(args) });

const markNotificationReadActionServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof markNotificationReadActionServerImplementation>>) => args)
  .handler(async ({ data }) => markNotificationReadActionServerImplementation(...decodeActionArguments<Parameters<typeof markNotificationReadActionServerImplementation>>(data)));
export const markNotificationReadAction = async (...args: Parameters<typeof markNotificationReadActionServerImplementation>) => markNotificationReadActionServerFunction({ data: await encodeActionArguments(args) });

const markAllNotificationsReadActionServerFunction = createServerFn({ method: "POST" })
  .handler(async () => markAllNotificationsReadActionServerImplementation());
export const markAllNotificationsReadAction = () => markAllNotificationsReadActionServerFunction();


const getHeaderNotificationsActionServerFunction = createServerFn({ method: "POST" })
  .handler(async () => getHeaderNotificationsActionServerImplementation());
export const getHeaderNotificationsAction = () => getHeaderNotificationsActionServerFunction();
