"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale } from "./messages";
import { LOCALE_COOKIE } from "./server";

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return { ok: false as const, error: "Unsupported language" };
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
