import { randomBytes } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/auth";
import {
  DEMO_SESSION_TTL_MS,
  getDemoPersona,
  isDemoAccessEnabled,
  isDemoRole,
  isDemoUserId,
  type DemoRole,
} from "@/lib/demo";
import { ensureDemoStudioSeeded, seedDemoStudio } from "@/lib/demo-seed";
import { getWorkspaceHome } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";

function extractSessionToken(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(/(?:^|;\s*)(?:__Secure-)?authjs\.session-token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function isHttpsRequest(request: Request): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwardedProto) return forwardedProto === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

function buildDemoSessionHeaders(request: Request, sessionToken: string, redirectTo?: string): Headers {
  const headers = new Headers();
  if (redirectTo) headers.set("Location", redirectTo);
  const secure = isHttpsRequest(request);
  const maxAgeSeconds = Math.floor(DEMO_SESSION_TTL_MS / 1000);
  const encodedToken = encodeURIComponent(sessionToken);

  if (secure) {
    headers.append(
      "Set-Cookie",
      `__Secure-authjs.session-token=${encodedToken}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAgeSeconds}`,
    );
    headers.append("Set-Cookie", "authjs.session-token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  } else {
    headers.append(
      "Set-Cookie",
      `authjs.session-token=${encodedToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`,
    );
    headers.append(
      "Set-Cookie",
      "__Secure-authjs.session-token=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0",
    );
  }

  headers.append("Set-Cookie", "sidebar_state=; Path=/; SameSite=Lax; Max-Age=0");
  return headers;
}

function resolveSafeRedirect(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  return trimmed;
}

export async function handleDemoAuthPost(request: Request): Promise<Response> {
  if (!isDemoAccessEnabled()) {
    return new Response("Demo access is disabled.", { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response("Invalid demo sign-in request.", { status: 400 });
  }

  const action = formData.get("action");
  const requestedRole = formData.get("role");
  const redirectTo = resolveSafeRedirect(formData.get("redirectTo"));
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;

  if (action === "reset") {
    const currentSession = await auth(request);
    if (!currentSession?.user?.id || !isDemoUserId(currentSession.user.id)) {
      return new Response("Only active demo sessions can reset demo data.", { status: 403 });
    }

    const fallbackRole: DemoRole = isDemoRole(currentSession.user.role) ? currentSession.user.role : "MANAGER";
    const targetRole: DemoRole = isDemoRole(requestedRole) ? requestedRole : fallbackRole;

    await seedDemoStudio({ reset: true });

    const persona = getDemoPersona(targetRole);
    const sessionToken = randomBytes(32).toString("base64url");
    await prisma.session.create({
      data: {
        sessionToken,
        userId: persona.id,
        expires: new Date(Date.now() + DEMO_SESSION_TTL_MS),
      },
    });

    if (wantsJson) {
      return Response.json(
        { ok: true, redirectTo: getWorkspaceHome(targetRole) },
        { status: 200, headers: buildDemoSessionHeaders(request, sessionToken) },
      );
    }

    return new Response(null, {
      status: 303,
      headers: buildDemoSessionHeaders(request, sessionToken, redirectTo),
    });
  }

  if (!isDemoRole(requestedRole)) {
    return new Response("Choose a valid demo role.", { status: 400 });
  }

  await ensureDemoStudioSeeded();

  const existingToken = extractSessionToken(request.headers.get("cookie"));
  if (existingToken) {
    await prisma.session.deleteMany({ where: { sessionToken: existingToken } });
  }

  const persona = getDemoPersona(requestedRole);
  const sessionToken = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      sessionToken,
      userId: persona.id,
      expires: new Date(Date.now() + DEMO_SESSION_TTL_MS),
    },
  });

  if (wantsJson) {
    return Response.json(
      { ok: true, redirectTo: getWorkspaceHome(requestedRole) },
      { status: 200, headers: buildDemoSessionHeaders(request, sessionToken) },
    );
  }

  return new Response(null, {
    status: 303,
    headers: buildDemoSessionHeaders(request, sessionToken, redirectTo),
  });
}

export const Route = createFileRoute("/auth/demo")({
  server: {
    handlers: {
      GET: async () => new Response(null, { status: 303, headers: { Location: "/login" } }),
      POST: async ({ request }) => handleDemoAuthPost(request),
    },
  },
});
