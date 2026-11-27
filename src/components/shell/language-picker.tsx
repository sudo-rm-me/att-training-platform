"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { LOCALE_NAMES, LOCALES } from "@/i18n/messages";
import { useLocale, useT } from "@/i18n/client";
import { setLocaleAction } from "@/i18n/actions";

export function LanguagePicker() {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const id = React.useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
      <Languages className="h-4 w-4 text-brand" aria-hidden />
      <span className="flex-1">{t("menu.language")}</span>
      <select
        id={id}
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          start(async () => {
            await setLocaleAction(v);
            router.refresh();
          });
        }}
        className="rounded-lg border border-border bg-card-solid px-2 py-1 text-sm"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
