import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendNotificationEmail } from "@/lib/email";

describe("notification email delivery state", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("marks email as sent only after Resend accepts the request", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "WoPhoto Test <onboarding@resend.dev>");
    vi.stubEnv("EMAIL_DELIVERY_MODE", "live");
    vi.stubEnv("APP_URL", "https://wophoto.example");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendNotificationEmail({
      to: "delivered@resend.dev",
      subject: "Review <ready>",
      title: "Review <ready>",
      message: "Use <contrast> & crop tighter",
      link: "/manager/reviews?from=mail&open=1",
    });

    expect(result).toEqual({ success: true, status: "sent", messageId: "email_123" });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.to).toEqual(["delivered@resend.dev"]);
    expect(body.html).toContain("Review &lt;ready&gt;");
    expect(body.html).toContain("Use &lt;contrast&gt; &amp; crop tighter");
    expect(body.html).toContain("https://wophoto.example/manager/reviews?from=mail&amp;open=1");
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });

  it("routes test-mode notifications to the configured inbox and labels the intended recipient", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "WoPhoto Studio <onboarding@resend.dev>");
    vi.stubEnv("EMAIL_DELIVERY_MODE", "test");
    vi.stubEnv("EMAIL_TEST_RECIPIENT", "devbrainy98@gmail.com");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_test_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendNotificationEmail({
      to: "worker@example.test",
      subject: "Task assigned",
      title: "Task assigned",
      message: "You have a new task",
    });

    expect(result).toEqual({ success: true, status: "sent", messageId: "email_test_123" });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.from).toBe("WoPhoto Studio <onboarding@resend.dev>");
    expect(body.to).toEqual(["devbrainy98@gmail.com"]);
    expect(body.subject).toBe("[TEST] Task assigned");
    expect(body.html).toContain("Test notification");
    expect(body.html).toContain("Intended recipient: worker@example.test");
  });

  it("refuses test-mode delivery when the test inbox is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_DELIVERY_MODE", "test");
    vi.stubEnv("EMAIL_TEST_RECIPIENT", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendNotificationEmail({
      to: "worker@example.test",
      subject: "Task assigned",
      title: "Task assigned",
      message: "You have a new task",
    });

    expect(result).toEqual({
      success: false,
      status: "failed",
      error: "EMAIL_TEST_RECIPIENT must be set when EMAIL_DELIVERY_MODE=test.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks a local preview as preview, never as delivered", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_DELIVERY_MODE", "live");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendNotificationEmail({
      to: "worker@example.test",
      subject: "Task assigned",
      title: "Task assigned",
      message: "You have a new task",
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("preview");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not preserve a notification link to another origin", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_DELIVERY_MODE", "live");
    vi.stubEnv("APP_URL", "https://wophoto.example");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_456" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendNotificationEmail({
      to: "delivered@resend.dev",
      subject: "Safe link",
      title: "Safe link",
      message: "Open the app",
      link: "https://malicious.example/path",
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.html).toContain('href="https://wophoto.example/"');
    expect(body.html).not.toContain("malicious.example");
  });
});
