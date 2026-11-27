"use client";

import * as React from "react";
import { DEFAULT_LOCALE, translator, type Locale, type Translate } from "./messages";

const Ctx = React.createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useLocale() {
  return React.useContext(Ctx);
}

export function useT(): Translate {
  const locale = React.useContext(Ctx);
  return React.useMemo(() => translator(locale), [locale]);
}
