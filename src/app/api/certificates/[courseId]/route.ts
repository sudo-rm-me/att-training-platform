import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { canManageUser } from "@/lib/assignments";
import { certificateNumber, certificatesFor } from "@/lib/certificates";
import { renderCertificate } from "@/lib/certificate-pdf";
import { TZ } from "@/lib/gamification";
import { APP_NAME } from "@/lib/brand";

const UUID = /^[0-9a-f-]{36}$/i;

/** GET /api/certificates/:courseId[?user=<id>] -> PDF. Managers may fetch their team's certificates. */
export async function GET(req: Request, ctx: RouteContext<"/api/certificates/[courseId]">) {
  const me = await getCurrentUser();
  if (!me) return new Response("Unauthorized", { status: 401 });

  const { courseId } = await ctx.params;
  const forUser = new URL(req.url).searchParams.get("user");
  if (!UUID.test(courseId) || (forUser && !UUID.test(forUser))) return new Response("Not found", { status: 404 });

  let learner = me;
  if (forUser && forUser !== me.id) {
    const db = await getDb();
    const [u] = await db.select().from(users).where(eq(users.id, forUser)).limit(1);
    if (!u || !canManageUser(me, u)) return new Response("Not found", { status: 404 });
    learner = u;
  }

  const [cert] = await certificatesFor(learner.id, courseId);
  if (!cert) return new Response("No certificate: this course hasn't been passed yet.", { status: 404 });

  const pdf = await renderCertificate({
    appName: APP_NAME,
    learnerName: learner.name,
    courseTitle: cert.courseTitle,
    score: cert.bestScore,
    issuedOn: cert.issuedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: TZ() }),
    number: certificateNumber(cert.attemptId),
  });

  const filename = `${cert.courseTitle} - ${learner.name}`.replace(/[^\w\- ]+/g, "").trim().slice(0, 100) || "certificate";
  const inline = new URL(req.url).searchParams.get("download") !== "1";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
