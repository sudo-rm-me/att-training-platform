import { timingSafeEqual } from "node:crypto";
import { runReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // not enabled
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/** Called daily by the Container Apps Job (see infra/main.bicep). */
export async function POST(req: Request) {
  const ok = authorised(req);
  if (ok === null) return new Response("Not found", { status: 404 });
  if (!ok) return new Response("Unauthorized", { status: 401 });
  const summary = await runReminders();
  console.info("[cron] reminders", summary);
  return Response.json({ ok: true, ...summary });
}
