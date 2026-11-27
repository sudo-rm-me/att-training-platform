import { CalendarHeart, Users } from "lucide-react";
import type { GameEvent } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { pastEvents, upcomingEvents } from "@/lib/events";
import { Badge, Card, PageHeader } from "@/components/ui";
import { DeleteEventButton, EventForm } from "./event-form";

export const metadata = { title: "Events" };

const fmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

function EventRow({ e, now }: { e: GameEvent; now: Date }) {
  const live = e.startsAt <= now && e.endsAt > now;
  const done = e.endsAt <= now;
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-2xl">{e.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{e.name}</span>
          {live && <Badge tone="success">Live</Badge>}
          <Badge tone="muted">{e.xpMultiplier / 100}× XP</Badge>
          {e.teamChallenge && (
            <Badge tone="muted">
              <Users className="h-3 w-3" /> Team challenge
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted">
          {fmt.format(e.startsAt)} → {fmt.format(e.endsAt)}
        </div>
        {e.description && <p className="mt-1 text-sm">{e.description}</p>}
      </div>
      {!done && <DeleteEventButton id={e.id} name={e.name} />}
    </li>
  );
}

export default async function EventsAdminPage() {
  await requirePermission("admin");
  const now = new Date();
  const [upcoming, past] = await Promise.all([upcomingEvents(now), pastEvents(now)]);
  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Seasonal events"
        subtitle="Run double-XP weeks and team challenges. Bonus XP is added on top of normal course XP while the event is live."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
            <CalendarHeart className="h-5 w-5 text-brand" /> New event
          </h2>
          <EventForm />
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-lg font-bold">Live &amp; upcoming</h2>
            {upcoming.length ? (
              <ul className="divide-y divide-border">
                {upcoming.map((e) => (
                  <EventRow key={e.id} e={e} now={now} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Nothing scheduled.</p>
            )}
          </Card>
          {past.length > 0 && (
            <Card className="p-6">
              <h2 className="font-display text-lg font-bold">Past events</h2>
              <ul className="divide-y divide-border">
                {past.map((e) => (
                  <EventRow key={e.id} e={e} now={now} />
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
