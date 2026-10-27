import "server-only";
import nodemailer from "nodemailer";

export type SendEmailInput = {
  to: string;
  subject: string;
  title: string;
  message: string;
  link?: string | null;
  linkLabel?: string | null;
  projectName?: string | null;
  actorName?: string | null;
  footerText?: string | null;
};

export async function sendNotificationEmail(input: SendEmailInput): Promise<{
  success: boolean;
  status: "sent" | "preview" | "failed";
  messageId?: string;
  error?: string;
}> {
  const deliveryMode = process.env.EMAIL_DELIVERY_MODE?.trim().toLowerCase() === "test" ? "test" : "live";
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase() || "resend";
  const configuredTestRecipient = process.env.EMAIL_TEST_RECIPIENT?.trim();

  // In test mode, never send to the notification's real recipient. A missing
  // test inbox is a configuration error rather than a reason to fall through.
  if (deliveryMode === "test" && !configuredTestRecipient) {
    return {
      success: false,
      status: "failed",
      error: "EMAIL_TEST_RECIPIENT must be set when EMAIL_DELIVERY_MODE=test.",
    };
  }

  const recipient = deliveryMode === "test" ? configuredTestRecipient! : input.to;
  const subject = deliveryMode === "test" ? `[TEST] ${input.subject}` : input.subject;
  const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";
  const fullLink = safeNotificationLink(baseUrl, input.link);
  const logoUrl = safeNotificationLink(baseUrl, "/assets/logo-trimmed.png");

  if (provider !== "resend" && provider !== "gmail") {
    return { success: false, status: "failed", error: "EMAIL_PROVIDER must be either 'resend' or 'gmail'." };
  }

  const gmailUser = process.env.GMAIL_SMTP_USER?.trim();
  const gmailAppPassword = process.env.GMAIL_SMTP_APP_PASSWORD?.replace(/\s/g, "");
  if (provider === "gmail" && (!gmailUser || !gmailAppPassword)) {
    return {
      success: false,
      status: "failed",
      error: "Gmail SMTP is selected, but GMAIL_SMTP_USER or GMAIL_SMTP_APP_PASSWORD is missing.",
    };
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f8; margin: 0; padding: 24px; color: #1a1a1a; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5e5e7; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
    .brand { margin: 0 0 24px 0; }
    .brand-lockup { display: inline-block; background-color: #ffffff !important; border: 1px solid #ece8e0; border-radius: 9px; padding: 6px 8px; }
    .brand-logo { display: block; width: 150px; max-width: 100%; height: auto; border: 0; }
    .title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px 0; }
    .message { font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 24px; }
    .meta-box { background: #f9fafb; border-radius: 12px; border: 1px solid #f3f4f6; padding: 12px 16px; font-size: 12px; color: #6b7280; margin-bottom: 24px; }
    .button { display: inline-block; background-color: #ea580c; color: #ffffff !important; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 22px; border-radius: 9999px; }
    .footer { font-size: 11px; color: #9ca3af; text-align: center; margin-top: 24px; }
    @media only screen and (max-width: 480px) {
      .brand-logo { width: 120px !important; }
      .brand-lockup { padding: 5px 7px !important; }
    }
  </style>
</head>
<body>
  <div class="card">
    ${deliveryMode === "test" ? `<div style="margin-bottom:20px;padding:12px 14px;border:1px solid #fdba74;border-radius:10px;background:#fff7ed;color:#9a3412;font-size:13px;line-height:1.5"><strong>Test notification</strong><br/>Intended recipient: ${escapeHtml(input.to)}</div>` : ""}
    <div class="brand">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="brand-lockup" bgcolor="#ffffff" style="background-color:#ffffff !important;border:1px solid #ece8e0;border-radius:9px;padding:6px 8px">
            <img class="brand-logo" src="${escapeHtml(logoUrl)}" width="150" alt="WoPhoto Studio" style="display:block;width:150px;max-width:100%;height:auto;border:0" />
          </td>
        </tr>
      </table>
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
      <a href="${escapeHtml(fullLink)}" class="button" target="_blank" rel="noopener noreferrer">${escapeHtml(input.linkLabel || "View in WoPhoto Studio")} &rarr;</a>
    </div>

    <div class="footer">
      ${escapeHtml(input.footerText || "This is an automated message from WoPhoto Studio.")}
    </div>
  </div>
</body>
</html>
  `;

  if (provider === "gmail") {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
      auth: { user: gmailUser!, pass: gmailAppPassword! },
    });
    try {
      const info = await transporter.sendMail({
        from: process.env.GMAIL_FROM?.trim() || `WoPhoto Studio <${gmailUser}>`,
        to: recipient,
        subject,
        html: htmlContent,
      });
      return { success: true, status: "sent", messageId: info.messageId };
    } catch (error) {
      console.error("[email] Gmail SMTP delivery failed:", error);
      return { success: false, status: "failed", error: "Gmail SMTP could not send this email. Check the Gmail account and App Password configuration." };
    } finally {
      transporter.close();
    }
  }

  // Resend remains the default provider and is selected explicitly in production.
  if (process.env.RESEND_API_KEY) {
    try {
      const from = process.env.EMAIL_FROM?.trim() || "WoPhoto Studio <notifications@wophoto.studio>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [recipient],
          subject,
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
  console.log(`[email:preview] ${deliveryMode === "test" ? `Test delivery to ${recipient} (intended for ${input.to})` : `Dispatched to ${recipient}`} | Subject: "${subject}" | Link: ${fullLink}`);
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
