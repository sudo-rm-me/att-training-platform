import "server-only";

/**
 * Email through Microsoft Graph (application permission Mail.Send), using the
 * same Entra app registration as sign-in. Set MAIL_SENDER to the mailbox that
 * sends reminders (a shared mailbox works). Without it, mail is logged instead.
 */
export type Mail = { to: string; subject: string; html: string };

export function mailConfigured() {
  return !!(process.env.MAIL_SENDER && process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET && tenantId());
}

/** Tenant from the issuer URL, e.g. https://login.microsoftonline.com/<tenant>/v2.0 */
export function tenantId() {
  const iss = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? "";
  return /login\.microsoftonline\.com\/([^/]+)/.exec(iss)?.[1] ?? null;
}

let cached: { token: string; expires: number } | null = null;

async function graphToken() {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const res = await fetch(`https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Graph token request failed (${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

/** Returns true when sent (or logged in dev), false on failure. Never throws. */
export async function sendMail(m: Mail): Promise<boolean> {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV !== "test") console.info(`[mail] (not configured) to=${m.to} subject=${m.subject}`);
    return true;
  }
  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(process.env.MAIL_SENDER!)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await graphToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: { subject: m.subject, body: { contentType: "HTML", content: m.html }, toRecipients: [{ emailAddress: { address: m.to } }] },
        saveToSentItems: false,
      }),
    });
    if (!res.ok) console.error(`[mail] send to ${m.to} failed (${res.status})`);
    return res.ok;
  } catch (e) {
    console.error("[mail] send failed", e);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A simple, client-safe HTML email. `lines` are plain text (escaped). */
export function mailHtml(o: { heading: string; lines: string[]; cta?: { label: string; href: string }; appName: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f2fb;font-family:Segoe UI,Arial,sans-serif;color:#1b1440">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:linear-gradient(135deg,#6d4aff,#ff4fa3);padding:20px 28px;color:#fff;font-weight:700;font-size:18px">${esc(o.appName)}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:20px">${esc(o.heading)}</h1>
${o.lines.map((l) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.5">${esc(l)}</p>`).join("")}
${o.cta ? `<p style="margin:20px 0 0"><a href="${esc(o.cta.href)}" style="display:inline-block;background:#6d4aff;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${esc(o.cta.label)}</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}
