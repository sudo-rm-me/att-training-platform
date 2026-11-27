import "server-only";

/**
 * Microsoft Teams channel posts via an incoming webhook (Workflows "Post to a
 * channel when a webhook request is received", or a legacy connector URL).
 * Only HTTPS URLs on Microsoft hosts are accepted, so the field can't be used
 * to make the server call arbitrary addresses.
 */
const ALLOWED = [/\.logic\.azure\.com$/i, /\.webhook\.office\.com$/i, /\.powerplatform\.com$/i, /\.environment\.api\.powerplatform\.com$/i];

export function validWebhookUrl(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && ALLOWED.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}

export type CardFact = { title: string; value: string };

/** Post an Adaptive Card. Never throws. */
export async function postToTeams(url: string, card: { title: string; text: string; facts?: CardFact[]; link?: { label: string; href: string } }) {
  if (!validWebhookUrl(url)) return false;
  const body = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: card.title, weight: "Bolder", size: "Medium", wrap: true },
            { type: "TextBlock", text: card.text, wrap: true },
            ...(card.facts?.length ? [{ type: "FactSet", facts: card.facts }] : []),
          ],
          actions: card.link ? [{ type: "Action.OpenUrl", title: card.link.label, url: card.link.href }] : [],
        },
      },
    ],
  };
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) console.error(`[teams] webhook failed (${res.status})`);
    return res.ok;
  } catch (e) {
    console.error("[teams] webhook failed", e);
    return false;
  }
}
