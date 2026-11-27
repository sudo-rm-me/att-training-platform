import { describe, expect, it } from "vitest";
import { MESSAGES, negotiate, translator } from "@/i18n/messages";

describe("i18n", () => {
  it("picks the best supported language from Accept-Language", () => {
    expect(negotiate("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(negotiate("ja,de;q=0.7,en;q=0.5")).toBe("de");
    expect(negotiate("en-GB;q=0.4,es;q=0.9")).toBe("es");
    expect(negotiate("ja")).toBe("en");
    expect(negotiate(null)).toBe("en");
  });

  it("translates with variables and falls back to English", () => {
    const t = translator("de");
    expect(t("player.next")).toBe("Weiter");
    expect(t("dash.toNext", { xp: 40, next: 3 })).toBe("Noch 40 XP bis Level 3");
    expect(translator("en")("results.levelUp", { from: 1, to: 2 })).toBe("Level up! 1 → 2");
  });

  it("every locale translates every key", () => {
    const en = MESSAGES.en as Record<string, Record<string, string>>;
    for (const [locale, msgs] of Object.entries(MESSAGES)) {
      const m = msgs as Record<string, Record<string, string>>;
      for (const [section, keys] of Object.entries(en))
        for (const key of Object.keys(keys)) expect(m[section]?.[key], `${locale} ${section}.${key}`).toBeTruthy();
    }
  });
});
