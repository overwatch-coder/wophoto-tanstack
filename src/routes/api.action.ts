import { createFileRoute } from "@tanstack/react-router";

const actionsMap: Record<string, () => Promise<Record<string, unknown>>> = {
  auth: () => import("@/app/actions/auth"),
  "brand-assets": () => import("@/app/actions/brand-assets"),
  "brief-templates": () => import("@/app/actions/brief-templates"),
  briefs: () => import("@/app/actions/briefs"),
  "copilot-studio": () => import("@/app/actions/copilot-studio"),
  feedback: () => import("@/app/actions/feedback"),
  inventory: () => import("@/app/actions/inventory"),
  invitations: () => import("@/app/actions/invitations"),
  notifications: () => import("@/app/actions/notifications"),
  profile: () => import("@/app/actions/profile"),
  projects: () => import("@/app/actions/projects"),
  schedule: () => import("@/app/actions/schedule"),
  services: () => import("@/app/actions/services"),
  settings: () => import("@/app/actions/settings"),
  "studio-access": () => import("@/app/actions/studio-access"),
  tasks: () => import("@/app/actions/tasks"),
  "work-requests": () => import("@/app/actions/work-requests"),
};

export const Route = createFileRoute("/api/action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") || "";
          let file = "";
          let fn = "";
          let args: unknown[] = [];

          if (
            contentType.includes("multipart/form-data") ||
            contentType.includes("application/x-www-form-urlencoded")
          ) {
            const formData = await request.formData();
            file = String(formData.get("__action_file") || "");
            fn = String(formData.get("__action_fn") || "");

            const maxIdx = 10;
            for (let i = 0; i < maxIdx; i++) {
              const argKey = `__arg_${i}`;
              const formPrefix = `__form_${i}:`;

              if (formData.has(argKey)) {
                args[i] = JSON.parse(String(formData.get(argKey)));
              } else {
                let hasFormFields = false;
                const subForm = new FormData();
                for (const [key, val] of formData.entries()) {
                  if (key.startsWith(formPrefix)) {
                    hasFormFields = true;
                    subForm.append(key.slice(formPrefix.length), val);
                  }
                }
                if (hasFormFields) {
                  args[i] = subForm;
                }
              }
            }
          } else {
            const body = (await request.json()) as { file?: string; fn?: string; args?: unknown[] };
            file = body.file || "";
            fn = body.fn || "";
            args = body.args || [];
          }

          const loader = actionsMap[file];
          if (!loader) {
            return new Response(JSON.stringify({ error: `Unknown action file: ${file}` }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const mod = await loader();
          const targetFn = mod[fn];
          if (typeof targetFn !== "function") {
            return new Response(JSON.stringify({ error: `Unknown action: ${fn} in ${file}` }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const result = await (targetFn as (...params: unknown[]) => unknown)(...args);
          if (result instanceof Response) {
            const location = result.headers.get("Location") || result.headers.get("location");
            if (location) {
              const resHeaders = new Headers({ "Content-Type": "application/json" });
              const setCookieHeaders = (result.headers as any).getSetCookie?.() || [];
              for (const c of setCookieHeaders) {
                resHeaders.append("Set-Cookie", c);
              }
              const singleSetCookie = result.headers.get("Set-Cookie");
              if (singleSetCookie && setCookieHeaders.length === 0) {
                resHeaders.append("Set-Cookie", singleSetCookie);
              }
              return new Response(JSON.stringify({ redirect: location }), {
                status: 200,
                headers: resHeaders,
              });
            }
          }
          return new Response(JSON.stringify({ result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error: unknown) {
          if (error instanceof Response) {
            const location = error.headers.get("Location") || error.headers.get("location");
            if (location) {
              const resHeaders = new Headers({ "Content-Type": "application/json" });
              const setCookieHeaders = (error.headers as any).getSetCookie?.() || [];
              for (const c of setCookieHeaders) {
                resHeaders.append("Set-Cookie", c);
              }
              const singleSetCookie = error.headers.get("Set-Cookie");
              if (singleSetCookie && setCookieHeaders.length === 0) {
                resHeaders.append("Set-Cookie", singleSetCookie);
              }
              return new Response(JSON.stringify({ redirect: location }), {
                status: 200,
                headers: resHeaders,
              });
            }
          }

          const errObj = error as Record<string, unknown> | null;
          if (errObj && typeof errObj === "object") {
            const redirectUrl =
              errObj.href ||
              errObj.url ||
              (typeof errObj.message === "string" && errObj.message.startsWith("NEXT_REDIRECT;")
                ? errObj.message.split(";")[1]
                : undefined);

            if (redirectUrl) {
              return new Response(JSON.stringify({ redirect: String(redirectUrl) }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
          }

          console.error("API ACTION ERROR:", error);
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Internal Server Error",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
});
