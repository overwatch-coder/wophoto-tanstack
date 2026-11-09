export async function callServerAction(file: string, fn: string, args: unknown[]) {
  const hasFormData = args.some(
    (arg) => typeof FormData !== "undefined" && arg instanceof FormData
  );

  let response: Response;

  if (hasFormData) {
    const payload = new FormData();
    payload.append("__action_file", file);
    payload.append("__action_fn", fn);

    args.forEach((arg, idx) => {
      if (typeof FormData !== "undefined" && arg instanceof FormData) {
        for (const [key, val] of arg.entries()) {
          payload.append(`__form_${idx}:${key}`, val);
        }
      } else {
        payload.append(`__arg_${idx}`, JSON.stringify(arg));
      }
    });

    response = await fetch("/api/action", {
      method: "POST",
      body: payload,
    });
  } else {
    response = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, fn, args }),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errJson = JSON.parse(errorText);
      throw new Error(errJson.error || "Server action failed.");
    } catch {
      throw new Error(errorText || "Server action failed.");
    }
  }

  const data = await response.json();
  if (data?.redirect) {
    if (typeof window !== "undefined") {
      window.location.href = data.redirect;
    }
    return;
  }

  // Re-run all active TanStack Router loaders so the current page UI updates immediately
  if (typeof window !== "undefined") {
    const hasError = Boolean(
      data?.result &&
      typeof data.result === "object" &&
      ((data.result as { error?: unknown }).error || (data.result as { success?: boolean }).success === false)
    );
    if (!hasError) {
      try {
        const router = (window as unknown as { __TSR_ROUTER__?: { invalidate: (opts?: { sync?: boolean }) => Promise<void> } }).__TSR_ROUTER__;
        if (router && typeof router.invalidate === "function") {
          await router.invalidate({ sync: true });
        }
      } catch (err) {
        console.warn("Failed to invalidate router after action:", err);
      }
    }
  }

  return data?.result;
}
