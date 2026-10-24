import "server-only";

export type SendEmailInput = {
  to: string;
  subject: string;
  title: string;
  message: string;
  link?: string | null;
  projectName?: string | null;
  actorName?: string | null;
};

export async function sendNotificationEmail(input: SendEmailInput): Promise<{
  success: boolean;
  status: "sent" | "preview" | "failed";
  messageId?: string;
  error?: string;
}> {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";
  const fullLink = safeNotificationLink(baseUrl, input.link);

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(input.subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f8; margin: 0; padding: 24px; color: #1a1a1a; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5e5e7; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
    .brand { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; }
    .brand-pill { display: inline-block; background: #ea580c; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; }
    .title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px 0; }
    .message { font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 24px; }
    .meta-box { background: #f9fafb; border-radius: 12px; border: 1px solid #f3f4f6; padding: 12px 16px; font-size: 12px; color: #6b7280; margin-bottom: 24px; }
    .button { display: inline-block; background-color: #ea580c; color: #ffffff !important; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 22px; border-radius: 9999px; }
    .footer { font-size: 11px; color: #9ca3af; text-align: center; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <span class="brand-pill">WoPhoto Studio</span>
    </div>
    <h1 class="title">${escapeHtml(input.title)}</h1>
    <p class="message">${escapeHtml(input.message)}</p>

    ${
      input.projectName || input.actorName
        ? `<div class="meta-box">
            ${input.projectName ? `<strong>Project:</strong> ${escapeHtml(input.projectName)}<br/>` : ""}
            ${input.actorName ? `<strong>From:</strong> ${escapeHtml(input.actorName)}` : ""}
          </div>`
        : ""
    }

    <div style="text-align: left; margin-top: 20px;">
      <a href="${escapeHtml(fullLink)}" class="button" target="_blank" rel="noopener noreferrer">View in WoPhoto Studio &rarr;</a>
    </div>

    <div class="footer">
      This is an automated notification from WoPhoto Studio. You received this because you are an active member of this project.
    </div>
  </div>
</body>
</html>
  `;

  // Production Resend API dispatch if RESEND_API_KEY is available
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "WoPhoto Studio <notifications@wophoto.studio>",
          to: [input.to],
          subject: input.subject,
          html: htmlContent,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`[email] Resend API error: ${res.status} ${errorText}`);
        return { success: false, status: "failed", error: errorText };
      }

      const data = await res.json();
      return { success: true, status: "sent", messageId: data.id };
    } catch (err) {
      console.error("[email] Error dispatching email:", err);
      return { success: false, status: "failed", error: String(err) };
    }
  }

  // Development / fallback preview log
  console.log(`[email:preview] Dispatched to ${input.to} | Subject: "${input.subject}" | Link: ${fullLink}`);
  return { success: false, status: "preview", messageId: `preview-msg-${Date.now()}` };
}

function safeNotificationLink(baseUrl: string, link?: string | null): string {
  try {
    const base = new URL(baseUrl);
    const destination = new URL(link || "/", base);
    if (destination.protocol !== "https:" && destination.protocol !== "http:") return base.href;
    if (destination.origin !== base.origin) return base.href;
    return destination.href;
  } catch {
    return "http://localhost:3000/";
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
