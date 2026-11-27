import { asc, ne } from "drizzle-orm";
import { Coins, HeartHandshake } from "lucide-react";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { KUDOS_AMOUNTS, KUDOS_DAILY_LIMIT, kudosFeed, sentToday } from "@/lib/kudos";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { formatDate } from "@/lib/utils";
import { SendKudosForm } from "./send-form";

export const metadata = { title: "Kudos" };

type Feed = Awaited<ReturnType<typeof kudosFeed>>;

function KudosList({ items, me }: { items: Feed; me?: string }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((k) => (
        <li key={k.id} className="flex gap-3 py-4">
          <UserAvatar name={k.from.name} avatar={k.from.avatar} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
              <span className="font-semibold">{k.from.id === me ? "You" : k.from.name}</span>
              <span className="text-muted">thanked</span>
              <span className="font-semibold">{k.to.id === me ? "you" : k.to.name}</span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">
                <Coins className="h-3 w-3" /> {k.coins}
              </span>
            </div>
            <p className="mt-1 text-pretty">“{k.message}”</p>
            <div className="mt-1 text-xs text-muted">{formatDate(k.createdAt)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function KudosPage() {
  const user = await requireUser();
  const db = await getDb();
  const [colleagues, given, wall, mine] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, department: users.department, avatar: users.avatar })
      .from(users)
      .where(ne(users.id, user.id))
      .orderBy(asc(users.name)),
    sentToday(user.id),
    kudosFeed(30),
    kudosFeed(15, user.id),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Recognition"
        title="Kudos"
        subtitle="Say thanks with a few of your coins. Every kudos also earns you a little XP."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
              <HeartHandshake className="h-5 w-5 text-brand" /> Send kudos
            </h2>
            <SendKudosForm
              colleagues={colleagues}
              amounts={KUDOS_AMOUNTS}
              remaining={Math.max(0, KUDOS_DAILY_LIMIT - given)}
              balance={user.coins}
            />
          </Card>
          <Card className="p-6">
            <h2 className="font-display text-lg font-bold">Yours</h2>
            {mine.length ? (
              <KudosList items={mine} me={user.id} />
            ) : (
              <p className="mt-2 text-sm text-muted">Kudos you send or receive show up here.</p>
            )}
          </Card>
        </div>
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold">Kudos wall</h2>
          {wall.length ? (
            <KudosList items={wall} me={user.id} />
          ) : (
            <div className="mt-4">
              <EmptyState
                icon={<HeartHandshake className="h-6 w-6" />}
                title="No kudos yet"
                body="Be the first to thank someone for their help."
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
