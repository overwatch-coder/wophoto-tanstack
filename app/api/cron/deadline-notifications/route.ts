import { timingSafeEqual } from "node:crypto";
import { createUpcomingDeadlineNotifications } from "@/lib/notifications";
import { cronAuthorizationSchema } from "@/lib/validation/api";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "Cron secret is not configured." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!cronAuthorizationSchema.safeParse(authorization).success) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(authorization);
  const authorized = supplied.length === expected.length && timingSafeEqual(supplied, expected);
  if (!authorized) return Response.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const result = await createUpcomingDeadlineNotifications();
    return Response.json(result);
  } catch (error) {
    console.error("[cron:deadline-notifications] Failed:", error);
    return Response.json({ error: "Deadline notifications could not be processed." }, { status: 500 });
  }
}
