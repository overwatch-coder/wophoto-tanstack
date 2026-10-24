import { NextRequest, connection } from "next/server";
import { auth } from "@/auth";
import {
  getLatestNotificationStreamCursor,
  getNotificationsAfter,
  getUnreadNotificationCounts,
  registerSSEStream,
} from "@/lib/notifications";

export async function GET(req: NextRequest) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  let cursor = await getLatestNotificationStreamCursor(userId);
  let unreadCounts = await getUnreadNotificationCounts(userId);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          return true;
        } catch {
          return false;
        }
      };

      // Send initial connection handshake
      send({ event: "CONNECTED", userId });
      send({ event: "UNREAD_COUNTS", ...unreadCounts });

      // Same-instance push is immediate. Database polling below is the
      // cross-instance fallback for serverless deployments.
      const unregister = registerSSEStream(userId, controller);
      let polling = false;

      // Keepalive heartbeat ping every 25s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      const pollForChanges = async () => {
        if (polling || req.signal.aborted) return;
        polling = true;
        try {
          const [updates, nextUnreadCounts] = await Promise.all([
            getNotificationsAfter(userId, cursor),
            getUnreadNotificationCounts(userId),
          ]);
          cursor = updates.nextCursor;
          for (const notification of updates.items) {
            if (!send({ event: "NEW_NOTIFICATION", notification })) break;
          }
          if (
            nextUnreadCounts.unread !== unreadCounts.unread ||
            nextUnreadCounts.actionRequired !== unreadCounts.actionRequired ||
            nextUnreadCounts.updates !== unreadCounts.updates
          ) {
            unreadCounts = nextUnreadCounts;
            send({ event: "UNREAD_COUNTS", ...unreadCounts });
          }
        } catch (error) {
          console.error("[sse] Failed to poll notification updates:", error);
        } finally {
          polling = false;
        }
      };
      const pollInterval = setInterval(() => void pollForChanges(), 5000);

      // Clean up when client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        clearInterval(pollInterval);
        unregister();
        try {
          controller.close();
        } catch {
          // already closed
        }
      }, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
