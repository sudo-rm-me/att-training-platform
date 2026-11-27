import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userItems } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { levelFromXp } from "@/lib/levels";
import { starterAvatar } from "@/lib/avatar";
import { PageHeader } from "@/components/ui";
import { AvatarBuilder } from "./builder";

export const metadata = { title: "My avatar" };

export default async function AvatarPage() {
  const user = await requireUser();
  const db = await getDb();
  const owned = (await db.select({ i: userItems.item }).from(userItems).where(eq(userItems.userId, user.id))).map((r) => r.i);
  return (
    <div>
      <PageHeader eyebrow="You" title="Character creator" subtitle="Make it yours. Your avatar shows up on the leaderboard and across the app." />
      <AvatarBuilder
        initial={user.avatar ?? starterAvatar(user.name)}
        owned={owned}
        level={levelFromXp(user.xp).level}
        name={user.name}
      />
    </div>
  );
}
