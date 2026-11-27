import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userBadges } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { BADGES } from "@/lib/badges";
import { badgeStats } from "@/lib/gamification";
import { Card, PageHeader, Progress } from "@/components/ui";
import { BadgeMedal } from "@/components/badge-medal";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Badges" };

export default async function BadgesPage() {
  const user = await requireUser();
  const db = await getDb();
  const have = new Map((await db.select().from(userBadges).where(eq(userBadges.userId, user.id))).map((b) => [b.badge, b.awardedAt]));
  const stats = await badgeStats(user.id);

  return (
    <div>
      <PageHeader
        eyebrow="Achievements"
        title="Badges"
        subtitle={`You've collected ${have.size} of ${BADGES.length}. Each badge also comes with bonus XP and coins.`}
      />
      <Card className="mb-8 p-6">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>Collection</span>
          <span className="tabular-nums text-muted">
            {have.size}/{BADGES.length}
          </span>
        </div>
        <Progress value={have.size / BADGES.length} className="mt-2 h-3" />
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...BADGES]
          .sort((a, b) => Number(have.has(b.key)) - Number(have.has(a.key)))
          .map((b) => {
            const at = have.get(b.key);
            const prog = !at && b.progress ? b.progress(stats) : null;
            return (
              <Card key={b.key} className="flex items-center gap-4 p-5">
                <BadgeMedal badge={b} locked={!at} />
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold">{b.name}</div>
                  <div className="text-sm text-muted">{b.description}</div>
                  {at ? (
                    <div className="mt-1 text-xs font-semibold text-success">Earned {formatDate(at)} · +{b.xp} XP</div>
                  ) : prog ? (
                    <div className="mt-2">
                      <Progress value={prog[0] / prog[1]} className="h-1.5" />
                      <div className="mt-1 text-xs text-muted tabular-nums">
                        {prog[0]}/{prog[1]} · +{b.xp} XP
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-muted">+{b.xp} XP</div>
                  )}
                </div>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
