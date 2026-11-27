import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { isLocale, negotiate, translator, type Locale } from "./messages";

export const LOCALE_COOKIE = "lang";

/** The user's chosen language (cookie), else the browser's preference. */
export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  return negotiate((await headers()).get("accept-language"));
});

export async function getT() {
  return translator(await getLocale());
}
