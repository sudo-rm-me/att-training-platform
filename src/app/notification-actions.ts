"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { markAllRead } from "@/lib/notifications";

export async function markNotificationsReadAction() {
  const me = await requireUser();
  await markAllRead(me.id);
  revalidatePath("/", "layout");
}
