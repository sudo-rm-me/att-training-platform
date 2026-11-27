import { eq } from "drizzle-orm";
import { Check, Coins, Lock, Smile } from "lucide-react";
import { getDb } from "@/db";
import { userItems } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { levelFromXp } from "@/lib/levels";
import { AVATAR_ITEMS, CATEGORY_LABELS, starterAvatar } from "@/lib/avatar";
import { AvatarSvg } from "@/components/avatar-svg";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { BuyButton } from "./buy-button";

export const metadata = { title: "Shop" };

export default async function ShopPage() {
  const user = await requireUser();
  const db = await getDb();
  const owned = new Set((await db.select({ i: userItems.item }).from(userItems).where(eq(userItems.userId, user.id))).map((r) => r.i));
  const level = levelFromXp(user.xp).level;
  const base = user.avatar ?? starterAvatar(user.name);

  const forSale = AVATAR_ITEMS.filter((i) => i.price > 0).sort((a, b) => a.price - b.price);
  const levelRewards = AVATAR_ITEMS.filter((i) => i.minLevel).sort((a, b) => a.minLevel! - b.minLevel!);

  return (
    <div>
      <PageHeader
        eyebrow="Spend"
        title="Item shop"
        subtitle="Spend the coins you earn from courses and badges on new looks for your avatar."
        actions={
          <>
            <div className="glass flex h-10 items-center gap-2 rounded-xl px-4 font-display text-lg font-bold">
              <Coins className="h-5 w-5 text-accent" /> {user.coins.toLocaleString()}
            </div>
            <LinkButton href="/avatar" variant="secondary">
              <Smile className="h-4 w-4" /> Character creator
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {forSale.map((it) => {
          const have = owned.has(it.key);
          return (
            <Card key={it.key} className="flex flex-col items-center p-4 text-center">
              <Badge tone="muted" className="self-start">{CATEGORY_LABELS[it.category]}</Badge>
              <AvatarSvg config={{ ...base, [it.category]: it.value }} className="my-3 h-28 w-28 drop-shadow-xl" />
              <div className="font-semibold">{it.label}</div>
              <div className="mt-3 w-full">
                {have ? (
                  <div className="flex h-8 items-center justify-center gap-1 rounded-lg bg-success/12 text-sm font-semibold text-success">
                    <Check className="h-4 w-4" /> Owned
                  </div>
                ) : (
                  <BuyButton itemKey={it.key} price={it.price} label={it.label} affordable={user.coins >= it.price} />
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-4 mt-12 font-display text-xl font-bold">Level rewards</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {levelRewards.map((it) => {
          const unlocked = level >= it.minLevel!;
          return (
            <Card key={it.key} className="flex flex-col items-center p-4 text-center">
              <AvatarSvg config={{ ...base, [it.category]: it.value }} className={`my-3 h-24 w-24 ${unlocked ? "" : "opacity-50 grayscale"}`} />
              <div className="font-semibold">{it.label}</div>
              <div className={`mt-2 flex items-center gap-1 text-sm font-semibold ${unlocked ? "text-success" : "text-muted"}`}>
                {unlocked ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />} Level {it.minLevel}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
