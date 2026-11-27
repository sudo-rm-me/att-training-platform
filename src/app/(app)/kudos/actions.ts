"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { giveKudos, KudosError } from "@/lib/kudos";
import { notify } from "@/lib/notifications";
import { awardBadges } from "@/lib/gamification";
import { BADGE_BY_KEY } from "@/lib/badges";

const schema = z.object({
  toId: z.string().uuid(),
  coins: z.number().int(),
  message: z.string().max(400),
});

export async function sendKudosAction(input: z.infer<typeof schema>) {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Pick a colleague and an amount." };
  try {
    const { kudos: k, to } = await giveKudos(user.id, parsed.data.toId, parsed.data.coins, parsed.data.message);
    await notify({
      userId: to.id,
      kind: "kudos",
      title: `${user.name} sent you ${k.coins} coins 💖`,
      body: k.message,
      link: "/kudos",
    });
    const [mine] = await Promise.all([awardBadges(user.id, undefined, k.id), awardBadges(to.id, undefined, k.id)]);
    revalidatePath("/kudos");
    revalidatePath("/", "layout");
    return {
      ok: true as const,
      message: `Kudos sent to ${to.name}!`,
      badges: mine.map((b) => BADGE_BY_KEY.get(b.key)?.name ?? b.name),
    };
  } catch (e) {
    if (e instanceof KudosError) return { ok: false as const, error: e.message };
    throw e;
  }
}
